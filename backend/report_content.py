"""Wording for the final participant report.

Kept separate from report.py on purpose: report.py owns measurement and
scoring, this module owns language. Nothing in here may describe a
participant's health, attach a condition to them, or read as a screening
result. Every phrase describes what four short games measured.

Selections are seeded with the session id rather than left to chance, so a
participant's on-screen report and their downloaded PDF always agree. Two
different sessions still draw two different sets.
"""
from __future__ import annotations

import random

# ---------------------------------------------------------------------------
# Overall-score interpretation
# ---------------------------------------------------------------------------
# (inclusive lower bound as a percentage, key, headline, short comment, body)
INTERPRETATION_BANDS = (
    (
        85.0,
        "very-high",
        "Consistently on target",
        "A steady run, station to station.",
        "Your measurements sat close to each activity's target across all four "
        "stations, and stayed there from the first station to the last. That "
        "describes a consistent run today, and nothing beyond it.",
    ),
    (
        70.0,
        "high",
        "Generally consistent",
        "Mostly close to target, with a livelier moment or two.",
        "Most measurements sat near their activity's target, with one or two "
        "stations drifting further than the rest. Runs in this range tend to "
        "look settled overall with a few busier stretches.",
    ),
    (
        50.0,
        "middle",
        "Mixed, with visible variation",
        "Some stations close to target, others further out.",
        "Your results were mixed: some stations landed close to their target "
        "while others varied noticeably. Short activities like these move "
        "around a lot between attempts, so a mixed spread is ordinary.",
    ),
    (
        30.0,
        "lower",
        "Several noticeable deviations",
        "Several measurements landed well away from target.",
        "Several measurements sat well away from their activity's target, and "
        "the four stations agreed with each other less than they usually do. "
        "That is a description of four short games, not of the person playing "
        "them.",
    ),
    (
        0.0,
        "very-low",
        "Substantial deviation across most stations",
        "Most measurements landed far from target.",
        "Most measurements sat far from their activity's target. Tiredness, "
        "lighting, where the camera was pointing, and simply finding the "
        "activities funny all push these numbers around, so read this as a "
        "snapshot of one run on one day.",
    ),
)


def interpret_overall(score, max_score: float = 100.0) -> dict | None:
    """Map a finished overall score onto a neutral, observational comment."""
    if score is None:
        return None
    try:
        percentage = 100.0 * float(score) / float(max_score or 100.0)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    for lower_bound, key, headline, comment, body in INTERPRETATION_BANDS:
        if percentage >= lower_bound:
            return {"band": key, "headline": headline, "comment": comment, "body": body}
    return None


# ---------------------------------------------------------------------------
# Research context (final page)
# ---------------------------------------------------------------------------
# Where signals of this general kind are studied. Presented as a list of
# research directions, never as a list of things measured about the reader.
# "Schziophrenia" in the source list was an obvious typo and is corrected.
RESEARCH_LINES = (
    "ASD detection using GAIT, the way you walked",
    "ASD detection using MRI",
    "ASD detection using speech",
    "ASD detection using eye movement",
    "Schizophrenia detection using eye movement",
    "Schizophrenia detection using MRI",
    "Schizophrenia detection using EEG",
    "Schizophrenia detection using speech",
    "Depression detection using speech",
)

RESEARCH_INTRO = (
    "Signals in the same family as the ones you just played with are studied "
    "seriously elsewhere. A rotating sample of those research directions:"
)

# Short, plain, participant-facing facts. Each line is about the research
# field or the condition in general terms — never about the reader. Drawn one
# per pool so every report mentions both conditions without ever connecting
# them to the person holding the report.
AWARENESS_ASD = (
    "Autism spectrum disorder is a developmental difference in how people "
    "communicate, socialise and process the world around them.",
    "Autism is a spectrum: two autistic people can have very little in common "
    "with each other, which is part of why single measurements say so little.",
    "Autism is usually identified through long, in-person developmental "
    "assessment by trained clinicians, not through short tasks or one-off tests.",
    "Many autistic people describe differences in how they take in sensory "
    "detail — sound, light, texture — alongside differences in social "
    "communication.",
)

AWARENESS_SCHIZOPHRENIA = (
    "Schizophrenia is a mental health condition that can affect thinking, "
    "perception and motivation, and it is treatable and manageable with support.",
    "Schizophrenia typically emerges in late adolescence or early adulthood, "
    "and early support is associated with better long-term outcomes.",
    "Diagnosing schizophrenia takes clinical interviews over time. No camera, "
    "reaction test or walking task can do it.",
    "Public ideas about schizophrenia are often shaped by fiction; most people "
    "living with it are not dangerous and do get on with ordinary life.",
)

AWARENESS_GENERAL = (
    "Research into both conditions is moving toward many weak signals combined "
    "carefully, rather than any single decisive test.",
    "Behavioural differences are common across the whole population, which is "
    "exactly why a difference on its own carries no clinical meaning.",
    "The value of awareness activities like this one is curiosity about the "
    "research, not conclusions about the people who take part.",
)

# Per-station note on where this class of signal genuinely gets used.
STATION_RESEARCH_NOTES = {
    "timer": "Attention under a visible deadline — how often focus leaves the "
             "task to check the clock — is studied in attention research.",
    "gaze": "Where a person looks first, and how long their gaze stays there, "
            "is a long-standing signal in eye-movement research on attention "
            "and memory.",
    "deadpan": "The timing and intensity of facial expression is studied as a "
               "measure of expressivity and voluntary control.",
    "wobblewalk": "Gait and postural sway are measured in movement science "
                  "because walking is a demanding, heavily practised motor task.",
}

RESEARCH_CAVEAT = (
    "Same family of signal, serious use elsewhere. None of the numbers on this "
    "card are a screening result."
)


def _seeded(seed, salt: str) -> random.Random:
    return random.Random("{}::{}".format(seed or "", salt))


def pick_research_lines(seed, count: int = 4) -> list:
    """Exactly ``count`` distinct research directions, stable for a session."""
    pool = list(RESEARCH_LINES)
    count = max(0, min(int(count), len(pool)))
    return _seeded(seed, "research").sample(pool, count)


def pick_awareness_lines(seed) -> list:
    """One ASD line, one schizophrenia line, one general line."""
    lines = []
    for salt, pool in (
        ("awareness-asd", AWARENESS_ASD),
        ("awareness-scz", AWARENESS_SCHIZOPHRENIA),
        ("awareness-general", AWARENESS_GENERAL),
    ):
        if pool:
            lines.append(_seeded(seed, salt).choice(list(pool)))
    return lines
