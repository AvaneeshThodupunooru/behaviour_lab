/**
 * roi.js — Timer ROI classifier
 * -----------------------------------------------------------------------
 * PURE FUNCTIONS ONLY. No DOM access, no globals besides the export shim
 * below. This module can be `require()`d directly in Node for unit tests:
 *
 *   const roi = require('./js/roi.js');
 *   roi.classifyGazeStream(samples, roi.applyBuffer(TIMER_ROI, 0.02), 100);
 *
 * In the browser it attaches itself to `window.PressureClockROI`.
 * -----------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  /** Default normalized timer ROI, per spec §2. */
  var TIMER_ROI = { xMin: 0.80, yMin: 0.0, xMax: 1.0, yMax: 0.20 };

  /** Default debounce window — visits shorter than this are noise. */
  var DEFAULT_MIN_VISIT_MS = 100;

  /** Default ROI buffer, as a fraction of screen size. */
  var DEFAULT_BUFFER = 0.02;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /**
   * Expand a normalized ROI rect by `buffer` on every edge, clamped to [0,1].
   * @param {{xMin:number,yMin:number,xMax:number,yMax:number}} rect
   * @param {number} buffer fraction of screen (e.g. 0.02 = 2%)
   */
  function applyBuffer(rect, buffer) {
    buffer = typeof buffer === 'number' ? buffer : DEFAULT_BUFFER;
    return {
      xMin: clamp(rect.xMin - buffer, 0, 1),
      yMin: clamp(rect.yMin - buffer, 0, 1),
      xMax: clamp(rect.xMax + buffer, 0, 1),
      yMax: clamp(rect.yMax + buffer, 0, 1)
    };
  }

  /**
   * Is a single normalized (x, y) sample inside a normalized rect?
   */
  function inROI(sample, rect) {
    return (
      sample.x >= rect.xMin &&
      sample.x <= rect.xMax &&
      sample.y >= rect.yMin &&
      sample.y <= rect.yMax
    );
  }

  /**
   * Convert a raw gaze sample stream into:
   *   - classifiedSamples: each sample tagged with region "timer" | "game"
   *   - timerVisits: discrete dwell events inside the ROI, debounced
   *
   * This is a direct implementation of the state machine in spec §5:
   *   state = outside -> inside on ROI entry (visitStart = t)
   *   state = inside -> outside on ROI exit; emit visit if duration > minVisitMs
   *
   * A trailing visit still open when the stream ends is closed using the
   * timestamp of the final sample (documented assumption — the spec's
   * pseudocode doesn't cover end-of-stream, so we flush rather than drop
   * a real, still-in-progress dwell).
   *
   * @param {{t:number,x:number,y:number}[]} samples must be time-ordered
   * @param {{xMin:number,yMin:number,xMax:number,yMax:number}} rect timer ROI (already buffered, if desired)
   * @param {number} minVisitMs debounce threshold in ms
   * @returns {{classifiedSamples: object[], timerVisits: {startT:number,endT:number,durationMs:number}[]}}
   */
  function classifyGazeStream(samples, rect, minVisitMs) {
    minVisitMs = typeof minVisitMs === 'number' ? minVisitMs : DEFAULT_MIN_VISIT_MS;
    var ordered = samples.slice().sort(function (a, b) { return a.t - b.t; });

    var state = 'outside';
    var visitStart = null;
    var visits = [];
    var classified = new Array(ordered.length);

    for (var i = 0; i < ordered.length; i++) {
      var sample = ordered[i];
      var inside = inROI(sample, rect);
      var region = inside ? 'timer' : 'game';
      classified[i] = { t: sample.t, x: sample.x, y: sample.y, region: region };

      if (inside && state === 'outside') {
        state = 'inside';
        visitStart = sample.t;
      }
      if (!inside && state === 'inside') {
        state = 'outside';
        var visitEnd = sample.t;
        if (visitEnd - visitStart > minVisitMs) {
          visits.push({ startT: visitStart, endT: visitEnd, durationMs: visitEnd - visitStart });
        }
        visitStart = null;
      }
    }

    // Flush a trailing visit still open at the end of the stream.
    if (state === 'inside' && visitStart !== null && ordered.length > 0) {
      var lastT = ordered[ordered.length - 1].t;
      if (lastT - visitStart > minVisitMs) {
        visits.push({ startT: visitStart, endT: lastT, durationMs: lastT - visitStart });
      }
    }

    return { classifiedSamples: classified, timerVisits: visits };
  }

  /**
   * Attach `timeRemainingAtVisit` (seconds left on the clock when the visit
   * started) and `elapsedFrac` (0-1, how far into the round the visit
   * started) to each visit. Kept separate from classifyGazeStream so the
   * classifier itself has no notion of "rounds".
   *
   * @param {{startT:number,endT:number,durationMs:number}[]} visits
   * @param {number} roundStartT session-relative ms when the round began
   * @param {number} roundDurationMs round length in ms
   */
  function withTimeRemaining(visits, roundStartT, roundDurationMs) {
    return visits.map(function (v) {
      var elapsedMs = v.startT - roundStartT;
      var remainingMs = roundDurationMs - elapsedMs;
      return {
        startT: v.startT,
        endT: v.endT,
        durationMs: v.durationMs,
        timeRemainingAtVisit: Math.max(0, remainingMs / 1000),
        elapsedFrac: clamp(elapsedMs / roundDurationMs, 0, 1)
      };
    });
  }

  /**
   * Count game<->timer attention switches in a classified sample sequence.
   * "other" regions (unused by default, but supported) are skipped rather
   * than counted as a state so a brief unclassified gap doesn't itself
   * register as two switches.
   */
  function countAttentionSwitches(classifiedSamples) {
    var count = 0;
    var prev = null;
    for (var i = 0; i < classifiedSamples.length; i++) {
      var region = classifiedSamples[i].region;
      if (region === 'other') continue;
      if (prev !== null && prev !== region) count++;
      prev = region;
    }
    return count;
  }

  var api = {
    TIMER_ROI: TIMER_ROI,
    DEFAULT_MIN_VISIT_MS: DEFAULT_MIN_VISIT_MS,
    DEFAULT_BUFFER: DEFAULT_BUFFER,
    applyBuffer: applyBuffer,
    inROI: inROI,
    classifyGazeStream: classifyGazeStream,
    withTimeRemaining: withTimeRemaining,
    countAttentionSwitches: countAttentionSwitches
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PressureClockROI = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
