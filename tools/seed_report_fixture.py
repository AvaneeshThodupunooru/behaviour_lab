"""Seeds one session with realistic station payloads, for report verification.

This is a DEV HARNESS, not part of the product. It exists because the four
stations need a webcam, a gaze tracker and a person walking a line, which no
automated check can supply. Every payload below is shaped exactly like what the
real stations POST (see static/games/*/js and backend/report.py's summarizers),
so build_report runs its true code path and the rendered report exercises the
same fields a live session would produce.

Nothing here writes into the report itself: the numbers are inputs to the
scorer, exactly as a participant's would be.

    .venv/Scripts/python.exe tools/seed_report_fixture.py http://127.0.0.1:8000
"""
from __future__ import annotations

import json
import math
import random
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
SEED = int(sys.argv[2]) if len(sys.argv) > 2 else 7
random.seed(SEED)


def post(path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else b"{}"
    req = urllib.request.Request(
        BASE + path, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read() or b"{}")


def get(path: str) -> dict:
    with urllib.request.urlopen(BASE + path) as res:
        return json.loads(res.read() or b"{}")


# --- Test 1: word search under a visible countdown -------------------------
# Shape from static/games/timer/js/metrics.js + roi.js. Round length 180 s;
# timerVisits carry timeRemainingAtVisit in SECONDS, as roi.js attaches it.
def timer_payload() -> dict:
    round_seconds = 180
    visits = []
    remaining = round_seconds
    while remaining > 4:
        # Glances cluster tighter as the clock runs down, which is the whole
        # point of the station; the fixture reproduces that shape.
        gap = random.uniform(6.0, 18.0) * (0.45 + remaining / round_seconds)
        remaining -= gap
        if remaining <= 2:
            break
        visits.append(
            {
                "durationMs": round(random.uniform(240, 1250), 1),
                "timeRemainingAtVisit": round(remaining, 2),
                "elapsedFrac": round((round_seconds - remaining) / round_seconds, 4),
            }
        )
    dwell = sum(v["durationMs"] for v in visits)
    trials = []
    for i in range(14):
        found = random.random() < 0.79
        trials.append(
            {
                "index": i,
                "correct": found,
                "reactionTimeMs": round(random.gauss(1850 + i * 45, 420), 1) if found else None,
            }
        )
    rts = [t["reactionTimeMs"] for t in trials if t["reactionTimeMs"]]
    rts_sorted = sorted(rts)
    mean_rt = sum(rts) / len(rts)
    median_rt = rts_sorted[len(rts_sorted) // 2]
    sd_rt = math.sqrt(sum((r - mean_rt) ** 2 for r in rts) / len(rts))
    correct = sum(1 for t in trials if t["correct"])
    per_quarter = [0, 0, 0, 0]
    for v in visits:
        per_quarter[min(3, int(v["elapsedFrac"] * 4))] += 1
    ratio = per_quarter[3] / (per_quarter[0] + 1)
    return {
        "metrics": {
            "accuracy": correct / len(trials),
            "targetsFound": correct,
            "targetCount": len(trials),
            "meanReactionTimeMs": mean_rt,
            "medianReactionTimeMs": median_rt,
            "stddevReactionTimeMs": sd_rt,
            "timerCheckCount": len(visits),
            "checksPerMinute": len(visits) / (round_seconds / 60),
            "attentionSwitchesPerMinute": len(visits) * 2 / (round_seconds / 60),
            "totalDwellMs": dwell,
            "avgGlanceMs": dwell / len(visits),
            "checksPerQuarter": per_quarter,
            "deadlineSensitivityRatio": ratio,
            "deadlineSensitivityLabel": "High" if ratio >= 3 else "Moderate" if ratio >= 1.5 else "Low",
            "performanceDelta": -0.14,
            "pressureIndex": 44,
        },
        "rounds": [{"roundNum": 1, "durationSec": round_seconds, "trials": trials}],
        "timerVisits": visits,
        "gazeSamples": [{"x": 0, "y": 0} for _ in range(2100)],
    }


# --- Test 2: two posters, then recall questions -----------------------------
# Shape from static/games/gaze/js: images carry id/url/width/height and samples
# in the poster's own pixel space; url is relative to /games/gaze-timer/.
POSTERS = [
    {"id": 1, "file": "Images/1.jpeg", "w": 736, "h": 920},
    {"id": 5, "file": "Images/5.jpeg", "w": 1200, "h": 900},
]

QUESTIONS = [
    ("How many people were in the first poster?", "Three", "Three", True),
    ("What colour was the sign on the left?", "Yellow", "Red", False),
    ("Was there a vehicle in the second poster?", "Yes", "Yes", True),
    ("What was written across the top?", "Nothing", "A slogan", False),
]


def gaze_samples(width: int, height: int, count: int) -> list:
    """Gaze does not scatter evenly: it lands in a few places and stays.

    Three attention centres plus a low-weight wander, which is what makes a
    heatmap show structure instead of fog.
    """
    centres = [
        (width * 0.42, height * 0.34, width * 0.075),
        (width * 0.66, height * 0.58, width * 0.055),
        (width * 0.28, height * 0.72, width * 0.045),
    ]
    weights = [0.46, 0.31, 0.15]
    samples = []
    for _ in range(count):
        roll = random.random()
        if roll < sum(weights):
            acc = 0.0
            for (cx, cy, spread), weight in zip(centres, weights):
                acc += weight
                if roll < acc:
                    x = random.gauss(cx, spread)
                    y = random.gauss(cy, spread)
                    break
        else:
            x = random.uniform(0, width)
            y = random.uniform(0, height)
        samples.append({"x": round(max(0, min(width, x)), 1), "y": round(max(0, min(height, y)), 1)})
    return samples


def gaze_payload() -> dict:
    images = []
    total = 0
    for poster in POSTERS:
        count = random.randint(520, 760)
        total += count
        images.append(
            {
                "id": poster["id"],
                "url": poster["file"],
                "width": poster["w"],
                "height": poster["h"],
                "samples": gaze_samples(poster["w"], poster["h"], count),
            }
        )
    return {
        "imageCount": len(images),
        "sampleCount": total,
        "images": images,
        "questionResults": [
            {
                "imageId": POSTERS[i % len(POSTERS)]["id"],
                "questionText": text,
                "selected": selected,
                "correctAnswer": answer,
                "correct": ok,
                "responseTimeMs": round(random.uniform(2200, 6400), 1),
            }
            for i, (text, selected, answer, ok) in enumerate(QUESTIONS)
        ],
    }


# --- Test 3: spin, then walk the line ---------------------------------------
# Shape from backend/wobblewalk_backend/game_metrics.py. Route y runs 92 (start)
# down to 8 (end) and x is clipped to 7..93 around a centre of 50, so the
# fixture generates the same geometry the pose analyser emits.
def wobble_payload() -> dict:
    frames = 43
    route = []
    lateral = 0.0
    velocity = 0.0
    for i in range(frames):
        progress = i / (frames - 1)
        # A post-spin walk drifts and corrects; momentum plus a weak pull back
        # to the line reproduces that without looking like noise.
        velocity += random.gauss(0, 2.1) - lateral * 0.16
        velocity = max(-7.0, min(7.0, velocity))
        lateral += velocity
        lateral = max(-38.0, min(38.0, lateral))
        route.append(
            {
                "x": round(max(7.0, min(93.0, 50 + lateral * 0.55)), 2),
                "y": round(92 - 84 * progress, 2),
            }
        )
    offsets = [abs(point["x"] - 50) / 40.0 for point in route]
    mean_body = sum(offsets) / len(offsets)
    max_body = max(offsets)
    final_offset = route[-1]["x"] - 50
    drift = "center" if abs(final_offset) <= 2.0 else ("right" if final_offset > 0 else "left")
    changes = sum(
        1
        for i in range(1, len(route) - 1)
        if (route[i + 1]["x"] - route[i]["x"]) * (route[i]["x"] - route[i - 1]["x"]) < 0
    )
    return {
        "available": True,
        "wobble_score": round(
            100.0
            * min(
                1.0,
                0.45 * min(mean_body / 0.24, 1.0)
                + 0.30 * min(max_body / 0.65, 1.0)
                + 0.25 * min(0.13 / 0.30, 1.0),
            ),
            1,
        ),
        "mean_deviation_pct": round(mean_body * 100, 1),
        "max_deviation_pct": round(max_body * 100, 1),
        "path_efficiency_pct": 87.0,
        "direction_changes": changes,
        "drift_direction": drift,
        "walk_duration_seconds": 9.4,
        "walk_distance_body_widths": 6.8,
        "tracked_frames": 282,
        "spin_count": 5,
        "route": route,
        "measurement_unit": "percent of shoulder width",
    }


# --- Test 4: try not to laugh ------------------------------------------------
# Shape from static/games/deadpan/index.html buildSessionResult().
def deadpan_payload() -> dict:
    log = []
    for n in range(1, 4):
        log.insert(0, {"n": n, "peak": random.randint(58, 92), "time": "12:0%d:11" % n})
    return {
        "laughCount": len(log),
        "peakScorePct": max(entry["peak"] for entry in log),
        "durationSeconds": 62,
        "mode": "standard",
        "log": log,
        "capturedAt": "2026-09-02T12:00:00.000Z",
    }


def main() -> int:
    session = post(
        "/api/sessions",
        {"participant_id": "FIXTURE-%03d" % SEED, "name": "Report fixture"},
    )
    session_id = session.get("session_id") or session.get("id")
    if not session_id:
        print("could not create a session:", session)
        return 1

    for game, payload in (
        ("timer", timer_payload()),
        ("gaze", gaze_payload()),
        ("wobblewalk", wobble_payload()),
        ("deadpan", deadpan_payload()),
    ):
        post("/api/sessions/%s/games/%s" % (session_id, game), payload)
    post("/api/sessions/%s/complete" % session_id)

    report = get("/api/sessions/%s/report" % session_id)
    summary = report.get("summary") or {}
    print("session_id      :", session_id)
    print("report_ready    :", report.get("report_ready"))
    print("overall_score   :", report.get("overall_score"))
    print("stations        : %s of %s" % (report.get("stations_completed"), report.get("stations_total")))
    for row in report.get("score_breakdown") or []:
        print("  %-46s %s" % (row.get("label"), row.get("score")))
    timer = summary.get("timer") or {}
    gaze = summary.get("gaze") or {}
    wobble = summary.get("wobblewalk") or {}
    deadpan = summary.get("deadpan") or {}
    print("timerCheckCount :", timer.get("timerCheckCount"), "| visits:", len(timer.get("timerVisits") or []))
    print("gaze posters    :", [(img.get("id"), img.get("sampleCount")) for img in gaze.get("images") or []])
    print("heatmap avail   :", gaze.get("heatmapAvailable"))
    print("route points    :", len(wobble.get("route") or []), "| drift:", wobble.get("driftDirection"))
    print("expression evts :", len(deadpan.get("events") or []))
    print("research lines  :", len(report.get("research_lines") or []))
    print("awareness lines :", len(report.get("awareness_lines") or []))
    print()
    print("open: %s/?session_id=%s" % (BASE, session_id))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as err:  # pragma: no cover - dev harness
        print("HTTP %s %s" % (err.code, err.read().decode(errors="replace")))
        raise SystemExit(1)
