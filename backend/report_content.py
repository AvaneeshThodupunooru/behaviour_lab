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
RESEARCH_LINES = (
    "ASD research using gait and postural movement",
    "ASD research using eye movement and visual attention",
    "ASD research using facial expression and social attention",
    "ASD research using visual search and memory",
    "ASD research using coordination and motor planning",
    "Schizophrenia research using eye movement and visual attention",
    "Schizophrenia research using gait and postural movement",
    "Schizophrenia research using facial expression and social attention",
    "Schizophrenia research using visual search and memory",
    "Schizophrenia research using coordination and motor planning",
    "Research combining attention, movement, and expression signals",
    "Research on how visual attention changes across demanding tasks",
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
    "Researchers study gaze patterns in autism as one possible part of a much "
    "larger picture of attention and social information processing.",
    "Movement research in autism can examine coordination and posture, but "
    "variation between individuals is large and no single pattern is decisive.",
    "Autistic people have different strengths, preferences, and support needs; "
    "a short activity cannot represent that full range.",
    "A research finding about groups does not predict how any one autistic "
    "person will look, move, communicate, or experience a task.",
    "Good autism research includes autistic perspectives and treats people as "
    "people first, not as a collection of measurements.",
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
    "Some studies examine eye movements in schizophrenia to learn about broad "
    "attention and prediction processes, not to make a diagnosis from a glance.",
    "Gait and posture research can describe movement differences across groups, "
    "while medication, fatigue, health, and environment can all affect movement.",
    "People living with schizophrenia have varied experiences and abilities, "
    "so group-level research never defines an individual.",
    "Clinical assessment considers history, context, and change over time rather "
    "than relying on one score or one behavioural task.",
    "Recovery and quality of life are supported by respectful care, practical "
    "support, and the person's own goals.",
)

AWARENESS_GENERAL = (
    "Research into both conditions is moving toward many weak signals combined "
    "carefully, rather than any single decisive test.",
    "Behavioural differences are common across the whole population, which is "
    "exactly why a difference on its own carries no clinical meaning.",
    "The value of awareness activities like this one is curiosity about the "
    "research, not conclusions about the people who take part.",
)


def _feedback_pool(leads, endings):
    return tuple(
        "{} {}".format(lead, ending)
        for lead in leads
        for ending in endings
    )


WOBBLE_FEEDBACK_POOLS = {
    "0-25": _feedback_pool(
        ("This walk had a lot of movement away from the reference line.",
         "The path wandered noticeably during this attempt.",
         "Your route showed plenty of side-to-side variation.",
         "The walk took a visibly indirect shape.",
         "This run finished with substantial variation in the path.",
         "The tracked route was lively from one moment to the next.",
         "The reference line was a difficult target in this attempt.",
         "Your path changed direction often across the walk.",
         "The route covered more ground than a straight line would require.",
         "This attempt showed a broad spread around the intended path."),
        ("That is one snapshot of one short activity.",
         "A different room, pace, or camera position could change the result.",
         "The number describes this route, not your balance as a person.",
         "Short movement tasks can vary substantially between attempts.",
         "The score is a game metric rather than a health assessment.")),
    "26-50": _feedback_pool(
        ("Your walk showed some clear departures from the reference line.",
         "The route was uneven, with stretches that came back toward centre.",
         "This attempt mixed steadier sections with noticeable corrections.",
         "The path was partly controlled and partly exploratory.",
         "Your route kept moving, while still returning toward the target.",
         "The walk showed moderate side-to-side change.",
         "Several parts of the route stayed near the line; others opened out.",
         "This was a mixed movement pattern across the measured distance.",
         "The path made a few meaningful corrections along the way.",
         "Your route sat between a straight walk and a highly wandering one."),
        ("The result is specific to this attempt and its surroundings.",
         "Lighting, footwear, pace, and camera placement can all matter here.",
         "It is a description of the route, not a conclusion about you.",
         "Repeating the activity could produce a different pattern.",
         "This score is an experimental game measure, not a clinical reading.")),
    "51-75": _feedback_pool(
        ("Your route stayed reasonably close to the reference for much of the walk.",
         "The walk showed a useful balance between correction and forward motion.",
         "Several stretches of the path looked settled and intentional.",
         "Your movement was fairly consistent across the measured distance.",
         "The route kept a workable relationship with the centre line.",
         "This attempt combined steady sections with a few visible adjustments.",
         "The path was more contained than scattered overall.",
         "Your route made corrections without losing the general direction.",
         "The walk held together well, with some room around the ideal line.",
         "The measured path showed a moderate level of control."),
        ("That pattern belongs to this one recorded walk.",
         "Small changes in setup can move a score like this.",
         "The score reports movement in the game, not personal ability in general.",
         "A second attempt might emphasise different parts of the route.",
         "This is an experimental movement metric, not a medical assessment.")),
    "76-90": _feedback_pool(
        ("Your route stayed close to the intended line for most of the walk.",
         "The path was controlled, with only a handful of notable corrections.",
         "This attempt showed a strong match with the straight-line target.",
         "Your walk kept its shape over the measured distance.",
         "The route was compact and generally well directed.",
         "Most of the path remained near the reference centre.",
         "Your movement looked steady, with limited side-to-side spread.",
         "The walk used its distance efficiently compared with the target.",
         "The route held a clear course from start toward finish.",
         "This was a notably settled path for a short game attempt."),
        ("It still reflects one walk under one set of conditions.",
         "Camera position and the surrounding space remain part of the result.",
         "The score is about this route, not a permanent trait.",
         "A little variation is expected in any movement task.",
         "This is a game score and should not be read as a health conclusion.")),
    "91-100": (
        "Your route was exceptionally close to the requested straight-line path.",
        "This attempt produced a very compact and efficient walking route.",
        "The measured path tracked the centre line with remarkable consistency.",
        "Your walk showed very little side-to-side drift in this recording.",
        "The route stayed strongly aligned with the activity's target.",
        "This was one of the steadiest paths the activity can record.",
        "Your movement followed the reference with minimal correction.",
        "The walk finished with an unusually contained route.",
        "The measured distance was used very efficiently in this attempt.",
        "Your path remained impressively close to centre throughout.",
        "This recording showed a clear, direct line from start to finish.",
        "The route had very little wasted movement around the target.",
        "Your path was highly consistent across the measured walk.",
        "This attempt matched the straight-line instruction especially well.",
        "The walk showed strong control of direction in this game.",
        "Your recorded route was short, direct, and close to the reference.",
        "The centre line remained a close guide throughout the activity.",
        "This was a particularly tidy movement trace.",
        "The path showed a high degree of consistency for this recording.",
        "Your route stayed remarkably composed from beginning to end.",
    ),
}


def pick_wobble_feedback(score, seed):
    """Choose one stable, score-band-specific statement for the report."""
    try:
        value = max(0.0, min(100.0, float(score)))
    except (TypeError, ValueError):
        return None
    if value <= 25:
        band = "0-25"
    elif value <= 50:
        band = "26-50"
    elif value <= 75:
        band = "51-75"
    elif value <= 90:
        band = "76-90"
    else:
        band = "91-100"
    pool = WOBBLE_FEEDBACK_POOLS[band]
    return _seeded(seed, "wobble-feedback-{}".format(band)).choice(pool)


GAME_FEEDBACK_POOLS = {
    "timer": {
        "low": _feedback_pool(
            ("The countdown pulled attention away from the word search quite often.",
             "This round involved a lot of checking and re-checking of the clock.",
             "Your attention moved between the grid and the timer several times.",
             "The visible deadline was a prominent part of this attempt.",
             "The round showed a busy pattern of clock checks and task switches."),
            ("The result is a snapshot of one timed challenge.",
             "A different pace or strategy could produce a different pattern.",
             "The score describes this round, not your general concentration.",
             "Time pressure affects people differently from one attempt to the next.")),
        "mid": _feedback_pool(
            ("You balanced the word search with a moderate number of clock checks.",
             "The timer drew attention at points, while the grid remained part of the focus.",
             "This round mixed task engagement with a few deadline checks.",
             "Your checking pattern was noticeable but not constant.",
             "The round showed a middle-ground response to the visible countdown."),
            ("That pattern belongs to this particular timed activity.",
             "Small changes in strategy can shift a result like this.",
             "The score is an experimental game measure, not a personal label.",
             "One short round cannot describe how you focus everywhere.")),
        "high": _feedback_pool(
            ("You kept the word search and the countdown in a fairly workable balance.",
             "The grid held your attention through most of the timed round.",
             "Your checking pattern was relatively contained in this attempt.",
             "The round showed a steady relationship with the visible deadline.",
             "You moved between task and timer without losing the overall thread."),
            ("The result still reflects one round under one set of conditions.",
             "A little variation is normal in a fast visual task.",
             "This is a performance snapshot, not a conclusion about you.",
             "The score describes this game's measurements only.")),
    },
    "gaze": {
        "low": _feedback_pool(
            ("The posters and recall questions did not line up easily in this attempt.",
             "This round left several details difficult to retrieve from memory.",
             "Your recall pattern showed a lot of variation across the questions.",
             "The visual details were challenging to hold onto after the posters disappeared.",
             "This attempt produced a lighter recall result across the selected questions."),
            ("Memory can shift with timing, distraction, and the surrounding environment.",
             "The score describes this short recall task, not your memory in general.",
             "A different set of images could lead to a different result.",
             "This is a game measurement, not a judgement of ability.")),
        "mid": _feedback_pool(
            ("You recalled some of the poster details while other details stayed elusive.",
             "The recall result was mixed across the images shown.",
             "Your memory for the visual material was stronger for some questions than others.",
             "This attempt captured a varied pattern of visual recall.",
             "Some poster details stayed available after the viewing period."),
            ("Short recall tasks naturally move around between attempts.",
             "The score reflects these images and questions only.",
             "A different viewing context could change the pattern.",
             "This result is descriptive rather than diagnostic.")),
        "high": _feedback_pool(
            ("You held onto many of the details from the posters.",
             "The recall questions matched well with what you had just viewed.",
             "Your answers showed a strong connection with the visual material.",
             "Several image details remained available after the delay.",
             "This attempt produced a clear and well-supported recall pattern."),
            ("The result is specific to this set of images and questions.",
             "Visual memory can vary with attention and viewing conditions.",
             "This is a short activity result, not a broad measure of memory.",
             "The score should be read as a snapshot of this run.")),
    },
    "deadpan": {
        "low": _feedback_pool(
            ("The expression signal crossed its threshold several times in this round.",
             "This clip produced a lively pattern of recorded expression events.",
             "The camera picked up frequent changes in the expression signal.",
             "The try-not-to-laugh challenge clearly kept the expression signal active.",
             "Your recording contained a number of noticeable expression events."),
            ("The result depends on this clip, threshold, and recording conditions.",
             "A laugh count is a game metric, not a judgement of personality.",
             "Different clips can invite very different reactions.",
             "This score describes one playful challenge only.")),
        "mid": _feedback_pool(
            ("The expression signal crossed the threshold a moderate number of times.",
             "You showed a mixed pattern of quiet stretches and expression events.",
             "The round included some visible moments without a constant signal.",
             "Your response pattern moved between restraint and reaction.",
             "This recording landed in a middle range of expression activity."),
            ("The outcome can change with the clip, mood, and room setup.",
             "The score reports the recording, not a fixed quality about you.",
             "One short reaction game is naturally variable.",
             "This is an experimental activity result, not a personality assessment.")),
        "high": _feedback_pool(
            ("The expression signal stayed relatively quiet during the challenge.",
             "You kept the recorded expression events fairly contained in this clip.",
             "The round showed a strong stretch of restraint around the threshold.",
             "Your response pattern remained controlled for much of the recording.",
             "The camera recorded comparatively few high-intensity expression events."),
            ("The result is tied to this particular clip and recording setup.",
             "A different video could produce a completely different response.",
             "This score describes one game, not your emotional life.",
             "The number is a playful performance measure only.")),
    },
}


def _feedback_band(score):
    try:
        value = max(0.0, min(25.0, float(score)))
    except (TypeError, ValueError):
        return "mid"
    if value <= 8.33:
        return "low"
    if value <= 16.67:
        return "mid"
    return "high"


def pick_game_feedback(game, score, seed, metrics=None):
    """Choose a stable, neutral comment for a scored station."""
    pool = GAME_FEEDBACK_POOLS.get(game)
    if not pool:
        return None
    band = _feedback_band(score)
    metrics = metrics or {}
    comment = _seeded(seed, "{}-feedback-{}".format(game, band)).choice(pool[band])

    if game == "timer" and metrics.get("checks") is not None:
        return "{} You checked the clock {} time{} during the round.".format(
            comment, metrics["checks"], "s" if metrics["checks"] != 1 else ""
        )
    if game == "gaze" and metrics.get("correct") is not None:
        return "{} You recalled {} of {} questions correctly.".format(
            comment, metrics["correct"], metrics.get("total", "the")
        )
    if game == "deadpan" and metrics.get("laughs") is not None:
        return "{} The expression signal crossed the threshold {} time{}.".format(
            comment, metrics["laughs"], "s" if metrics["laughs"] != 1 else ""
        )
    return comment

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
