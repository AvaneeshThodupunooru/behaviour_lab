"""Success-path check for the WobbleWalk scoring pipeline.

The HTTP smoke test (tools/smoke_event_flow.py) posts a hand-written
wobblewalk payload, and a real upload can only be exercised with a person
walking in front of a camera. That left the part of the pipeline that
actually produces the numbers - calculate_game_metrics - unverified.

This drives calculate_game_metrics with synthetic hip-centre tracks whose
correct answers are known by construction (a straight walk, the same walk
with a lateral wobble, curved drifts to each side, a too-short clip, and a
track with dropped frames), then pushes one result through
report.summarize_wobblewalk so the camelCase field names the shell renders
are checked against real analyzer output rather than a stub.

No server and no video needed. Run from the repository root:
    .venv/Scripts/python.exe tools/wobblewalk_metrics_check.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.report import summarize_wobblewalk  # noqa: E402
from backend.wobblewalk_backend.game_metrics import calculate_game_metrics  # noqa: E402

FPS = 30.0
SHOULDER = 0.12  # normalized shoulder width, i.e. the metric's unit of length

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if condition else 'FAIL'} {label}{'' if condition else f' — {detail}'}")
    if not condition:
        failures.append(label)


def walk(frames: int = 120, wobble: float = 0.0, curve: float = 0.0, period: float = 60.0):
    """Hip-centre track walking up the frame, with optional wobble and drift.

    y falls from 0.85 to 0.35 (walking away from the camera), x stays at 0.5
    unless ``wobble`` adds a sine oscillation or ``curve`` bends the path
    sideways. ``curve`` is quadratic on purpose: a linear sideways drift is
    still a straight line, which the best-fit line would absorb entirely.
    """
    samples = []
    for index in range(frames):
        t = index / max(frames - 1, 1)
        x = 0.5 + curve * t * t + wobble * math.sin(2 * math.pi * index / period)
        samples.append((x, 0.85 - 0.50 * t, SHOULDER))
    return samples


print("wobblewalk metrics check (synthetic tracks, no video)")

# --- A steady walk straight up the frame -----------------------------------
steady = calculate_game_metrics(walk(), FPS)
check("steady walk is scoreable", steady.get("available") is True, str(steady.get("reason")))
print(f"  info steady wobble_score={steady.get('wobble_score')} "
      f"efficiency={steady.get('path_efficiency_pct')} drift={steady.get('drift_direction')}")
check("steady walk scores near zero wobble", steady["wobble_score"] < 5.0, str(steady["wobble_score"]))
check("steady walk is path-efficient", steady["path_efficiency_pct"] > 97.0, str(steady["path_efficiency_pct"]))
check("steady walk reports no drift", steady["drift_direction"] == "center", steady["drift_direction"])
check("steady walk has no direction changes", steady["direction_changes"] == 0, str(steady["direction_changes"]))
check("walk duration is close to the clip length",
      3.0 <= steady["walk_duration_seconds"] <= 4.0, str(steady["walk_duration_seconds"]))

# --- The same walk with a lateral wobble on top ----------------------------
wobbly = calculate_game_metrics(walk(wobble=0.5 * SHOULDER), FPS)
check("wobbly walk is scoreable", wobbly.get("available") is True, str(wobbly.get("reason")))
print(f"  info wobbly wobble_score={wobbly.get('wobble_score')} "
      f"mean_dev={wobbly.get('mean_deviation_pct')}% changes={wobbly.get('direction_changes')}")
check("wobble raises the score well above a steady walk",
      wobbly["wobble_score"] > steady["wobble_score"] + 20, f"{steady['wobble_score']} -> {wobbly['wobble_score']}")
check("wobble is measured in shoulder widths", wobbly["mean_deviation_pct"] > 20.0, str(wobbly["mean_deviation_pct"]))
check("side-to-side motion is counted", wobbly["direction_changes"] >= 2, str(wobbly["direction_changes"]))
check("wobble costs path efficiency",
      wobbly["path_efficiency_pct"] < steady["path_efficiency_pct"],
      f"{steady['path_efficiency_pct']} -> {wobbly['path_efficiency_pct']}")

# --- Drift sign: a right-bending path must not be reported as left ---------
right = calculate_game_metrics(walk(curve=+0.9 * SHOULDER), FPS)
left = calculate_game_metrics(walk(curve=-0.9 * SHOULDER), FPS)
print(f"  info drift right-curve={right.get('drift_direction')} left-curve={left.get('drift_direction')}")
check("drift direction is reported for a curved path",
      right.get("drift_direction") in ("left", "right") and left.get("drift_direction") in ("left", "right"),
      f"{right.get('drift_direction')} / {left.get('drift_direction')}")
check("mirrored paths drift to opposite sides",
      right["drift_direction"] != left["drift_direction"],
      f"both reported {right['drift_direction']}")

# --- Degraded inputs must refuse rather than invent a score ----------------
too_short = calculate_game_metrics(walk(frames=8), FPS)
check("a clip with too few tracked frames is refused", too_short.get("available") is False, str(too_short))
check("the refusal explains itself", bool(too_short.get("reason")), str(too_short))
check("the refusal reports how many frames were tracked", too_short.get("tracked_frames") == 8, str(too_short))
check("empty input is refused", calculate_game_metrics([], FPS).get("available") is False, "empty list scored")

# Dropped frames are what a real recording looks like: MediaPipe loses the
# body for a moment and video_tracking.py appends a NaN row.
gappy_samples = walk()
for index in range(0, len(gappy_samples), 5):
    gappy_samples[index] = (float("nan"), float("nan"), float("nan"))
gappy = calculate_game_metrics(gappy_samples, FPS)
check("dropped frames are interpolated, not fatal", gappy.get("available") is True, str(gappy.get("reason")))
check("only detected frames are counted as tracked",
      gappy["tracked_frames"] == len(gappy_samples) - len(range(0, len(gappy_samples), 5)),
      str(gappy["tracked_frames"]))

# --- The route replay the shell draws on a canvas --------------------------
route = steady["route"]
check("a route is returned for the replay canvas", len(route) > 1, str(len(route)))
check("route points stay inside the drawable box",
      all(7 <= point["x"] <= 93 and 8 <= point["y"] <= 92 for point in route),
      str([p for p in route if not (7 <= p["x"] <= 93 and 8 <= p["y"] <= 92)][:3]))
check("route is downsampled, not one point per frame",
      len(route) < steady["tracked_frames"], f"{len(route)} points for {steady['tracked_frames']} frames")
# route_stride is len(path) // 42, so the count lands somewhere between 42 and
# roughly 84 rather than exactly 42. That is the analyzer's actual contract;
# the canvas draws either fine, so this bounds it instead of tightening it.
long_route = calculate_game_metrics(walk(frames=900), FPS)["route"]
check("route length does not grow with clip length", len(long_route) <= 84, str(len(long_route)))

# --- The field names the shell's report card actually reads ----------------
# summarize_wobblewalk renames every analyzer key, so a rename on either side
# silently blanks the participant's report card. Check against real output.
summary = summarize_wobblewalk({**steady, "spin_count": 3})
missing = [field for field in (
    "wobbleScore", "walkDurationSeconds", "meanDeviationPct", "pathEfficiencyPct",
    "directionChanges", "driftDirection", "score",
) if summary.get(field) is None]
check("report summary exposes every field the shell renders", not missing, f"missing/None: {missing}")
check("a steady walk earns close to the full 25 points", summary["score"] > 23.5, str(summary["score"]))
degraded = summarize_wobblewalk(too_short)
check("a refused walk renders a reason without a behavioral score",
      degraded.get("available") is False and degraded.get("score") is None and bool(degraded.get("reason")),
      str(degraded))

print()
if failures:
    print(f"{len(failures)} check(s) failed: {failures}")
    raise SystemExit(1)
print("all checks passed")
