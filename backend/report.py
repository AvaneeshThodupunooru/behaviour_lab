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
        "note": "Experimental behavioral score, not a clinical measure.",
    }


def summarize_gaze(result: dict) -> dict:
    r = result or {}
    return {
        "label": "Gaze Task Performance",
        "imagesViewed": r.get("imageCount"),
        "gazeSamplesCollected": r.get("sampleCount"),
    }


def summarize_wobblewalk(result: dict) -> dict:
    r = result or {}
    if r.get("available") is False:
        return {"label": "Walking Stability / Path Metrics", "available": False, "reason": r.get("reason")}
    return {
        "label": "Walking Stability / Path Metrics",
        "walkDurationSeconds": r.get("walk_duration_seconds"),
        "meanDeviationPct": _round(r.get("mean_deviation_pct")),
        "pathEfficiencyPct": _round(r.get("path_efficiency_pct")),
        "directionChanges": r.get("direction_changes"),
        "driftDirection": r.get("drift_direction"),
        "note": "Game performance score only, not a medical or balance assessment.",
    }


def summarize_deadpan(result: dict) -> dict:
    r = result or {}
    return {
        "label": "Facial Expression Response",
        "laughCount": r.get("laughCount"),
        "peakScorePct": _round(r.get("peakScorePct")),
        "durationSeconds": r.get("durationSeconds"),
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
    for key, summarizer in SUMMARIZERS.items():
        game_state = games.get(key) or {}
        if game_state.get("status") == "completed":
            games_completed.append(key)
            summary[key] = summarizer(game_state.get("result") or {})
    return {
        "session_id": session_doc.get("session_id"),
        "participant": session_doc.get("participant"),
        "started_at": session_doc.get("started_at"),
        "completed_at": session_doc.get("completed_at"),
        "games_completed": games_completed,
        "disclaimer": DISCLAIMER,
        "summary": summary,
    }
