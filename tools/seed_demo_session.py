"""Create a fully-completed demo session so the final report can be opened
without playing all four camera stations.

Usage (server must already be running):

    .venv\\Scripts\\python tools\\seed_demo_session.py mid

Bands are ``good`` / ``mid`` / ``bad`` and pick a plausible metric profile for
each station. Prints the shell URL to open.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"

PROFILES = {
    "good": {
        "timer": {
            "accuracy": 0.94,
            "meanReactionTimeMs": 620,
            "stddevReactionTimeMs": 95,
            "checksPerMinute": 4.1,
            "attentionSwitchesPerMinute": 6.2,
            "pressureIndex": 18,
        },
        "gaze_correct": 5,
        "deadpan": {"laughCount": 0, "peakScorePct": 12.4, "durationSeconds": 60},
        "wobble": {
            "wobble_score": 9.4,
            "walk_duration_seconds": 7.8,
            "mean_deviation_pct": 5.1,
            "max_deviation_pct": 13.7,
            "path_efficiency_pct": 96.2,
            "direction_changes": 1,
            "drift_direction": "center",
        },
    },
    "mid": {
        "timer": {
            "accuracy": 0.71,
            "meanReactionTimeMs": 1180,
            "stddevReactionTimeMs": 340,
            "checksPerMinute": 7.8,
            "attentionSwitchesPerMinute": 11.4,
            "pressureIndex": 47,
        },
        "gaze_correct": 3,
        "deadpan": {"laughCount": 2, "peakScorePct": 58.1, "durationSeconds": 60},
        "wobble": {
            "wobble_score": 46.8,
            "walk_duration_seconds": 8.7,
            "mean_deviation_pct": 24.3,
            "max_deviation_pct": 61.9,
            "path_efficiency_pct": 81.4,
            "direction_changes": 5,
            "drift_direction": "right",
        },
    },
    "bad": {
        "timer": {
            "accuracy": 0.38,
            "meanReactionTimeMs": 2150,
            "stddevReactionTimeMs": 780,
            "checksPerMinute": 14.2,
            "attentionSwitchesPerMinute": 19.6,
            "pressureIndex": 84,
        },
        "gaze_correct": 1,
        "deadpan": {"laughCount": 6, "peakScorePct": 93.5, "durationSeconds": 27},
        "wobble": {
            "wobble_score": 88.2,
            "walk_duration_seconds": 11.4,
            "mean_deviation_pct": 47.6,
            "max_deviation_pct": 104.3,
            "path_efficiency_pct": 58.9,
            "direction_changes": 11,
            "drift_direction": "left",
        },
    },
}

QUESTIONS = [
    ("How many people were in the poster?", "Three", ["Two", "Three", "Four", "Five"]),
    ("What colour was the headline text?", "Red", ["Red", "Blue", "Black", "Yellow"]),
    ("Was there a logo in the corner?", "Yes", ["Yes", "No"]),
    ("What was the main object on the left?", "A chair", ["A chair", "A lamp", "A door", "A plant"]),
    ("How many lines of small print?", "Four", ["Two", "Three", "Four", "Six"]),
    ("What time was shown on the clock?", "9:15", ["9:15", "3:40", "12:00", "6:30"]),
]


def _post(path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read() or b"{}")


def _wave(seed: int, count: int, width: int, height: int) -> list[dict]:
    """Cheap deterministic scanpath so the gaze canvases have something to draw."""
    points = []
    for i in range(count):
        t = i / max(count - 1, 1)
        x = 0.12 + 0.76 * ((t * 3 + seed * 0.17) % 1.0)
        y = 0.18 + 0.64 * (0.5 + 0.5 * ((t * 5 + seed) % 2 - 1))
        points.append({"x": round(x * width, 1), "y": round(y * height, 1)})
    return points


def _route(seed: int, changes: int) -> list[dict]:
    """Zigzag route in the 0-100 space the shell's route canvas expects."""
    points = []
    steps = 34
    for i in range(steps):
        t = i / (steps - 1)
        swing = 26 * (1 if changes > 6 else 0.55) * ((t * max(changes, 1) + seed * 0.3) % 2 - 1)
        points.append({"x": round(min(93, max(7, 50 + swing)), 2), "y": round(92 - 84 * t, 2)})
    return points


def seed(band: str) -> str:
    profile = PROFILES[band]

    session = _post("/api/sessions", {"participant_id": f"DEMO-{band.upper()}", "name": f"Demo ({band})"})
    session_id = session["session_id"]

    correct_count = profile["gaze_correct"]
    question_results = []
    for index, (text, answer, options) in enumerate(QUESTIONS):
        got_it = index < correct_count
        question_results.append({
            "imageId": 1 if index < 3 else 2,
            "questionText": text,
            "correct": got_it,
            "selected": answer if got_it else next(o for o in options if o != answer),
            "correctAnswer": answer,
        })

    _post(f"/api/sessions/{session_id}/games/timer", {"metrics": profile["timer"]})
    _post(f"/api/sessions/{session_id}/games/gaze", {
        "imageCount": 2,
        "sampleCount": 240 if band == "good" else 150 if band == "mid" else 61,
        "questionResults": question_results,
        "images": [
            # Poster pixel space, matching the real images the gaze station
            # shows: samples are recorded against the original dimensions.
            {"id": 1, "samples": _wave(1, 26, 2730, 1536)},
            {"id": 2, "samples": _wave(4, 22, 2752, 1536)},
        ],
    })
    _post(f"/api/sessions/{session_id}/games/deadpan", profile["deadpan"])
    _post(f"/api/sessions/{session_id}/games/wobblewalk", {
        "available": True,
        "measurement_unit": "percent of shoulder width",
        "route": _route(2, profile["wobble"]["direction_changes"]),
        **profile["wobble"],
    })
    _post(f"/api/sessions/{session_id}/complete", {})
    return session_id


def main() -> int:
    band = (sys.argv[1] if len(sys.argv) > 1 else "mid").lower()
    if band not in PROFILES:
        print(f"Unknown band {band!r}. Expected one of {', '.join(PROFILES)}.")
        return 2
    try:
        session_id = seed(band)
    except urllib.error.URLError as exc:
        print(f"Could not reach {BASE} — is the server running?  ({exc})")
        return 1
    print(f"Seeded {band} session: {session_id}")
    print(f"Open: {BASE}/?session_id={session_id}   then click 'Finish session'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
