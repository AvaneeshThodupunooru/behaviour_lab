# The Pressure Clock — Refined Project Spec

A gamified eye-tracking experiment on time pressure and attention, buildable in 2 days.

---

## 1. One-line pitch

Participants play what looks like a simple reaction-time game while a large countdown timer sits in the corner. Behind the scenes, gaze tracking logs how often and when they check the timer, and the game logs reaction time, accuracy, and error rate. At the end, the "game" is revealed to be an attention experiment, and the participant gets a personalized **Pressure Profile**.

**Research question:** Does visual monitoring of a visible deadline (timer-checking frequency/timing) increase as time runs out, and does it correlate with performance decline?

---

## 2. Scope lock (read this before building anything)

Build exactly these 8 pieces. Nothing else.

1. Game (3 rounds, click-the-target)
2. Big timer with a fixed on-screen Region of Interest (ROI)
3. Gaze input pipeline (from your eye tracker → x, y, timestamp)
4. Timer ROI classifier → converts raw gaze samples into discrete "timer visits"
5. Trial logger (reaction time, accuracy, target, timestamps)
6. Metrics engine (the formulas in §6)
7. Reveal sequence + Pressure Profile results screen
8. Gaze heatmap/path visualization on the results screen

Explicitly **out of scope**: ML stress classifiers, facial emotion recognition, EEG, accounts/login, backend database, cloud deployment, mobile port, multiplayer, AI-generated psychological writeups. If you have spare time at the end, spend it on polish and testing, not new features.

---

## 3. Tech stack recommendation

Keep this a single-page web app so the eye tracker's gaze stream, the game canvas, and the results screen all live in one JS runtime with no network latency.

- **Frontend:** Vanilla JS + HTML5 Canvas (or React if you're faster in it — no framework benefit here, this app has one screen with states, not routes)
- **Eye tracking input:** Whatever device/SDK you already have that emits `(x, y, timestamp)` gaze samples. If you don't have hardware, fall back to **WebGazer.js** (webcam-based, runs in-browser, no install) — good enough for ROI-level accuracy, not for fine fixation research
- **Storage:** In-memory arrays during the session; dump to a downloadable JSON at the end (via `Blob` + `<a download>`). No backend, no database — this is a single-session expo booth app
- **Visualization:** Canvas or SVG for the gaze heatmap/path replay

If you're using an external eye tracker SDK that runs outside the browser (Tobii, Pupil Labs, etc.), have it write gaze samples to a local WebSocket the page subscribes to. Confirm this connection works on Day 1 morning — it's your biggest technical risk.

---

## 4. Data schemas

Lock these down before writing game logic — everything downstream depends on them.

```ts
// One row per gaze sample, appended continuously
interface GazeSample {
  t: number;        // ms since session start
  x: number;         // normalized 0–1 (screen width)
  y: number;         // normalized 0–1 (screen height)
  region: "timer" | "game" | "other";
}

// One row per game trial (one target shown → one response)
interface Trial {
  round: 1 | 2 | 3;
  trialId: number;
  targetShownAt: number;   // ms since session start
  respondedAt: number | null;
  reactionTimeMs: number | null;
  correct: boolean;
  targetType: string;      // e.g. "red_circle"
  clickedType: string | null;
}

// One row per discrete timer visit (post-processed from GazeSample stream)
interface TimerVisit {
  startT: number;
  endT: number;
  durationMs: number;
  timeRemainingAtVisit: number; // seconds left on the clock when visit started
}

// Final session record
interface SessionResult {
  rounds: { roundNum: number; durationSec: number; trials: Trial[] }[];
  gazeSamples: GazeSample[];
  timerVisits: TimerVisit[];
  metrics: PressureMetrics; // computed, see §6
}
```

---

## 5. ROI detection: samples → visits (the part people get wrong)

Raw gaze samples inside the timer box are **not** the same as timer checks. A 0.5-second glance can produce 15 raw samples at a 30Hz tracker — that's one visit, not fifteen.

**Algorithm:**

```
state = "outside"
visitStart = null

for each incoming sample:
    inTimerROI = sample.x > TIMER_ROI.xMin and sample.y < TIMER_ROI.yMax

    if inTimerROI and state == "outside":
        state = "inside"
        visitStart = sample.t

    if not inTimerROI and state == "inside":
        state = "outside"
        visitEnd = sample.t
        if (visitEnd - visitStart) > MIN_VISIT_MS:   # debounce, e.g. 100ms
            emit TimerVisit(visitStart, visitEnd)
```

- `MIN_VISIT_MS` filters out tracker noise/flickers as gaze crosses the ROI boundary. Start at 100ms, tune during Day 2 testing.
- Define the ROI as a normalized rectangle, not pixels, so it's resolution-independent:
  ```
  TIMER_ROI = { xMin: 0.80, yMin: 0.0, xMax: 1.0, yMax: 0.20 }
  ```
- Add a small buffer zone (~2% of screen) around the visual timer box so the ROI is slightly larger than the rendered element — prevents false negatives from tracker jitter at the edges.

---

## 6. Metrics engine (exact formulas)

**Timer Attention**
- `timerCheckCount` = number of `TimerVisit` events in the round
- `totalDwellMs` = sum of all visit durations
- `avgGlanceMs` = `totalDwellMs / timerCheckCount`
- `checksPerMinute` = `timerCheckCount / (roundDurationSec / 60)`

**Deadline Sensitivity**
Split the round into quarters by time remaining, count checks per quarter:
```
quarters = [0-25%, 25-50%, 50-75%, 75-100%] of round duration
checksPerQuarter[i] = count of TimerVisits where timeRemaining falls in quarter i
deadlineSensitivity = checksPerQuarter[last] / (checksPerQuarter[first] + 1)  // +1 avoids div/0
```
Report as Low / Moderate / High using fixed thresholds you calibrate during pilot testing (e.g. ratio < 1.5 = Low, 1.5–3 = Moderate, >3 = High).

**Attention Switching**
Count transitions where `region` changes from `game` → `timer` or `timer` → `game` in the classified sample stream. Normalize per minute.

**Performance**
- `accuracy` = correct trials / total trials, per round
- `reactionTime` = mean and median of `reactionTimeMs`, per round
- `rtVariability` = standard deviation of `reactionTimeMs`
- `performanceDelta` = accuracy(final third of trials) − accuracy(first third of trials) — this is your "deterioration" number, can be negative (declined) or positive (improved)

**Pressure Index (composite, 0–100, expo-facing headline number)**
Normalize each component to 0–100 first (min-max across your pilot test data, not per-participant), then:
```
PressureIndex =
    0.25 * timerCheckScore
  + 0.20 * deadlineSensitivityScore
  + 0.20 * rtVariabilityScore
  + 0.20 * performanceDeltaScore   // use inverted scale: bigger decline = higher score
  + 0.15 * attentionSwitchingScore
```
Always display beneath it: *"Experimental behavioral score, not a clinical measure of stress."*

---

## 7. Game design — exact rules

**Round 1 — Baseline (60 sec)**
- Single shape appears at a random position: red circle / blue square / green triangle / yellow star
- Instruction: "Click the RED CIRCLE"
- New target spawns immediately after click (correct or not)
- Purpose: establish baseline reaction time and baseline timer-checking with low cognitive load

**Round 2 — Distraction (30 sec)**
- 4–6 shapes on screen simultaneously, only one matches "target type" (e.g. red circle among blue circles, red squares, green triangles)
- Instruction: "Click only the RED CIRCLE"
- Purpose: adds visual search demand while time pressure increases (half the time of Round 1)

**Round 3 — Pressure (15 sec)**
- Target shape shown at top of screen (e.g. 🔺), then 6–10 shapes appear rapidly and participant matches the shown shape
- Increase spawn rate and shape similarity as the round progresses
- Purpose: maximum time pressure + task difficulty, shortest window — this is where you expect the sharpest deadline-sensitivity signal

Between rounds: 3-second "Round complete" transition screen, no timer, no gaze logging (gives a clean baseline gap in the data).

**Timer rules across all rounds:**
- Same visual size and ROI position every round (don't let it move — you need consistent ROI logic)
- No color change or flashing as it counts down (§7a below explains why)
- Numeric, large, high contrast, top-right corner, always visible

**§7a — Don't cue the behavior you're measuring.** If the timer flashes red at 10 seconds left, you're actively prompting people to look at it, and you can no longer claim you measured spontaneous checking. If you want a version where urgency escalates, treat it as a separate experimental condition and don't compare it to your passive-timer rounds.

---

## 8. Deception + reveal (this is your "wow" moment)

**Before the task**, tell participants only:
> "Complete the following tasks as accurately and quickly as you can. There are 3 rounds."

Do not mention eye tracking, timers, or stress. If your expo setting requires informed consent/disclosure about data collection, handle that generically ("this session records your interactions for a demo") without revealing the specific hypothesis.

**Reveal sequence (one screen at a time, with a beat of pause between each):**

1. `YOU FINISHED! Nice job.`
2. `BUT...` (blank pause, ~1.5s)
3. `You weren't really just playing a game.`
4. `WE WERE WATCHING YOUR EYES.`
5. `Every time you looked at the countdown, we recorded it.`
6. `YOU CHECKED THE TIMER 17 TIMES` (their real number, large font)
7. `Most people don't realize how often they check the clock under pressure.`
8. → transition into full Pressure Profile + heatmap

---

## 9. Results screen layout

```
╔══════════════════════════════════════╗
║          YOUR PRESSURE PROFILE        ║
╠══════════════════════════════════════╣
║ TIMER CHECKS                 17       ║
║ TOTAL TIMER TIME            8.4s      ║
║ AVG GLANCE LENGTH           0.49s     ║
║ ACCURACY                     78%      ║
║ AVG REACTION TIME           1.24s     ║
║ ATTENTION SWITCHING         HIGH      ║
║ DEADLINE SENSITIVITY        HIGH      ║
║ PERFORMANCE CHANGE          -12%      ║
╠══════════════════════════════════════╣
║ PRESSURE INDEX              74/100    ║
╚══════════════════════════════════════╝
     [experimental score, not clinical]

  [ Your Gaze Map ]  ← heatmap/path overlay on game screenshot
```

One-line interpretation under the table, generated from thresholds, not free text AI generation:
> "Your timer checks rose sharply in the final quarter of each round — a pattern consistent with high deadline sensitivity."

---

## 10. 2-day build plan (hour-level)

**Day 1 AM (4h)** — Full-screen UI shell: start screen, 3 game round screens, transition screens, end screen. Static, no logic yet.

**Day 1 PM (4h)** — Game logic: target spawning, click detection, trial logging per §4/§7. Get all 3 rounds playable end-to-end with fake/no eye tracking.

**Day 1 Evening (2–3h)** — Connect eye tracker. Confirm you're receiving `(x, y, t)` at a stable rate. This is your highest-risk integration point — do not leave it for Day 2.

**Day 2 AM (4h)** — Implement ROI classifier (§5), timer visit detection, metrics engine (§6). Log everything to console first, verify numbers make sense on yourself before building UI for them.

**Day 2 PM (3h)** — Build results screen + reveal sequence (§8, §9). Wire metrics into it.

**Day 2 Evening (2–3h)** — Test with 5–10 people. Check for: tracker losing calibration, ROI false positives/negatives, double-counted visits, round difficulty (too easy/hard), reveal timing feel, instructions clarity. Freeze scope after this — no new features, only bug fixes.

---

## 11. Testing checklist before the expo

- [ ] ROI visit count matches what a human watching the gaze dot would count manually (test on yourself, count by eye, compare to logged number)
- [ ] Timer never visually changes/flashes (unless intentionally testing an urgency condition)
- [ ] Reaction time timestamps use the same clock as gaze timestamps (no drift between two separate `Date.now()` sources)
- [ ] Round 3 is meaningfully harder than Round 2 for a first-time player
- [ ] Session data downloads/exports cleanly as JSON at the end
- [ ] App recovers gracefully if the eye tracker disconnects mid-session (don't crash the whole demo)
- [ ] Reveal sequence timing feels dramatic, not slow — test with people watching, not just yourself
- [ ] Pressure Index thresholds calibrated against your pilot group's actual score range, not made up

---

## 12. One-shot build prompt

Paste this into a coding assistant (Claude Code, etc.) to scaffold the whole thing in one pass:

> Build a single-page web app called "The Pressure Clock" — a 3-round reaction-time game with a visible countdown timer, gaze-tracking integration via WebGazer.js, and a post-game analytics reveal screen. Use vanilla JS + HTML5 Canvas, no backend, no build step. Implement: (1) Round 1 — 60s single-target click game (4 shape types); Round 2 — 30s, distractor shapes, click only the matching type; Round 3 — 15s, shown-target matching with increasing spawn rate. (2) A fixed-position, non-flashing countdown timer top-right, with a normalized ROI rectangle `{xMin:0.80, yMin:0, xMax:1.0, yMax:0.20}` plus 2% buffer. (3) A gaze sample classifier that converts the WebGazer `(x,y,t)` stream into discrete timer "visits" using a state machine with a 100ms debounce (no visit shorter than 100ms counts). (4) A trial logger recording target shown time, click time, reaction time, correctness, per round. (5) A metrics engine computing: timer check count, total/average dwell time, checks-per-minute, deadline sensitivity (checks in last quarter of round time vs first quarter), attention-switching count (game↔timer transitions per minute), accuracy, mean/median/stddev reaction time, and performance delta (last-third accuracy minus first-third accuracy). (6) A composite 0–100 "Pressure Index" from a weighted formula over normalized versions of the above (weights: 25% timer checks, 20% deadline sensitivity, 20% RT variability, 20% performance delta, 15% attention switching), with a visible disclaimer that it's an experimental behavioral score, not a clinical measure. (7) A staged reveal sequence after Round 3 ("You finished — but you weren't really playing a game — we were watching your eyes — you checked the timer N times") followed by a results screen showing the full metrics table and a canvas-rendered heatmap of the participant's gaze samples overlaid on a screenshot of the game area. (8) A JSON export button that downloads the full session record (gaze samples, trials, timer visits, computed metrics). Keep the whole thing in one HTML file plus a couple of JS modules — no framework, no server, no database. Structure the code so the ROI classifier and metrics engine are pure functions I can unit-test against sample gaze arrays independent of the UI.

---

**Bottom line:** the novelty is the *combination* — game + timer + gaze + real behavioral metrics — not the game mechanics or the visuals. If the 8 pieces in §2 work reliably, you have a complete expo project.
