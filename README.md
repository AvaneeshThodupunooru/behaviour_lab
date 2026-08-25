# Behavior Lab — 4-Game Event Integration

One FastAPI process serves the event shell, four games, the WobbleWalk
analysis API, and stores every participant session in MongoDB Atlas
(with an in-memory fallback for offline testing).

Flow: Participant → Session (`EVT-YYYY-#####`) → Timer → Gaze → WobbleWalk →
DEADPAN → Report.

## Quick start (event day)

```bat
cd C:\Avaneesh\Neuro\Game

:: one-time setup (already done if .venv exists)
py -3.9 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt

:: run  (add Atlas URI when you want persistence)
set MONGODB_URI=mongodb+srv://user:pass@cluster/...
.venv\Scripts\python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Then open **http://localhost:8000/** in Chrome and click *Start new participant*.

Notes:
- Without `MONGODB_URI` the server runs with the in-memory store (results are
  lost on restart). With it, sessions persist to MongoDB Atlas.
- Camera games require a secure context: use `http://localhost:8000` from the
  host laptop itself. A raw LAN IP over HTTP will block webcam access.
- DEADPAN: use **Timed Challenge** mode so results submit automatically.
- WobbleWalk: record the walk (no spins), upload the video on its page.

## Layout

```
backend/                  common FastAPI app + Mongo/Memory store + report builder
backend/wobblewalk_backend/   original WobbleWalk analysis service, mounted at /wobblewalk-api
static/shared/event-client.js shared browser helper (submit/retry/local-storage fallback)
static/shell/             event UI served at /
static/games/timer|gaze|deadpan|wobblewalk   the four games
source/                   pristine copies of all four original projects
build/wobblewalk-frontend/    integrated Vite workspace used to produce static/games/wobblewalk
```

The original game sources also remain untouched in `timer-game-main/`,
`wobblewalk-main/`, `gaze-experiment/`, `try-not-to-laugh_final.html`.

## Testing helpers

`_tmp/test_backend.ps1` — full API smoke test (12 checks) against a running
server. `_tmp/test_video.mp4` — synthetic clip that exercises the WobbleWalk
upload path end-to-end (it contains no person, so a healthy pipeline answers
HTTP 422 with the detection-rate message).

## Deviations from original code (kept minimal)

1. `backend/wobblewalk_backend/app.py`: temp-file deletion retries briefly on
   Windows (`PermissionError` / WinError 32) instead of failing the request
   after a successful analysis.
2. `requirements.txt`: `mediapipe==0.10.21` pin — newer MediaPipe releases
   removed the legacy `mp.solutions` API the original gait code uses.
3. Game-side integration additions only (submission wrappers); see git history.
