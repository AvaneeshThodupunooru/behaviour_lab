# The Pressure Clock

A single-page, no-build, no-backend implementation of the pressure-clock
experiment: a timed word search with WebGazer-based gaze tracking and a
post-game reveal + Pressure Profile.

## Running it

Serve the folder from a local server and open it at `http://localhost` in
Chrome (WebGazer is most reliable there). For example:

```
python -m http.server 8080
```

Then visit `http://localhost:8080/`. Grant camera access when prompted; if
you decline or no camera is available, the game still plays end-to-end,
just without gaze analytics (a small banner at the bottom says so).

> WebGazer's default behavior of quietly improving its model from your
> mouse clicks improves its model. Before the game, this app now presents a
> nine-point calibration sequence, with three deliberate clicks per point
> and a basic screen-fraction error estimate. Repeat calibration if the
> estimate is poor. This is still ROI-level accuracy, not research-grade
> fixation accuracy (this matches the spec's own caveat in §3).

## File structure

```
index.html            screens, canvas, timer HUD, script tags (classic
                       scripts, not ES modules — keeps file:// opening
                       working with no CORS complications)
styles.css             all visual styling
js/roi.js              PURE — gaze sample stream -> discrete timer visits
js/metrics.js          PURE — visits/trials -> all §6 metrics + Pressure Index
js/trial-logger.js      stateful but DOM-free trial recorder
js/gaze-pipeline.js    browser-only — WebGazer wiring, fails soft
js/heatmap.js          browser-only — canvas heatmap of normalized gaze samples
js/reveal.js           browser-only — staged reveal sequence
js/main.js             orchestration: screen flow, round timing, results, JSON export
tests/roi.test.js      node tests/roi.test.js
tests/metrics.test.js  node tests/metrics.test.js
```

## Testing the pure modules independently of the UI

`js/roi.js` and `js/metrics.js` are UMD-style: they export via
`module.exports` in Node and attach to `window.PressureClockROI` /
`window.PressureClockMetrics` in the browser, with **no dependency on the
DOM or on each other**. Run:

```
node tests/roi.test.js
node tests/metrics.test.js
```

Both use Node's built-in `assert` only — no dependencies to install, in
keeping with the "no build step" constraint. To test against your own
sample gaze arrays:

```js
const roi = require('./js/roi.js');
const buffered = roi.applyBuffer(roi.TIMER_ROI, 0.02);
const { classifiedSamples, timerVisits } = roi.classifyGazeStream(mySamples, buffered, 100);
```

## Design decisions worth knowing about (things the spec left open)

- **Single clock source.** Every timestamp — gaze samples, trial shown/click
  times, round start/end — comes from `performance.now()`. This directly
  addresses the spec's testing-checklist item about clock drift between
  gaze and reaction timestamps.
- **Region model.** The spec only defines a `timer` ROI. Everywhere that
  isn't the timer box is treated as `game` (there's no other chrome on the
  page), so attention-switching counts game↔timer transitions across the
  whole non-timer viewport.
- **Word-search trial semantics.** Each drag attempt is one trial. Correct
  attempts use the matched word as `targetType`; incorrect attempts have a
  null target and preserve the selected string as `clickedType`.
- **Pressure Index calibration.** The spec is explicit that the 0–100
  normalization ranges should come from pilot-testing a real group (§6,
  §11), which a single build session can't do. `js/metrics.js` ships
  `DEFAULT_CALIBRATION` as clearly-labeled placeholder ranges — swap in
  real min/max values once you've run pilot sessions, by passing a
  `calibration` object into `computePressureIndex()`.
- **Heatmap background.** The word-search grid is DOM-based, so the results
  heatmap uses a neutral canvas background with the session's gaze density.
- **Deception + disclosure**, per spec §8: the start screen only says the
  session "records your interactions for a demo" — it does not name eye
  tracking or the hypothesis. The reveal happens immediately after the game,
  before any results are shown, and the Pressure Index is always shown
  with the "experimental, not clinical" disclaimer. If you deploy this
  somewhere with a real IRB/consent requirement, you'll want a proper
  consent screen in addition to this in-app copy.

## Known gaps vs. the 2-day build plan

- Pressure Index thresholds are placeholders, not pilot-calibrated (see above).
