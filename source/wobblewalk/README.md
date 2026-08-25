# WobbleWalk

WobbleWalk is a camera-based party game: spin a player, record the attempt to
walk a straight line, and get a route replay, wobble score, and one of twenty
round-specific roasts.

The score uses the player's visible hip-centre path. Lateral deviation is
normalized by shoulder width so normal changes in camera distance have less
effect on the result. It is a game score, not a medical or sobriety test.

## Run locally

Requirements: Python 3.11+ and Node.js 20+.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`. A built-in demonstration report is available at
`http://127.0.0.1:5173/report?sample=1`.

## Recording setup

- Keep the complete player visible throughout the clip.
- Use a fixed camera with a clear, well-lit walking lane.
- Record the spins and the walk in one continuous take.
- Keep the lane clear, use a spotter, and stop if the player feels dizzy.

## Project structure

- `frontend/`: React and Vite game interface.
- `backend/`: FastAPI, MediaPipe pose tracking, and path scoring.
