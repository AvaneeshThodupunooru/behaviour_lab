"""Turns stored raw per-game results into the neutral final-report summary
that the event shell renders.

Deliberately uses plain, non-clinical labels and does not invent thresholds
or interpretations - see the games' own disclaimers, which are preserved
verbatim where the game already included one.
"""
from __future__ import annotations

DISCLAIMER = (
    "These are game-performance metrics from short, informal activities. "
    "They are not a diagnosis, clinical assessment, or medical evaluation of any kind."
)


def _round(value, digits=1):
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return value


def _number(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clip(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def score_gaze(result: dict) -> float:
    """Score gaze-task engagement from the samples already collected."""
    sample_count = _number((result or {}).get("sampleCount"))
    return 25 * _clip(sample_count / 500)


def score_timer(result: dict) -> float:
    """Score timer-game performance from its existing aggregate metrics."""
    metrics = (result or {}).get("metrics", {}) or {}
    accuracy = _clip(_number(metrics.get("accuracy")))
    reaction_time = _clip(_number(metrics.get("meanReactionTimeMs")) / 3000)
    pressure_index = _clip(_number(metrics.get("pressureIndex")) / 100)
    performance = 0.6 * accuracy + 0.4 * (1 - reaction_time)
    composure = 1 - pressure_index
    return 25 * (0.6 * performance + 0.4 * composure)


def score_deadpan(result: dict) -> float:
    """Score the game's existing facial-response inputs, when supplied."""
    r = result or {}
    # DEADPAN currently receives placeholder/stub inputs while real video
    # detection is being wired. These values become meaningful automatically
    # once that detector supplies the existing fields; no scoring change needed.
    intensity = _clip(0.5 * (_number(r.get("laughCount")) / 5) + 0.5 * (_number(r.get("peakScorePct")) / 100))
    return 25 * (1 - intensity)


def score_wobblewalk(result: dict) -> float:
    """Score the existing route-deviation and path-efficiency metrics."""
    r = result or {}
    if r.get("available") is False:
        return 0.0
    deviation = _clip(_number(r.get("mean_deviation_pct")) / 100)
    efficiency = _clip(_number(r.get("path_efficiency_pct")), 0, 100) / 100
    return 25 * (0.5 * (1 - deviation) + 0.5 * efficiency)


def summarize_timer(result: dict) -> dict:
    m = (result or {}).get("metrics", {}) or {}
    return {
        "label": "Timer Attention & Visual Search Performance",
        "accuracy": m.get("accuracy"),
        "meanReactionTimeMs": _round(m.get("meanReactionTimeMs")),
        "reactionTimeVariabilityMs": _round(m.get("stddevReactionTimeMs")),
        "timerChecksPerMinute": _round(m.get("checksPerMinute")),
        "attentionSwitchesPerMinute": _round(m.get("attentionSwitchesPerMinute")),
        "pressureIndex": m.get("pressureIndex"),
        "score": _round(score_timer(result)),
        "note": "Experimental behavioral score, not a clinical measure.",
    }


def summarize_gaze(result: dict) -> dict:
    r = result or {}
    return {
        "label": "Gaze Task Performance",
        "imagesViewed": r.get("imageCount"),
        "gazeSamplesCollected": r.get("sampleCount"),
        "score": _round(score_gaze(result)),
    }


def summarize_wobblewalk(result: dict) -> dict:
    r = result or {}
    if r.get("available") is False:
        return {
            "label": "Walking Stability / Path Metrics",
            "available": False,
            "reason": r.get("reason"),
            "score": _round(score_wobblewalk(result)),
            "note": "No path metrics were available, so this game-performance score is 0.",
        }
    return {
        "label": "Walking Stability / Path Metrics",
        "walkDurationSeconds": r.get("walk_duration_seconds"),
        "meanDeviationPct": _round(r.get("mean_deviation_pct")),
        "pathEfficiencyPct": _round(r.get("path_efficiency_pct")),
        "directionChanges": r.get("direction_changes"),
        "driftDirection": r.get("drift_direction"),
        "score": _round(score_wobblewalk(result)),
        "note": "Game performance score only, not a medical or balance assessment.",
    }


def summarize_deadpan(result: dict) -> dict:
    r = result or {}
    return {
        "label": "Facial Expression Response",
        "laughCount": r.get("laughCount"),
        "peakScorePct": _round(r.get("peakScorePct")),
        "durationSeconds": r.get("durationSeconds"),
        "score": _round(score_deadpan(result)),
    }


SUMMARIZERS = {
    "timer": summarize_timer,
    "gaze": summarize_gaze,
    "wobblewalk": summarize_wobblewalk,
    "deadpan": summarize_deadpan,
}


def build_report(session_doc: dict) -> dict:
    games = session_doc.get("games", {}) or {}
    summary = {}
    games_completed = []
    scores = []
    for key, summarizer in SUMMARIZERS.items():
        game_state = games.get(key) or {}
        if game_state.get("status") == "completed":
            games_completed.append(key)
            summary[key] = summarizer(game_state.get("result") or {})
            scores.append(summary[key]["score"])
    return {
        "session_id": session_doc.get("session_id"),
        "participant": session_doc.get("participant"),
        "started_at": session_doc.get("started_at"),
        "completed_at": session_doc.get("completed_at"),
        "games_completed": games_completed,
        "overall_score": _round(sum(scores)) if len(games_completed) == len(SUMMARIZERS) else None,
        "max_score": 100,
        "disclaimer": DISCLAIMER,
        "summary": summary,
    }
