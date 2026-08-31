# Behavior Lab — 4-Game Event Integration

One FastAPI process serves the event shell, three tracked activities, the WobbleWalk video
analysis API, and (optionally) stores every participant session in MongoDB
Atlas. Without Atlas it runs on an in-memory store so nothing ever hard-fails.

Flow: Participant → Session (`EVT-YYYY-#####`) → Timer → Gaze → WobbleWalk →
DEADPAN → Final Report.

---

## 1. Prerequisites (fresh Windows computer)

| Requirement | Notes |
|---|---|
| Windows 10/11 64-bit | |
| **Python 3.9.x** | Required for the backend venv. MediaPipe has no wheels for 3.13; use `py -3.9` (install from python.org, tick "Add to PATH" + py launcher) |
| Chrome or Edge | Camera APIs need a secure context: `http://localhost` is fine; a raw LAN IP over HTTP is NOT |
| Internet at venue | Games load WebGazer / MediaPipe / GazeCloudAPI / fonts from CDNs |
| MongoDB Atlas | Only needed for persistence; cluster must be MongoDB ≥ 5.0 (Stable API). Free M0 tier is sufficient |
| Node.js ≥ 20.19 or ≥ 22.12 | ONLY if rebuilding the WobbleWalk frontend (a prebuilt copy is already in `static/games/wobblewalk/`) |

## 2. Install

```bat
cd C:\Avaneesh\Neuro\Game        (or wherever this folder was copied/cloned)

py -3.9 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt
```

## 3. Configure MongoDB (optional but recommended for the event)

The backend reads `MONGODB_URI` from the process environment — see
`.env.example` for placeholders. Never commit real credentials.

PowerShell:
```powershell
$env:MONGODB_URI = "mongodb+srv://<user>:<password>@<cluster-host>.mongodb.net/?retryWrites=true&w=majority"
```

CMD:
```bat
set MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>.mongodb.net/?retryWrites=true&w=majority
```

- Omit the variable to run in MemoryStore mode (results lost on restart).
- Database name is fixed to `the-thing`; collections and indexes are created
  automatically on first connect.
- Atlas checklist: create project → M0 cluster (≥ MongoDB 5.0) → database user
  with read/write → **Network Access: add this laptop's public IP** (or
  `0.0.0.0/0` for the event day).

Verify after starting: `http://localhost:8000/api/health` should show
`"store":"mongodb","mongo":true`. If it shows `"memory"`, the `note` field
explains why.

## 4. Run

```bat
.venv\Scripts\python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000/** in Chrome and click *Start new participant*.

## 5. Event-day workflow

1. Start server (step 4), confirm backend pill says "Backend connected".
2. Enter participant ID → Create session (`EVT-YYYY-#####`).
3. Play stations in order from the checklist:
   - **Timer**: camera calibration (or graceful skip), word search, results.
   - **Gaze**: allow camera, GazeCloudAPI calibration runs automatically.
   - **WobbleWalk**: record a straight walk (no spins), upload the video;
     wait ~10–30 s while MediaPipe scores it. Detection-rate rejections mean
     "re-record with full body visible".
   - **DEADPAN**: use **Timed Challenge** mode (results submit automatically
     only in timed mode).
4. Return to the shell between games (checklist tracks completion).
5. Finish session → final report shows all completed stations.
6. If a submission fails, the game page offers Retry (results are also kept in
   browser localStorage until sent).

Camera games must run as separate full-page tabs — never iframe them, and run
only one at a time.

## 6. Smoke test (optional)

With the server running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\smoke_test_api.ps1
```

Runs 12 API checks against `http://127.0.0.1:8000` and prints PASS/FAIL.

## 7. Rebuilding WobbleWalk frontend (only if its source changed)

```powershell
cd build\wobblewalk-frontend
npm ci
$env:VITE_API_URL = "/wobblewalk-api"
npm run build
robocopy dist ..\..\static\games\wobblewalk /MIR
```

## 8. Layout

```
backend/                  common FastAPI app + Mongo/Memory store + report builder
backend/wobblewalk_backend/   original WobbleWalk analysis service, mounted at /wobblewalk-api
static/shared/event-client.js shared browser helper (submit/retry/localStorage fallback)
static/shell/             event UI served at /
static/games/timer|gaze|deadpan|wobblewalk   the three tracked activities (wobblewalk = built dist)
source/                   pristine copies of all tracked activities original projects
build/wobblewalk-frontend/    integrated Vite workspace used to produce static/games/wobblewalk
tools/smoke_test_api.ps1  12-check backend smoke test
```

Original game sources are additionally preserved untouched in
`timer-game-main/`, `wobblewalk-main/`, `gaze-experiment/`,
`try-not-to-laugh_final.html`.

## 9. Deviations from original code (kept minimal, see git history)

1. `backend/wobblewalk_backend/app.py`: temp-file deletion retries briefly on
   Windows (`PermissionError` / WinError 32) instead of failing the request
   after a successful analysis.
2. `requirements.txt`: `mediapipe==0.10.21` pin — newer MediaPipe releases
   removed the legacy `mp.solutions` API that WobbleWalk's original gait code
   uses. `opencv-python-headless` / `numpy` pinned for compatibility.
3. Game-side integration additions only (submission wrappers, event-client
   includes); tracking/scoring/calibration logic untouched.
