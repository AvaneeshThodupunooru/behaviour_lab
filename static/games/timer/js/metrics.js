/**
 * metrics.js — Pressure Clock metrics engine
 * -----------------------------------------------------------------------
 * PURE FUNCTIONS ONLY. Takes already-classified samples / visits / trials
 * (produced by roi.js and trial-logger.js) and returns numbers. No DOM,
 * no dependency on roi.js — unit-testable in isolation against sample
 * arrays. UMD export like roi.js.
 * -----------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function sum(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  function mean(arr) {
    return arr.length ? sum(arr) / arr.length : 0;
  }

  function median(arr) {
    if (!arr.length) return 0;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Population standard deviation (whole session/round treated as the full population, not a sample). */
  function stddev(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    var variance = mean(arr.map(function (x) { return (x - m) * (x - m); }));
    return Math.sqrt(variance);
  }

  // -----------------------------------------------------------------------
  // Timer attention (spec §6, "Timer Attention")
  // -----------------------------------------------------------------------

  /**
   * @param {{durationMs:number}[]} visits
   * @param {number} roundDurationSec
   */
  function computeTimerAttention(visits, roundDurationSec) {
    var timerCheckCount = visits.length;
    var totalDwellMs = sum(visits.map(function (v) { return v.durationMs; }));
    var avgGlanceMs = timerCheckCount ? totalDwellMs / timerCheckCount : 0;
    var checksPerMinute = roundDurationSec > 0 ? timerCheckCount / (roundDurationSec / 60) : 0;
    return {
      timerCheckCount: timerCheckCount,
      totalDwellMs: totalDwellMs,
      avgGlanceMs: avgGlanceMs,
      checksPerMinute: checksPerMinute
    };
  }

  // -----------------------------------------------------------------------
  // Deadline sensitivity (spec §6)
  // -----------------------------------------------------------------------

  /**
   * @param {{elapsedFrac:number}[]} visitsWithElapsedFrac output of roi.withTimeRemaining
   * @param {{low:number, high:number}} [thresholds] ratio thresholds for the Low/Moderate/High label
   */
  function computeDeadlineSensitivity(visitsWithElapsedFrac, thresholds) {
    thresholds = thresholds || { low: 1.5, high: 3 };
    var quarterCounts = [0, 0, 0, 0];
    visitsWithElapsedFrac.forEach(function (v) {
      var q = clamp(Math.floor(v.elapsedFrac * 4), 0, 3);
      quarterCounts[q]++;
    });
    var firstQuarter = quarterCounts[0];
    var lastQuarter = quarterCounts[3];
    var ratio = lastQuarter / (firstQuarter + 1);
    var label = ratio < thresholds.low ? 'Low' : ratio <= thresholds.high ? 'Moderate' : 'High';
    return {
      checksPerQuarter: quarterCounts,
      deadlineSensitivityRatio: ratio,
      deadlineSensitivityLabel: label
    };
  }

  // -----------------------------------------------------------------------
  // Attention switching (spec §6)
  // -----------------------------------------------------------------------

  /**
   * @param {number} switchCount from roi.countAttentionSwitches
   * @param {number} roundDurationSec
   */
  function computeAttentionSwitching(switchCount, roundDurationSec) {
    var switchesPerMinute = roundDurationSec > 0 ? switchCount / (roundDurationSec / 60) : 0;
    return { attentionSwitchCount: switchCount, switchesPerMinute: switchesPerMinute };
  }

  // -----------------------------------------------------------------------
  // Performance (spec §6)
  // -----------------------------------------------------------------------

  /**
   * @param {{correct:boolean}[]} trials
   */
  function computeAccuracy(trials) {
    if (!trials.length) return 0;
    var correctCount = trials.filter(function (t) { return t.correct; }).length;
    return correctCount / trials.length;
  }

  /**
   * @param {{reactionTimeMs:?number}[]} trials
   */
  function computeReactionTimeStats(trials) {
    var rts = trials
      .map(function (t) { return t.reactionTimeMs; })
      .filter(function (v) { return typeof v === 'number' && !isNaN(v); });
    return {
      meanReactionTimeMs: mean(rts),
      medianReactionTimeMs: median(rts),
      stddevReactionTimeMs: stddev(rts),
      sampleSize: rts.length
    };
  }

  /**
   * performanceDelta = accuracy(final third of trials) - accuracy(first third of trials),
   * trials ordered chronologically by targetShownAt. Returns null if there
   * aren't enough trials to form two non-overlapping thirds.
   * @param {{targetShownAt:number, correct:boolean}[]} trials
   */
  function computePerformanceDelta(trials) {
    if (trials.length < 3) return null;
    var ordered = trials.slice().sort(function (a, b) { return a.targetShownAt - b.targetShownAt; });
    var thirdSize = Math.floor(ordered.length / 3);
    if (thirdSize < 1) return null;
    var firstThird = ordered.slice(0, thirdSize);
    var lastThird = ordered.slice(ordered.length - thirdSize);
    return computeAccuracy(lastThird) - computeAccuracy(firstThird);
  }

  // -----------------------------------------------------------------------
  // Composite Pressure Index (spec §6)
  // -----------------------------------------------------------------------

  /**
   * Default min/max calibration ranges used to normalize each raw component
   * to 0-100 before weighting. THESE ARE PLACEHOLDER VALUES, not derived
   * from pilot data — the spec is explicit that real ranges should come
   * from calibrating against a pilot group (spec §6, §11). Override by
   * passing a `calibration` object with the same shape into
   * computePressureIndex().
   */
  var DEFAULT_CALIBRATION = {
    timerCheckCount: { min: 0, max: 30 },
    deadlineSensitivityRatio: { min: 0, max: 6 },
    rtStddevMs: { min: 0, max: 600 },
    // performanceDecline = -performanceDelta, so positive = got worse.
    // Range covers a 40%-point swing in either direction.
    performanceDecline: { min: -0.4, max: 0.4 },
    attentionSwitchesPerMinute: { min: 0, max: 40 }
  };

  function normalize(value, range) {
    if (value === null || typeof value === 'undefined' || isNaN(value)) return 0;
    if (range.max === range.min) return 0;
    return clamp(((value - range.min) / (range.max - range.min)) * 100, 0, 100);
  }

  /**
   * @param {object} components
   * @param {number} components.timerCheckCount
   * @param {number} components.deadlineSensitivityRatio
   * @param {number} components.rtStddevMs
   * @param {?number} components.performanceDelta  (accuracy last-third - first-third; null treated as 0 decline)
   * @param {number} components.attentionSwitchesPerMinute
   * @param {object} [calibration] override for DEFAULT_CALIBRATION
   */
  function computePressureIndex(components, calibration) {
    var cal = calibration || DEFAULT_CALIBRATION;
    var performanceDecline = -(typeof components.performanceDelta === 'number' ? components.performanceDelta : 0);

    var timerCheckScore = normalize(components.timerCheckCount, cal.timerCheckCount);
    var deadlineSensitivityScore = normalize(components.deadlineSensitivityRatio, cal.deadlineSensitivityRatio);
    var rtVariabilityScore = normalize(components.rtStddevMs, cal.rtStddevMs);
    var performanceDeltaScore = normalize(performanceDecline, cal.performanceDecline);
    var attentionSwitchingScore = normalize(components.attentionSwitchesPerMinute, cal.attentionSwitchesPerMinute);

    var pressureIndex =
      0.25 * timerCheckScore +
      0.20 * deadlineSensitivityScore +
      0.20 * rtVariabilityScore +
      0.20 * performanceDeltaScore +
      0.15 * attentionSwitchingScore;

    return {
      pressureIndex: Math.round(clamp(pressureIndex, 0, 100)),
      componentScores: {
        timerCheckScore: timerCheckScore,
        deadlineSensitivityScore: deadlineSensitivityScore,
        rtVariabilityScore: rtVariabilityScore,
        performanceDeltaScore: performanceDeltaScore,
        attentionSwitchingScore: attentionSwitchingScore
      }
    };
  }

  var api = {
    mean: mean,
    median: median,
    stddev: stddev,
    computeTimerAttention: computeTimerAttention,
    computeDeadlineSensitivity: computeDeadlineSensitivity,
    computeAttentionSwitching: computeAttentionSwitching,
    computeAccuracy: computeAccuracy,
    computeReactionTimeStats: computeReactionTimeStats,
    computePerformanceDelta: computePerformanceDelta,
    computePressureIndex: computePressureIndex,
    DEFAULT_CALIBRATION: DEFAULT_CALIBRATION
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PressureClockMetrics = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
