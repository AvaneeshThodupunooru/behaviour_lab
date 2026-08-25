"""Extract a screen-space walking path from an uploaded video."""
from __future__ import annotations

import numpy as np

from .game_metrics import calculate_game_metrics

MAX_PROCESSED_FRAMES = 600


def extract_game_metrics(path: str, model_complexity: int = 1) -> tuple[dict, dict]:
    import cv2
    import mediapipe as mp

    capture = cv2.VideoCapture(path)
    if not capture.isOpened():
        raise ValueError("The uploaded video could not be opened.")

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 30.0)
    if not np.isfinite(fps) or fps <= 0:
        fps = 30.0

    if total_frames > MAX_PROCESSED_FRAMES:
        process_indexes = set(
            np.linspace(0, total_frames - 1, MAX_PROCESSED_FRAMES).astype(int).tolist()
        )
        effective_fps = fps * MAX_PROCESSED_FRAMES / total_frames
    else:
        process_indexes = None
        effective_fps = fps

    samples: list[tuple[float, float, float]] = []
    frame_index = -1
    detected = 0
    pose = mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=model_complexity,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            frame_index += 1
            if process_indexes is not None and frame_index not in process_indexes:
                continue

            result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            landmarks = result.pose_landmarks.landmark if result.pose_landmarks else None
            if landmarks:
                relevant = (landmarks[11], landmarks[12], landmarks[23], landmarks[24])
                if min(point.visibility for point in relevant) >= 0.45:
                    hip_x = (landmarks[23].x + landmarks[24].x) / 2.0
                    hip_y = (landmarks[23].y + landmarks[24].y) / 2.0
                    shoulder_width = float(np.hypot(
                        landmarks[11].x - landmarks[12].x,
                        landmarks[11].y - landmarks[12].y,
                    ))
                    samples.append((hip_x, hip_y, shoulder_width))
                    detected += 1
                    continue
            samples.append((np.nan, np.nan, np.nan))
    finally:
        pose.close()
        capture.release()

    if not samples:
        raise ValueError("The video did not contain readable frames.")

    metrics = calculate_game_metrics(samples, effective_fps)
    meta = {
        "total_frames": total_frames,
        "processed_frames": len(samples),
        "detected_frames": detected,
        "detection_rate": round(detected / max(1, len(samples)), 3),
        "fps": round(effective_fps, 2),
    }
    return metrics, meta
