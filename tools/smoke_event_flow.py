"""End-to-end smoke test for THE THING event backend.

Drives the same HTTP surface the browser stations use: create a session,
submit one realistic result per tracked game key, mark the session complete,
then read back the report and the leaderboard. Verifies the pieces the shell
depends on (per-game summary fields, overall_score, leaderboard eligibility)
without touching any game code. Standard library only.

Run against a server that is already listening:
    .venv/Scripts/python.exe tools/smoke_event_flow.py http://127.0.0.1:5188
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5188").rstrip("/")

# Payload shapes copied from what each station actually submits, so the
# report summarizers are exercised on realistic keys rather than stubs.
GAME_RESULTS = {
    "timer": {
        "metrics": {
            "accuracy": 0.82,
            "meanReactionTimeMs": 640.0,
            "medianReactionTimeMs": 610.0,
            "stddevReactionTimeMs": 155.0,
            "checksPerMinute": 11.4,
            "attentionSwitchesPerMinute": 9.2,
            "pressureIndex": 38,
        },
        "rounds": [{"roundNum": 1, "durationSec": 35}],
    },
    "gaze": {
        "imageCount": 4,
        "sampleCount": 1875,
        "questionResults": [
            {"question": "q1", "correct": True},
            {"question": "q2", "correct": True},
            {"question": "q3", "correct": False},
            {"question": "q4", "correct": True},
        ],
    },
    "deadpan": {"laughCount": 2, "peakScorePct": 61.5, "durationSeconds": 30},
    "wobblewalk": {
        "wobble_score": 34.2,
        "walk_duration_seconds": 7.4,
        "mean_deviation_pct": 6.1,
        "path_efficiency_pct": 92.5,
        "direction_changes": 5,
        "drift_direction": "left",
        "spin_count": 1,
    },
}


def call(method: str, path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"FAIL {method} {path} -> HTTP {exc.code}: {exc.read().decode()[:400]}")


failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if condition else 'FAIL'} {label}{'' if condition else f' — {detail}'}")
    if not condition:
        failures.append(label)


print(f"event flow smoke test against {BASE}")

health = call("GET", "/api/health")
check("shell backend healthy", health.get("status") == "ok", json.dumps(health))
print(f"  info store={health.get('store')} note={health.get('note')!r}")

analyzer = call("GET", "/wobblewalk-api/health")
check(
    "wobblewalk analyzer dependencies importable",
    analyzer.get("analyzer_ready") is True,
    json.dumps(analyzer.get("analyzer")),
)

session = call("POST", "/api/sessions", {"participant_id": "smoke-test", "name": "Smoke Test"})
session_id = session["session_id"]
print(f"  info session_id={session_id}")
check("session id uses the EVT-<year>-<n> format", session_id.startswith("EVT-"), session_id)

for game, result in GAME_RESULTS.items():
    ack = call("POST", f"/api/sessions/{session_id}/games/{game}", result)
    check(f"submit {game}", ack.get("status") == "ok", json.dumps(ack))

stored = call("GET", f"/api/sessions/{session_id}")
check(
    "all four game keys stored as completed",
    all((stored["games"].get(key) or {}).get("status") == "completed" for key in GAME_RESULTS),
    json.dumps({k: (v or {}).get("status") for k, v in stored["games"].items()}),
)

call("POST", f"/api/sessions/{session_id}/complete")
report = call("GET", f"/api/sessions/{session_id}/report")
check("report lists four completed games", len(report["games_completed"]) == 4, json.dumps(report["games_completed"]))
check("overall_score is populated", isinstance(report["overall_score"], (int, float)), repr(report["overall_score"]))
print(f"  info overall_score={report['overall_score']} / {report['max_score']}")

# The shell's report screen reads these exact keys; a rename in report.py would
# silently render blanks, so assert on them here rather than eyeballing the page.
expected_fields = {
    "timer": ["accuracy", "meanReactionTimeMs", "pressureIndex", "score"],
    "gaze": ["imagesViewed", "gazeSamplesCollected", "recallScore", "score"],
    "deadpan": ["laughCount", "peakScorePct", "durationSeconds", "score"],
    "wobblewalk": ["wobbleScore", "meanDeviationPct", "pathEfficiencyPct", "directionChanges", "driftDirection", "score"],
}
for game, fields in expected_fields.items():
    block = report["summary"].get(game) or {}
    missing = [f for f in fields if block.get(f) is None]
    check(f"{game} summary fields the shell renders", not missing, f"missing/None: {missing}")

leaderboard = call("GET", "/api/leaderboard")
rows = leaderboard.get("entries", leaderboard) if isinstance(leaderboard, dict) else leaderboard
ids = [row.get("session_id") for row in rows]
check("completed session appears on the leaderboard", session_id in ids, json.dumps(ids))

print()
if failures:
    print(f"{len(failures)} check(s) failed: {failures}")
    raise SystemExit(1)
print("all checks passed")
