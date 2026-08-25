"""Screen-space path metrics for the WobbleWalk game.

A hip-centred 3D skeleton cannot retain a person's route through the camera
frame. This module scores MediaPipe image-landmark hip centres, normalized by
the player's shoulder width.
"""
from __future__ import annotations

import numpy as np


def _smooth(values: np.ndarray, window: int) -> np.ndarray:
    if window <= 1:
        return values.copy()
    if window % 2 == 0:
        window += 1
    window = min(window, len(values) if len(values) % 2 else len(values) - 1)
    if window < 3:
        return values.copy()
    pad = window // 2
    kernel = np.ones(window, dtype=float) / window
    return np.column_stack([
        np.convolve(np.pad(values[:, axis], (pad, pad), mode="edge"), kernel, mode="valid")
        for axis in range(values.shape[1])
    ])


def _unavailable(reason: str, tracked_frames: int = 0) -> dict:
    return {
        "available": False,
        "reason": reason,
        "tracked_frames": int(tracked_frames),
    }


def calculate_game_metrics(samples, fps: float) -> dict:
    """Calculate lateral deviation from ``(x, y, shoulder_width)`` samples.

    Coordinates are MediaPipe normalized image coordinates. The fitted path is
    the best straight line through the walking segment; orthogonal error to that
    line becomes the wobble measurement.
    """
    data = np.asarray(samples, dtype=float)
    if data.ndim != 2 or data.shape[1] != 3:
        return _unavailable("Trajectory samples were not available.")

    valid = np.isfinite(data).all(axis=1) & (data[:, 2] > 0.01)
    tracked = int(valid.sum())
    if tracked < 12:
        return _unavailable("Not enough full-body frames to score the walk.", tracked)

    frame_ids = np.arange(len(data))
    filled = np.empty_like(data)
    for axis in range(3):
        filled[:, axis] = np.interp(frame_ids, frame_ids[valid], data[valid, axis])

    effective_fps = max(float(fps or 30.0), 1.0)
    smooth_window = max(3, int(round(effective_fps * 0.35)))
    path_all = _smooth(filled[:, :2], smooth_window)
    scale_all = _smooth(filled[:, 2:3], smooth_window)[:, 0]
    body_scale = float(np.median(scale_all[valid]))
    if not np.isfinite(body_scale) or body_scale <= 0.01:
        return _unavailable("The player's body scale could not be measured.", tracked)

    # Spins generally happen in place. Start scoring once the hip centre makes a
    # short, sustained move away from its opening position.
    opening_n = min(len(path_all), max(5, int(round(effective_fps * 0.7))))
    origin = np.median(path_all[:opening_n], axis=0)
    moved = np.linalg.norm(path_all - origin, axis=1) > max(0.018, body_scale * 0.14)
    sustained_n = max(3, int(round(effective_fps * 0.25)))
    sustained = np.convolve(moved.astype(int), np.ones(sustained_n, dtype=int), mode="same")
    candidates = np.flatnonzero(sustained >= sustained_n)
    onset = max(0, int(candidates[0]) - smooth_window) if len(candidates) else 0

    path = path_all[onset:]
    scales = scale_all[onset:]
    if len(path) < 10:
        return _unavailable("The walking section was too short to score.", tracked)

    centred = path - path.mean(axis=0)
    _, singular, vectors = np.linalg.svd(centred, full_matrices=False)
    if not len(singular) or singular[0] < 1e-4:
        return _unavailable("No clear walking path was detected.", tracked)

    direction = vectors[0]
    if np.dot(path[-1] - path[0], direction) < 0:
        direction = -direction
    normal = np.array([-direction[1], direction[0]])
    if normal[0] < 0:  # Positive offset should consistently mean screen-right.
        normal = -normal

    along = centred @ direction
    lateral = centred @ normal
    abs_lateral = np.abs(lateral)
    segment_scale = max(float(np.median(scales)), 0.01)
    mean_body = float(abs_lateral.mean() / segment_scale)
    max_body = float(abs_lateral.max() / segment_scale)

    steps = np.linalg.norm(np.diff(path, axis=0), axis=1)
    travelled = float(steps.sum())
    direct = float(np.linalg.norm(path[-1] - path[0]))
    efficiency = float(np.clip(direct / travelled, 0.0, 1.0)) if travelled > 1e-6 else 0.0

    deadzone = segment_scale * 0.06
    signed = np.where(lateral > deadzone, 1, np.where(lateral < -deadzone, -1, 0))
    nonzero = signed[signed != 0]
    direction_changes = int(np.sum(nonzero[1:] != nonzero[:-1])) if len(nonzero) > 1 else 0

    final_offset = float(np.mean(lateral[-max(3, len(lateral) // 5):]))
    if abs(final_offset) <= segment_scale * 0.05:
        drift = "center"
    else:
        drift = "right" if final_offset > 0 else "left"

    # Each component reaches its cap at a deliberately noticeable game-level
    # wobble. This is a fun performance score, not a medical measurement.
    score = 100.0 * np.clip(
        0.45 * min(mean_body / 0.24, 1.0)
        + 0.30 * min(max_body / 0.65, 1.0)
        + 0.25 * min((1.0 - efficiency) / 0.30, 1.0),
        0.0,
        1.0,
    )

    along_span = max(float(np.ptp(along)), 1e-5)
    route_stride = max(1, len(path) // 42)
    route_indexes = list(range(0, len(path), route_stride))
    if route_indexes[-1] != len(path) - 1:
        route_indexes.append(len(path) - 1)
    lateral_span = max(segment_scale * 1.4, float(abs_lateral.max()) * 1.15, 0.04)
    route = [
        {
            "x": round(float(np.clip(50 + 40 * lateral[i] / lateral_span, 7, 93)), 2),
            "y": round(float(np.clip(92 - 84 * (along[i] - along.min()) / along_span, 8, 92)), 2),
        }
        for i in route_indexes
    ]

    return {
        "available": True,
        "wobble_score": round(float(score), 1),
        "mean_deviation_pct": round(mean_body * 100, 1),
        "max_deviation_pct": round(max_body * 100, 1),
        "path_efficiency_pct": round(efficiency * 100, 1),
        "direction_changes": direction_changes,
        "drift_direction": drift,
        "walk_duration_seconds": round(len(path) / effective_fps, 1),
        "walk_distance_body_widths": round(travelled / segment_scale, 1),
        "tracked_frames": tracked,
        "route": route,
        "measurement_unit": "percent of shoulder width",
    }
