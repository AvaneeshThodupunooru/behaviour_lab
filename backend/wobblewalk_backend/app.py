"""FastAPI service for WobbleWalk video scoring."""
from __future__ import annotations

import importlib
import os
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .video_tracking import extract_game_metrics

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi"}
MAX_UPLOAD_BYTES = 150 * 1024 * 1024

app = FastAPI(title="WobbleWalk API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    """Report whether the analyzer's heavy dependencies are actually importable.

    video_tracking.py imports cv2/mediapipe lazily inside the analysis call, so
    the service starts happily on an interpreter that cannot run a single
    analysis. Before this probe existed, an operator checking /health saw
    "ok" and only discovered the missing wheels when the first participant's
    upload came back as a 500. The probe is read-only and does not change what
    /api/analyze does.
    """
    analyzer = {}
    for module_name in ("cv2", "mediapipe", "numpy"):
        try:
            module = importlib.import_module(module_name)
            analyzer[module_name] = getattr(module, "__version__", "unknown")
        except Exception as exc:  # ImportError, or a broken binary wheel
            analyzer[module_name] = f"MISSING ({exc.__class__.__name__})"

    ready = all(not str(value).startswith("MISSING") for value in analyzer.values())
    return {
        "status": "ok" if ready else "degraded",
        "service": "wobblewalk",
        "analyzer_ready": ready,
        "analyzer": analyzer,
    }


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...), spin_count: int = Form(3)) -> dict:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in VIDEO_EXTENSIONS:
        raise HTTPException(400, "Upload an MP4, MOV, or AVI video.")

    payload = await file.read()
    if not payload:
        raise HTTPException(400, "The uploaded video is empty.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "The video is larger than 150 MB.")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temporary:
            temporary.write(payload)
            temp_path = temporary.name
        metrics, meta = extract_game_metrics(temp_path)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"Video tracking failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            # On Windows, cv2.VideoCapture can briefly hold the temp file open
            # even after release(), making an immediate unlink raise WinError 32
            # (which surfaced as a spurious HTTP 500 after a successful analysis).
            # Retry briefly; leftover temp files in the worst case are harmless.
            for _attempt in range(10):
                try:
                    os.unlink(temp_path)
                    break
                except PermissionError:
                    time.sleep(0.2)

    if meta["detection_rate"] < 0.55:
        raise HTTPException(
            422,
            f"Full-body tracking worked in only {meta['detection_rate']:.0%} of frames. "
            "Use a clear, well-lit video with the whole player visible.",
        )

    return {
        "status": "success",
        "game_metrics": {
            **metrics,
            "spin_count": max(1, min(int(spin_count), 12)),
        },
        "tracking": meta,
    }
