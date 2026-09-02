"""Turns stored raw per-game results into the neutral final-report summary
that the event shell renders.

Deliberately uses plain, non-clinical labels and does not invent thresholds
or interpretations - see the games' own disclaimers, which are preserved
verbatim where the game already included one.
"""
from __future__ import annotations

import math
from statistics import median

DISCLAIMER = (
    "These are game-performance metrics from short, informal activities. "
    "They are not a diagnosis, clinical assessment, or medical evaluation of any kind."
)


SCORING_CONFIG = {
    # These initial scales are deliberately centralized so pilot-derived
    # parameters can replace them without touching game or report code.
    "pressure_clock": {
        "weights": {
            "accuracy": 0.30,
            "reaction_efficiency": 0.20,
            "reaction_consistency": 0.15,
            "performance_stability": 0.15,
            "pressure_regulation": 0.20,
        },
        "reaction_time_scale_ms": 2600.0,
        "reaction_cv_scale": 0.55,
        "performance_decline_scale": 0.35,
        "checks_per_minute_scale": 18.0,
        "late_check_surge_scale": 2.0,
        "switches_per_minute_scale": 24.0,
    },
    "deadpan": {
        # The station currently records count, duration, and one peak per
        # confirmed laugh. Keep the weighting aligned with those observations.
        "weights": {"frequency": 0.45, "robust_peak": 0.35, "typical_peak": 0.20},
        "laughs_per_minute_scale": 6.0,
        "default_duration_seconds": 46.0,
        "peak_percentile": 0.80,
    },
    "wobblewalk": {
        "weights": {
            "mean_deviation": 0.35,
            "peak_deviation": 0.20,
            "path_inefficiency": 0.20,
            "direction_changes": 0.10,
            "final_drift": 0.10,
            "trajectory_variability": 0.05,
        },
        "mean_deviation_scale": 0.20,
        "peak_deviation_scale": 0.55,
        "path_inefficiency_scale": 0.25,
        "direction_change_scale": 4.0,
        "trajectory_curvature_scale": 0.12,
        "final_drift_scale": 0.20,
    },
    "gaze": {
        "weights": {"recall": 0.85, "response_behavior": 0.15},
        "response_target_ms": 2500.0,
        "response_deviation_scale_ms": 2500.0,
    },
}


def _round(value, digits=2):
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return value


def _number(value, default=0.0):
    number = _finite_number(value)
    return number if number is not None else default


def _clip(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def _finite_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _exp_score(value, scale):
    """Smoothly maps a non-negative penalty to [0, 1]."""
    return math.exp(-max(0.0, _number(value)) / max(_number(scale, 1.0), 1e-12))


def _percentile(values, percentile):
    if not values:
        return 0.0
    ordered = sorted(values)
    position = _clip(percentile) * (len(ordered) - 1)
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def _reaction_times(result):
    values = []
    for round_data in (result or {}).get("rounds") or []:
        for trial in round_data.get("trials") or []:
            reaction_time = _finite_number(trial.get("reactionTimeMs"))
            if reaction_time is not None and reaction_time >= 0:
                values.append(reaction_time)
    return values


def _route_curvature(route):
    """Robust bend measure from the existing, down-sampled route payload."""
    x_values = []
    for point in route or []:
        x_value = _finite_number((point or {}).get("x"))
        if x_value is not None:
            x_values.append(x_value / 100.0)
    if len(x_values) < 3:
        return 0.0
    first_differences = [x_values[i + 1] - x_values[i] for i in range(len(x_values) - 1)]
    bends = [abs(first_differences[i + 1] - first_differences[i]) for i in range(len(first_differences) - 1)]
    return _percentile(bends, 0.50)


def _route_lateral_offsets(route):
    """Return existing replay-route lateral offsets as fractions of its box."""
    return [
        abs(_finite_number((point or {}).get("x")) - 50.0) / 40.0
        for point in route or []
        if _finite_number((point or {}).get("x")) is not None
    ]


def _route_final_drift(route):
    offsets = _route_lateral_offsets(route)
    if not offsets:
        return 0.0
    tail_size = max(1, math.ceil(len(offsets) * 0.20))
    return _percentile(offsets[-tail_size:], 0.50)


def score_gaze(result: dict):
    """Score recall, with optional smooth response behavior if recorded."""
    r = result or {}
    questions = r.get("questionResults") or []
    if not questions:
        return None

    config = SCORING_CONFIG["gaze"]
    recall = sum(1 for q in questions if q.get("correct")) / len(questions)
    response_times = [
        value for value in (_finite_number(q.get("responseTimeMs")) for q in questions)
        if value is not None and value >= 0
    ]
    if response_times:
        response_behavior = sum(
            _exp_score(abs(value - config["response_target_ms"]), config["response_deviation_scale_ms"])
            for value in response_times
        ) / len(response_times)
        normalized = (
            config["weights"]["recall"] * recall
            + config["weights"]["response_behavior"] * response_behavior
        )
    else:
        # The current game does not record answer times, so missing optional
        # data must not reduce an otherwise objective recall score.
        normalized = recall
    return 25.0 * _clip(normalized)


def score_timer(result: dict) -> float:
    """Score existing Pressure Clock data with smooth, robust components."""
    metrics = (result or {}).get("metrics", {}) or {}
    reaction_times = _reaction_times(result)
    if not metrics or not reaction_times:
        return None

    config = SCORING_CONFIG["pressure_clock"]
    weights = config["weights"]
    accuracy = _clip(_number(metrics.get("accuracy")))

    median_rt = _finite_number(metrics.get("medianReactionTimeMs"))
    mean_rt = _finite_number(metrics.get("meanReactionTimeMs"))
    median_rt = median_rt if median_rt is not None else median(reaction_times)
    mean_rt = mean_rt if mean_rt is not None else sum(reaction_times) / len(reaction_times)
    robust_reaction_time = 0.70 * median_rt + 0.30 * mean_rt
    reaction_efficiency = _exp_score(robust_reaction_time, config["reaction_time_scale_ms"])

    median_absolute_deviation = median(abs(value - median_rt) for value in reaction_times)
    robust_sigma = 1.4826 * median_absolute_deviation
    coefficient_of_variation = robust_sigma / max(median_rt, 100.0)
    reaction_consistency = _exp_score(coefficient_of_variation, config["reaction_cv_scale"])

    performance_delta = _number(metrics.get("performanceDelta"))
    performance_stability = _exp_score(max(-performance_delta, 0.0), config["performance_decline_scale"])

    checks_penalty = 1.0 - _exp_score(_number(metrics.get("checksPerMinute")), config["checks_per_minute_scale"])
    late_surge = max(_number(metrics.get("deadlineSensitivityRatio")) - 1.0, 0.0)
    late_surge_penalty = 1.0 - _exp_score(late_surge, config["late_check_surge_scale"])
    switching_penalty = 1.0 - _exp_score(_number(metrics.get("attentionSwitchesPerMinute")), config["switches_per_minute_scale"])
    pressure_regulation = 1.0 - (0.40 * checks_penalty + 0.35 * late_surge_penalty + 0.25 * switching_penalty)

    normalized = (
        weights["accuracy"] * accuracy
        + weights["reaction_efficiency"] * reaction_efficiency
        + weights["reaction_consistency"] * reaction_consistency
        + weights["performance_stability"] * performance_stability
        + weights["pressure_regulation"] * pressure_regulation
    )
    return 25.0 * _clip(normalized)


def score_deadpan(result: dict) -> float:
    """Score existing confirmed laughs without a hard count cutoff."""
    r = result or {}
    if not r or not any(key in r for key in ("laughCount", "peakScorePct", "log")):
        return None
    config = SCORING_CONFIG["deadpan"]
    weights = config["weights"]
    laugh_count = max(_number(r.get("laughCount")), 0.0)
    duration = _finite_number(r.get("durationSeconds"))
    duration = duration if duration is not None and duration > 0 else config["default_duration_seconds"]
    laughs_per_minute = laugh_count * 60.0 / duration
    frequency_penalty = 1.0 - _exp_score(laughs_per_minute, config["laughs_per_minute_scale"])

    peaks = [
        _clip(_number(entry.get("peak")) / 100.0)
        for entry in r.get("log") or []
        if _finite_number(entry.get("peak")) is not None
    ]
    robust_peak_penalty = _percentile(peaks, config["peak_percentile"])
    typical_peak_penalty = sum(peaks) / len(peaks) if peaks else _clip(_number(r.get("peakScorePct")) / 100.0)
    total_penalty = (
        weights["frequency"] * frequency_penalty
        + weights["robust_peak"] * robust_peak_penalty
        + weights["typical_peak"] * typical_peak_penalty
    )
    return 25.0 * (1.0 - _clip(total_penalty))


def score_wobblewalk(result: dict):
    """Score the walking stability task out of 25."""
    r = result or {}
    if r.get("available") is False:
        return None
    required = ("mean_deviation_pct", "max_deviation_pct", "path_efficiency_pct", "direction_changes")
    if any(_finite_number(r.get(key)) is None for key in required):
        return None

    config = SCORING_CONFIG["wobblewalk"]
    weights = config["weights"]
    mean_deviation = max(_number(r.get("mean_deviation_pct")) / 100.0, 0.0)
    max_deviation = max(_number(r.get("max_deviation_pct")) / 100.0, 0.0)
    route_offsets = _route_lateral_offsets(r.get("route"))
    if route_offsets and max(route_offsets) > 0:
        # The route is already normalized from the original trajectory. Its
        # 95th percentile makes the peak component resistant to one bad frame.
        peak_deviation = max_deviation * min(
            _percentile(route_offsets, 0.95) / max(route_offsets), 1.0
        )
    else:
        peak_deviation = max_deviation
    path_inefficiency = 1.0 - _clip(_number(r.get("path_efficiency_pct")) / 100.0)
    direction_changes = max(_number(r.get("direction_changes")), 0.0)

    mean_penalty = 1.0 - _exp_score(mean_deviation, config["mean_deviation_scale"])
    peak_penalty = 1.0 - _exp_score(peak_deviation, config["peak_deviation_scale"])
    inefficiency_penalty = 1.0 - _exp_score(path_inefficiency, config["path_inefficiency_scale"])
    direction_penalty = 1.0 - _exp_score(direction_changes, config["direction_change_scale"])
    final_drift = _route_final_drift(r.get("route"))
    final_drift_penalty = 1.0 - _exp_score(final_drift, config["final_drift_scale"])
    curvature_penalty = 1.0 - _exp_score(_route_curvature(r.get("route")), config["trajectory_curvature_scale"])
    total_penalty = (
        weights["mean_deviation"] * mean_penalty
        + weights["peak_deviation"] * peak_penalty
        + weights["path_inefficiency"] * inefficiency_penalty
        + weights["direction_changes"] * direction_penalty
        + weights["final_drift"] * final_drift_penalty
        + weights["trajectory_variability"] * curvature_penalty
    )
    return 25.0 * (1.0 - _clip(total_penalty))


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
    questions = r.get("questionResults") or []
    correct = sum(1 for q in questions if q.get("correct"))
    return {
        "label": "Visual Memory & Gaze Task",
        "imagesViewed": r.get("imageCount"),
        "gazeSamplesCollected": r.get("sampleCount"),
        "recallScore": f"{correct}/{len(questions)}" if questions else None,
        "score": _round(score_gaze(result)),
        "note": "Recall questions are scored objectively; gaze sample count is shown as a tracking-quality signal, not a medical measure.",
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


def summarize_wobblewalk(result: dict) -> dict:
    r = result or {}
    if r.get("available") is False:
        return {
            "label": "Walking Stability / Path Metrics",
            "available": False,
            "reason": r.get("reason"),
            "score": None,
        }
    return {
        "label": "Walking Stability / Path Metrics",
        "wobbleScore": _round(r.get("wobble_score")),
        "walkDurationSeconds": r.get("walk_duration_seconds"),
        "meanDeviationPct": _round(r.get("mean_deviation_pct")),
        "pathEfficiencyPct": _round(r.get("path_efficiency_pct")),
        "directionChanges": r.get("direction_changes"),
        "driftDirection": r.get("drift_direction"),
        "score": _round(score_wobblewalk(result)),
        "note": "Game performance score only, not a medical or balance assessment.",
    }


SUMMARIZERS = {
    "timer": summarize_timer,
    "gaze": summarize_gaze,
    "deadpan": summarize_deadpan,
    "wobblewalk": summarize_wobblewalk,
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
            score = summary[key].get("score")
            if isinstance(score, (int, float)) and math.isfinite(score):
                scores.append(score)
    overall_score = _round(sum(scores)) if len(games_completed) == len(SUMMARIZERS) and len(scores) == len(SUMMARIZERS) else None
    return {
        "session_id": session_doc.get("session_id"),
        "participant": session_doc.get("participant"),
        "started_at": session_doc.get("started_at"),
        "completed_at": session_doc.get("completed_at"),
        "games_completed": games_completed,
        "overall_score": overall_score,
        "max_score": 100,
        "disclaimer": DISCLAIMER,
        "summary": summary,
    }
