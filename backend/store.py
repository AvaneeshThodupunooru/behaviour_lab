"""Session storage for the Behavior Lab event backend.

Two implementations behind one small interface:
- MongoStore: real persistence in MongoDB Atlas (used when MONGODB_URI is set
  and reachable).
- MemoryStore: in-process fallback, used automatically if MONGODB_URI is
  absent or the Atlas connection fails at startup, so the event can still
  run (with no cross-restart persistence) rather than hard-failing.

Both expose the same methods so backend/app.py doesn't need to know which
one it's talking to.
"""
from __future__ import annotations

import datetime
import json
import os
import threading
from typing import Optional

GAME_KEYS = ("timer", "gaze", "wobblewalk", "deadpan")


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _new_session_doc(session_id: str, participant_id: str, name: Optional[str]) -> dict:
    return {
        "session_id": session_id,
        "participant": {"participant_id": participant_id, "name": name},
        "started_at": _now_iso(),
        "completed_at": None,
        "overall_score": None,
        "games": {key: {"status": "pending"} for key in GAME_KEYS},
    }


class MemoryStore:
    """In-process fallback store. Not persisted across restarts."""

    def __init__(self):
        self._lock = threading.Lock()
        self._sessions: dict[str, dict] = {}
        self._counter = 0

    def is_mongo(self) -> bool:
        return False

    def ping(self) -> bool:
        return True

    def next_session_id(self) -> str:
        with self._lock:
            self._counter += 1
            year = datetime.datetime.now(datetime.timezone.utc).year
            return f"EVT-{year}-{self._counter:05d}"

    def create_session(self, participant_id: str, name: Optional[str]) -> dict:
        session_id = self.next_session_id()
        doc = _new_session_doc(session_id, participant_id, name)
        with self._lock:
            self._sessions[session_id] = doc
        return doc

    def get_session(self, session_id: str) -> Optional[dict]:
        with self._lock:
            doc = self._sessions.get(session_id)
            return dict(doc) if doc else None

    def submit_game_result(self, session_id: str, game: str, result: dict) -> Optional[dict]:
        with self._lock:
            doc = self._sessions.get(session_id)
            if doc is None:
                return None
            doc["games"][game] = {
                "status": "completed",
                "submitted_at": _now_iso(),
                "result": result,
            }
            return dict(doc)

    def complete_session(self, session_id: str) -> Optional[dict]:
        with self._lock:
            doc = self._sessions.get(session_id)
            if doc is None:
                return None
            doc["completed_at"] = _now_iso()
            return dict(doc)

    def set_overall_score(self, session_id: str, score: float) -> Optional[dict]:
        with self._lock:
            doc = self._sessions.get(session_id)
            if doc is None:
                return None
            doc["overall_score"] = score
            return dict(doc)

    def list_sessions(self) -> list[dict]:
        with self._lock:
            return list(self._sessions.values())

    # -------------------------------------------------------------------
    # Crash-recovery backup for expo use without MongoDB: a full JSON
    # snapshot of every session, rewritten after each completed session.
    # Writes go to a temp file + atomic rename so a hard kill can never
    # leave a half-written backup behind.
    # -------------------------------------------------------------------

    def dump_to_file(self, path: str) -> None:
        with self._lock:
            payload = {
                "counter": self._counter,
                "sessions": list(self._sessions.values()),
            }
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False)
        os.replace(tmp_path, path)

    def load_from_file(self, path: str) -> int:
        """Restore sessions saved by dump_to_file. Returns the count restored
        (0 when the file is missing or unreadable - never raises)."""
        try:
            with open(path, "r", encoding="utf-8") as fh:
                payload = json.load(fh)
            sessions = [s for s in (payload.get("sessions") or []) if isinstance(s, dict) and s.get("session_id")]
        except FileNotFoundError:
            return 0
        except (OSError, ValueError):
            return 0
        counter = payload.get("counter")
        if not isinstance(counter, int) or counter < 0:
            counter = 0
        with self._lock:
            self._sessions = {s["session_id"]: s for s in sessions}
            self._counter = max(counter, len(self._sessions))
        return len(self._sessions)


class MongoStore:
    """MongoDB Atlas-backed store."""

    def __init__(self, uri: str, db_name: str = "the-thing"):
        from pymongo import MongoClient
        from pymongo.server_api import ServerApi

        self._client = MongoClient(uri, server_api=ServerApi("1"), serverSelectionTimeoutMS=5000)
        self._db = self._client[db_name]
        self._sessions = self._db["sessions"]
        self._counters = self._db["counters"]
        self._sessions.create_index("session_id", unique=True)

    def is_mongo(self) -> bool:
        return True

    def ping(self) -> bool:
        try:
            self._client.admin.command("ping")
            return True
        except Exception:
            return False

    def next_session_id(self) -> str:
        year = datetime.datetime.now(datetime.timezone.utc).year
        counter_key = f"session_{year}"
        doc = self._counters.find_one_and_update(
            {"_id": counter_key},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        return f"EVT-{year}-{doc['seq']:05d}"

    def create_session(self, participant_id: str, name: Optional[str]) -> dict:
        session_id = self.next_session_id()
        doc = _new_session_doc(session_id, participant_id, name)
        self._sessions.insert_one(dict(doc))
        return doc

    def get_session(self, session_id: str) -> Optional[dict]:
        doc = self._sessions.find_one({"session_id": session_id}, {"_id": 0})
        return doc

    def submit_game_result(self, session_id: str, game: str, result: dict) -> Optional[dict]:
        updated = self._sessions.find_one_and_update(
            {"session_id": session_id},
            {"$set": {
                f"games.{game}": {
                    "status": "completed",
                    "submitted_at": _now_iso(),
                    "result": result,
                }
            }},
            projection={"_id": 0},
            return_document=True,
        )
        return updated

    def complete_session(self, session_id: str) -> Optional[dict]:
        updated = self._sessions.find_one_and_update(
            {"session_id": session_id},
            {"$set": {"completed_at": _now_iso()}},
            projection={"_id": 0},
            return_document=True,
        )
        return updated

    def set_overall_score(self, session_id: str, score: float) -> Optional[dict]:
        return self._sessions.find_one_and_update(
            {"session_id": session_id},
            {"$set": {"overall_score": score}},
            projection={"_id": 0},
            return_document=True,
        )

    def list_sessions(self) -> list[dict]:
        return list(self._sessions.find({}, {"_id": 0}))


def build_store():
    """Chooses MongoStore when MONGODB_URI is set and reachable, else MemoryStore."""
    uri = os.environ.get("MONGODB_URI", "").strip()
    if not uri:
        return MemoryStore(), False, "MONGODB_URI not set"
    try:
        store = MongoStore(uri)
        if not store.ping():
            raise RuntimeError("ping failed")
        return store, True, None
    except Exception as exc:  # noqa: BLE001 - want to fall back on any failure
        return MemoryStore(), False, f"Mongo connection failed, using in-memory store: {exc}"
