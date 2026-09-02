"""Behavior Lab — common event backend.

Wraps four existing games with one participant/session id, one backend,
and MongoDB Atlas storage (falling back to an in-memory store if
MONGODB_URI isn't set or Atlas isn't reachable, so the event can still run).

Run with:
    MONGODB_URI="mongodb+srv://..." uvicorn backend.app:app --host 0.0.0.0 --port 8000

Then open http://localhost:8000/ for the event shell.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from .store import build_store, GAME_KEYS
from .report import build_report

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
# MemoryStore crash-recovery backup (used only when MONGODB_URI is not set).
BACKUP_PATH = BASE_DIR / "data" / "sessions_backup.json"

# Load MONGODB_URI (and any other credentials) from the repo-root .env file
# BEFORE build_store() reads the environment below.
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="Behavior Lab Event Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"]
)

store, using_mongo, store_note = build_store()
if not using_mongo:
    restored = store.load_from_file(str(BACKUP_PATH))
    if restored:
        print(f"[behavior-lab] Restored {restored} session(s) from {BACKUP_PATH}", flush=True)


# ---------------------------------------------------------------------------
# Session / game API
# ---------------------------------------------------------------------------

class CreateSessionRequest(BaseModel):
    participant_id: str
    name: Optional[str] = None


@app.get("/api/health")
def health():
    mongo_ok = store.ping() if using_mongo else False
    return {"status": "ok", "mongo": mongo_ok, "store": "mongodb" if using_mongo else "memory", "note": store_note}


@app.post("/api/sessions")
def create_session(req: CreateSessionRequest):
    participant_id = (req.participant_id or "").strip()
    if not participant_id:
        raise HTTPException(400, "participant_id is required")
    doc = store.create_session(participant_id, (req.name or "").strip() or None)
    return doc


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    doc = store.get_session(session_id)
    if doc is None:
        raise HTTPException(404, f"No session found for id {session_id!r}")
    return doc


@app.post("/api/sessions/{session_id}/games/{game}")
def submit_game_result(session_id: str, game: str, result: dict):
    if game not in GAME_KEYS:
        raise HTTPException(400, f"Unknown game {game!r}. Expected one of {GAME_KEYS}.")
    existing = store.get_session(session_id)
    if existing is None:
        raise HTTPException(404, f"No session found for id {session_id!r}")
    updated = store.submit_game_result(session_id, game, result)
    if not using_mongo:
        try:
            store.dump_to_file(str(BACKUP_PATH))
        except OSError:
            pass
    return {"status": "ok", "session_id": session_id, "game": game}


@app.post("/api/sessions/{session_id}/complete")
def complete_session(session_id: str):
    updated = store.complete_session(session_id)
    if updated is None:
        raise HTTPException(404, f"No session found for id {session_id!r}")
    if not using_mongo:
        # Best-effort full-overwrite dump; never fail the API call over it.
        try:
            store.dump_to_file(str(BACKUP_PATH))
        except OSError:
            pass
    return updated


@app.get("/api/sessions/{session_id}/report")
def get_report(session_id: str):
    doc = store.get_session(session_id)
    if doc is None:
        raise HTTPException(404, f"No session found for id {session_id!r}")
    return build_report(doc)


@app.get("/api/leaderboard")
def get_leaderboard():
    entries = []
    for session_doc in store.list_sessions():
        # A session can be manually marked complete before all game results
        # arrive, so require both its completion timestamp and all four reports.
        if not session_doc.get("completed_at"):
            continue
        report = build_report(session_doc)
        if len(report["games_completed"]) != len(GAME_KEYS) or report["overall_score"] is None:
            continue
        entries.append({
            "session_id": session_doc.get("session_id"),
            "participant": session_doc.get("participant"),
            "overall_score": report["overall_score"],
            "started_at": session_doc.get("started_at"),
            "completed_at": session_doc.get("completed_at"),
            "scores": {key: report["summary"][key]["score"] for key in GAME_KEYS},
        })
    return sorted(entries, key=lambda entry: entry["overall_score"], reverse=True)


# ---------------------------------------------------------------------------
# WobbleWalk's own existing FastAPI service, mounted unchanged as a
# sub-application so the whole event still runs as one process / one port.
# Its frontend is built with VITE_API_URL=/wobblewalk-api so its fetch
# calls land here without any changes to its analysis code.
# ---------------------------------------------------------------------------
from .wobblewalk_backend.app import app as wobblewalk_app  # noqa: E402

app.mount("/wobblewalk-api", wobblewalk_app)


# ---------------------------------------------------------------------------
# Static files: event shell, shared event-client.js, and all four games.
# Mounted last so it doesn't shadow the /api/* and /wobblewalk-api routes.
# ---------------------------------------------------------------------------


@app.middleware("http")
async def revalidate_station_code(request, call_next):
    """Force the browser to revalidate station HTML/JS/CSS on every load.

    StaticFiles sends only ETag/Last-Modified, so with no Cache-Control the
    browser is free to serve station code from its heuristic cache without
    asking. During setup that means an edit made minutes earlier silently does
    not reach the station. ETags still answer 304 for unchanged files, so this
    costs one conditional request per asset. Images, video and the hashed Vite
    bundles keep their normal caching.
    """
    response = await call_next(request)
    path = request.url.path
    # Directory URLs ("/", "/leaderboard/", "/games/<station>/") are the
    # html=True index pages. They carry no file suffix, so match the trailing
    # slash as well or the station pages themselves stay heuristically cached.
    if path.endswith((".html", ".js", ".css", "/")):
        if "/assets/" not in path:  # Vite output is content-hashed already
            response.headers["Cache-Control"] = "no-cache"
    return response


app.mount("/static/shared", StaticFiles(directory=str(STATIC_DIR / "shared")), name="shared")
app.mount("/games/timer", StaticFiles(directory=str(STATIC_DIR / "games" / "timer"), html=True), name="timer")
app.mount("/games/gaze", StaticFiles(directory=str(STATIC_DIR / "games" / "gaze"), html=True), name="gaze")
app.mount("/games/gaze-timer", StaticFiles(directory=str(STATIC_DIR / "games" / "gaze-timer"), html=True), name="gaze-timer")
app.mount("/games/deadpan", StaticFiles(directory=str(STATIC_DIR / "games" / "deadpan"), html=True), name="deadpan")
app.mount("/games/wobblewalk", StaticFiles(directory=str(STATIC_DIR / "games" / "wobblewalk"), html=True), name="wobblewalk")
app.mount("/leaderboard", StaticFiles(directory=str(STATIC_DIR / "leaderboard"), html=True), name="leaderboard")
app.mount("/", StaticFiles(directory=str(STATIC_DIR / "shell"), html=True), name="shell")
