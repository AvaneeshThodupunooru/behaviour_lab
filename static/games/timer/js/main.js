/**
 * main.js — glues roi.js / metrics.js / trial-logger.js / gaze-pipeline.js /
 * game.js / heatmap.js / reveal.js into the actual app flow:
 *   start -> round 1 -> transition -> round 2 -> transition -> round 3
 *   -> reveal -> results (+ JSON export)
 *
 * Every timestamp in this file comes from performance.now() — the same
 * clock the gaze pipeline uses — so trial and gaze timestamps never drift
 * apart (spec §11 testing checklist).
 */
(function () {
  'use strict';

  var ROI = window.PressureClockROI;
  var Metrics = window.PressureClockMetrics;
  var TrialLoggerLib = window.PressureClockTrialLogger;
  var GazePipelineLib = window.PressureClockGazePipeline;
  var WordSearchLib = window.PressureClockWordSearch;
  var Heatmap = window.PressureClockHeatmap;
  var Reveal = window.PressureClockReveal;
  // Optional host hooks are used only by the merged gaze-timer station.
  // Standalone Pressure Clock behavior remains unchanged.
  var hostOptions = window.PressureClockHostOptions || {};

  var ROUND_CONFIGS = [
    {
      round: 1,
      mode: 'single',
      durationSec: 15,
      targetType: 'red_circle',
      shapeSize: 50,
      transitionTitle: 'Find the words',
      transitionBody: 'Drag across letters to select a word — horizontally, vertically, or diagonally, in either direction. Find all 6 before time runs out.'
    },
    {
      round: 2,
      mode: 'multi',
      durationSec: 30,
      targetType: 'red_circle',
      minShapes: 4,
      maxShapes: 6,
      shapeSize: 44,
      transitionTitle: 'Round 2',
      transitionBody: 'Several shapes at once. Click only the RED CIRCLE — ignore the rest.'
    },
    {
      round: 3,
      mode: 'rapid',
      durationSec: 15,
      shapeSize: 40,
      transitionTitle: 'Round 3',
      transitionBody: 'Match the shape shown at the top of the screen as fast as you can.'
    }
  ];

  // The single word-search round replaces the legacy shape-game rounds.
  ROUND_CONFIGS = [{
    round: 1,
    durationSec: Number(hostOptions.durationSec) || 45,
    transitionTitle: 'Find the words',
    transitionBody: 'Drag across letters to select a word — horizontally, vertically, or diagonally, in either direction. Find all 6 before time runs out.'
  }];

  // -----------------------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------------------

  var el = {
    gazeStatus: document.getElementById('gaze-status'),
    gazeDebug: document.getElementById('gaze-debug'),
    gazeDebugDot: document.getElementById('gaze-debug-dot'),
    gazeDebugLabel: document.getElementById('gaze-debug-label'),
    timerHud: document.getElementById('timer-hud'),
    timerValueSec: document.getElementById('timer-value-sec'),
    timerValueMs: document.getElementById('timer-value-ms'),

    screenStart: document.getElementById('screen-start'),
    btnStart: document.getElementById('btn-start'),

    screenCalibration: document.getElementById('screen-calibration'),
    calibrationInstruction: document.getElementById('calibration-instruction'),
    calibrationTarget: document.getElementById('calibration-target'),
    calibrationProgress: document.getElementById('calibration-progress'),
    btnCalibrationRetry: document.getElementById('btn-calibration-retry'),
    btnCalibrationContinue: document.getElementById('btn-calibration-continue'),

    screenTransition: document.getElementById('screen-transition'),
    transitionEyebrow: document.getElementById('transition-eyebrow'),
    transitionTitle: document.getElementById('transition-title'),
    transitionBody: document.getElementById('transition-body'),
    transitionCountdown: document.getElementById('transition-countdown'),

    screenGame: document.getElementById('screen-game'),
    instruction: document.getElementById('instruction'),
    wordSearchGrid: document.getElementById('wordsearch-grid'),
    wordList: document.getElementById('word-list'),

    screenReveal: document.getElementById('screen-reveal'),
    revealContainer: document.getElementById('reveal-container'),

    screenResults: document.getElementById('screen-results'),
    metricsTable: document.getElementById('metrics-table'),
    pressureIndexValue: document.getElementById('pressure-index-value'),
    interpretationLine: document.getElementById('interpretation-line'),
    heatmapCanvas: document.getElementById('heatmap-canvas'),
    btnExport: document.getElementById('btn-export'),
    btnRestart: document.getElementById('btn-restart'),
    submitStatus: document.getElementById('submit-status'),
    btnRetrySubmit: document.getElementById('btn-retry-submit'),
    btnReturnEvent: document.getElementById('btn-return-event')
  };

  // -----------------------------------------------------------------------
  // Event session plumbing (common backend integration)
  // -----------------------------------------------------------------------
  var eventParams = (typeof EventClient !== 'undefined')
    ? EventClient.getParams()
    : { sessionId: '', apiBase: '', returnUrl: '/' };

  if (eventParams.sessionId) {
    el.btnReturnEvent.href = eventParams.returnUrl.indexOf('session_id=') === -1
      ? eventParams.returnUrl + (eventParams.returnUrl.indexOf('?') === -1 ? '?' : '&') + 'session_id=' + encodeURIComponent(eventParams.sessionId)
      : eventParams.returnUrl;
    // Always offer an exit back to the event shell once we know the session;
    // submission status is communicated separately via the status line.
    el.btnReturnEvent.hidden = false;

    // Shell-driven handoff: the event shell decides which station comes next
    // and passes it on the URL. The Timer never hardcodes game order.
    var nextUrl = new URLSearchParams(window.location.search).get('next_url');
    var nextLabel = new URLSearchParams(window.location.search).get('next_label');
    var btnNext = document.getElementById('btn-next-game');
    if (btnNext && nextUrl) {
      btnNext.href = nextUrl;
      btnNext.textContent = 'Continue' + (nextLabel ? ': ' + nextLabel : '');
      btnNext.hidden = false;
    }
  }

  async function submitResultToEvent(sessionResult) {
    if (typeof EventClient === 'undefined') return; // shared helper not loaded (standalone use)
    if (!eventParams.sessionId) {
      el.submitStatus.textContent = 'No event session detected — results were not sent to the event server (use Export instead).';
      el.btnReturnEvent.hidden = true;
      return;
    }
    el.submitStatus.textContent = 'Sending results to the event server…';
    var outcome = await EventClient.submitResult(eventParams.sessionId, 'timer', sessionResult, { apiBase: eventParams.apiBase });
    if (outcome.ok) {
      el.submitStatus.textContent = 'Results saved to the event server.';
      el.btnRetrySubmit.hidden = true;
      el.btnReturnEvent.hidden = false;
    } else {
      el.submitStatus.textContent = 'Could not reach the event server (' + (outcome.error || 'unknown error') + '). Your results are saved on this device — use Retry, or Export as a backup.';
      el.btnRetrySubmit.hidden = false;
      // Return-to-event stays visible so the participant is never trapped;
      // the shell checklist will still show this station as pending.
    }
  }

  if (el.btnRetrySubmit) {
    el.btnRetrySubmit.addEventListener('click', function () {
      if (window.__pressureClockSession) submitResultToEvent(window.__pressureClockSession);
    });
  }

  function showScreen(screenEl) {
    [el.screenStart, el.screenCalibration, el.screenTransition, el.screenGame, el.screenReveal, el.screenResults].forEach(function (s) {
      s.classList.remove('screen--active');
    });
    screenEl.classList.add('screen--active');
  }

  function updateGazeDebug(sample) {
    if (!sample) {
      el.gazeDebug.hidden = true;
      return;
    }
    el.gazeDebug.hidden = false;
    el.gazeDebug.style.left = (sample.x * 100) + '%';
    el.gazeDebug.style.top = (sample.y * 100) + '%';
    el.gazeDebugLabel.textContent = 'GAZE ' + Math.round(sample.x * 100) + '% / ' + Math.round(sample.y * 100) + '%';
  }

  // -----------------------------------------------------------------------
  // Session state
  // -----------------------------------------------------------------------

  var sessionStartT = 0;
  var trialLogger = null;
  var gazePipeline = null;
  var wordSearch = null;
  var currentRound = null; // 1 | 2 | 3 | null (null = not logging, e.g. during transitions)
  var roundsMeta = {}; // round -> { durationSec, roundStartT, samples: [] }
  var transitionInterval = null;
  var roundInterval = null;
  var gazeStartTimeout = null;
  var cancelReveal = null;
  var calibrationIndex = 0;
  var calibrationClicks = 0;
  var calibrationErrors = [];
  var calibrationAvailable = false;
  var CALIBRATION_POINTS = [
    [0.15, 0.18], [0.50, 0.18], [0.85, 0.18],
    [0.15, 0.50], [0.50, 0.50], [0.85, 0.50],
    [0.15, 0.82], [0.50, 0.82], [0.85, 0.82]
  ];

  function cancelActiveFlow() {
    if (transitionInterval !== null) clearInterval(transitionInterval);
    if (roundInterval !== null) cancelAnimationFrame(roundInterval);
    if (gazeStartTimeout !== null) clearTimeout(gazeStartTimeout);
    if (cancelReveal) cancelReveal();
    transitionInterval = null;
    roundInterval = null;
    gazeStartTimeout = null;
    cancelReveal = null;
  }

  function initSession() {
    sessionStartT = performance.now();
    trialLogger = TrialLoggerLib.createTrialLogger();
    roundsMeta = {};
    currentRound = null;

    gazePipeline = GazePipelineLib.createGazePipeline({
      onSample: function (sample) {
        updateGazeDebug(sample);
        if (currentRound === null) return; // transitions: no gaze logging, per spec
        var meta = roundsMeta[currentRound];
        if (meta) meta.samples.push(sample);
      },
      onStatusChange: function (status) {
        if (!status.available) {
          el.gazeStatus.hidden = false;
          el.gazeStatus.textContent =
            'Eye-tracking unavailable (' + (status.reason || 'no camera access') + ') — continuing without gaze analytics.';
        } else {
          el.gazeStatus.hidden = true;
        }
      }
    });

    wordSearch = WordSearchLib.createWordSearch(el.wordSearchGrid, el.wordList, {
      // `spawnedType` is the type of the shape that was actually placed on
      // screen (round 2/3 spawn distractors too). The trial's `targetType`
      // always stays the round's designated target so correctness can be
      // judged from whatever the participant actually clicks, in onTrialResolved.
      onAttempt: function (attempt) {
        var meta = roundsMeta[1];
        if (!meta) return;
        var trial = trialLogger.startTrial(1, attempt.correct ? attempt.word : null, meta.roundStartT);
        trialLogger.recordResponse(trial, attempt.selectedString, attempt.at, attempt.correct);
      }
    });
  }

  // -----------------------------------------------------------------------
  // Flow
  // -----------------------------------------------------------------------

  function median(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function beginCalibration(available) {
    calibrationAvailable = available;
    calibrationIndex = 0;
    calibrationClicks = 0;
    calibrationErrors = [];
    showScreen(el.screenCalibration);
    el.btnCalibrationRetry.hidden = true;
    el.btnCalibrationContinue.hidden = false;

    if (!available) {
      el.calibrationTarget.hidden = true;
      el.calibrationInstruction.textContent = 'Camera tracking is unavailable. You can still play without gaze analytics.';
      el.calibrationProgress.textContent = '';
      el.btnCalibrationContinue.textContent = 'Continue to game';
      return;
    }

    // GazeCloudAPI owns calibration. Do not run Pressure Clock's old
    // nine-point calibration on top of it.
    el.calibrationTarget.hidden = true;
    el.calibrationInstruction.textContent = 'Eye tracking is calibrated and ready.';
    el.calibrationProgress.textContent = '';
    el.btnCalibrationContinue.hidden = false;
    el.btnCalibrationContinue.textContent = 'Start game';
  }

  function measureCalibrationPoint(dotX, dotY) {
    return new Promise(function (resolve) {
      var samples = [];
      var iv = setInterval(function () {
        var sample = gazePipeline && gazePipeline.getLatestSample();
        if (sample) samples.push({ x: sample.x * window.innerWidth, y: sample.y * window.innerHeight });
      }, 50);
      setTimeout(function () {
        clearInterval(iv);
        if (!samples.length) { resolve(null); return; }
        var avgX = samples.reduce(function (sum, p) { return sum + p.x; }, 0) / samples.length;
        var avgY = samples.reduce(function (sum, p) { return sum + p.y; }, 0) / samples.length;
        resolve(Math.hypot(avgX - dotX, avgY - dotY) / Math.hypot(window.innerWidth, window.innerHeight) * 100);
      }, 500);
    });
  }

  function placeCalibrationTarget() {
    var point = CALIBRATION_POINTS[calibrationIndex];
    el.calibrationTarget.style.left = (point[0] * 100) + '%';
    el.calibrationTarget.style.top = (point[1] * 100) + '%';
    el.calibrationTarget.hidden = false;
  }

  function finishCalibration() {
    el.calibrationTarget.hidden = true;
    var typicalError = calibrationErrors.indexOf(null) !== -1 ? null : calibrationErrors.reduce(function (sum, value) { return sum + value; }, 0) / calibrationErrors.length;
    if (typicalError === null || !calibrationErrors.length) {
      el.calibrationInstruction.textContent = 'Accuracy couldn’t be measured — no gaze data received.';
    } else if (typicalError <= 12) {
      el.calibrationInstruction.textContent = 'Calibration looks good (average error: ' + typicalError.toFixed(1) + '% of the screen diagonal).';
    } else {
      el.calibrationInstruction.textContent = 'Calibration needs improvement (average error: ' + typicalError.toFixed(1) + '% of the screen diagonal). Try again while keeping your head still.';
    }
    el.calibrationProgress.textContent = calibrationErrors.length + ' gaze checks captured.';
    el.btnCalibrationRetry.hidden = false;
    el.btnCalibrationContinue.hidden = false;
    el.btnCalibrationContinue.textContent = 'Start game';
  }

  function recordCalibrationClick() {
    if (!calibrationAvailable || calibrationIndex >= CALIBRATION_POINTS.length) return;
    calibrationClicks++;
    if (calibrationClicks < 3) {
      el.calibrationProgress.textContent = 'Point ' + (calibrationIndex + 1) + ' of ' + CALIBRATION_POINTS.length + ' — ' + (3 - calibrationClicks) + ' more click' + (calibrationClicks === 2 ? '' : 's') + '.';
      return;
    }
    calibrationClicks = 0;
    el.calibrationTarget.hidden = true;
    var rect = el.calibrationTarget.getBoundingClientRect();
    measureCalibrationPoint(rect.left + rect.width / 2, rect.top + rect.height / 2).then(function (errorPct) {
      calibrationErrors.push(errorPct);
      calibrationIndex++;
      if (calibrationIndex >= CALIBRATION_POINTS.length) finishCalibration();
      else { el.calibrationProgress.textContent = 'Point ' + (calibrationIndex + 1) + ' of ' + CALIBRATION_POINTS.length; placeCalibrationTarget(); }
    });
  }

  function begin() {
    cancelActiveFlow();
    if (gazePipeline) gazePipeline.stop();
    updateGazeDebug(null);
    if (wordSearch) wordSearch.destroy();
    initSession();
    showScreen(el.screenCalibration);
    el.calibrationTarget.hidden = true;
    el.calibrationInstruction.textContent = 'Starting the camera…';
    el.calibrationProgress.textContent = '';
    el.btnCalibrationRetry.hidden = true;
    el.btnCalibrationContinue.hidden = true;
    var settled = false;
    function completeTrackerStart(available) {
      if (settled) return;
      settled = true;
      if (gazeStartTimeout !== null) clearTimeout(gazeStartTimeout);
      gazeStartTimeout = null;
      if (hostOptions.autoStart) {
        runRoundSequence(0);
      } else {
        beginCalibration(available);
      }
    }
    // GazeCloud's built-in calibration is participant-driven. Keep the game
    // waiting for it instead of treating tracker startup as immediately done.
    gazeStartTimeout = window.setTimeout(function () { completeTrackerStart(false); }, 120000);
    gazePipeline.start({ skipCalibration: hostOptions.skipCalibration === true }).then(completeTrackerStart);
  }

  function runRoundSequence(index) {
    if (index >= 1) {
      finishAndReveal();
      return;
    }
    var cfg = ROUND_CONFIGS[index];
    runTransition(cfg, function () {
      runRound(cfg, function () {
        runRoundSequence(index + 1);
      });
    });
  }

  function runTransition(cfg, onDone) {
    currentRound = null; // no gaze logging during transitions, per spec
    showScreen(el.screenTransition);
    el.transitionEyebrow.textContent = cfg.transitionTitle.toUpperCase();
    el.transitionTitle.textContent = cfg.round === 1 ? 'Get ready' : 'Round complete';
    el.transitionBody.textContent = cfg.transitionBody;

    var count = 3;
    el.transitionCountdown.textContent = String(count);
    transitionInterval = setInterval(function () {
      count--;
      if (count <= 0) {
        clearInterval(transitionInterval);
        transitionInterval = null;
        onDone();
      } else {
        el.transitionCountdown.textContent = String(count);
      }
    }, 1000);
  }

  function runRound(cfg, onDone) {
    roundsMeta[cfg.round] = { durationSec: cfg.durationSec, roundStartT: performance.now(), samples: [] };
    currentRound = cfg.round;

    showScreen(el.screenGame);
    el.timerHud.hidden = false;
    el.instruction.innerHTML = instructionHtml(cfg);

    var durationMs = cfg.durationSec * 1000;
    var roundStartT = roundsMeta[cfg.round].roundStartT;
    console.log('Pressure Clock round start', { durationSec: cfg.durationSec, durationMs: durationMs, roundStartT: roundStartT });
    updateTimerDisplay(durationMs);

    wordSearch.startRound();

    var debugFrames = 0;
    function tick() {
      var elapsed = performance.now() - roundStartT;
      var remainingMs = durationMs - elapsed;
      if (debugFrames++ < 5) console.log('Pressure Clock timer frame', { elapsed: elapsed, remainingMs: remainingMs });
      updateTimerDisplay(remainingMs);
      if (elapsed >= durationMs) {
        roundInterval = null;
        updateTimerDisplay(0);
        endRound(cfg, onDone);
        return;
      }
      roundInterval = requestAnimationFrame(tick);
    }
    roundInterval = requestAnimationFrame(tick);
  }

  function instructionHtml(cfg) {
    return 'Find the hidden words. Drag in a straight line in any direction.';
    if (cfg.mode === 'single') {
      return 'Click the <strong>' + GameLib.typeLabel(cfg.targetType) + '</strong> as soon as it appears.';
    }
    if (cfg.mode === 'multi') {
      return 'Click only the <strong>' + GameLib.typeLabel(cfg.targetType) + '</strong> — ignore other shapes.';
    }
    return 'Match the shape shown at the top of the screen' +
      (round3TargetType ? ' (<strong>' + GameLib.typeLabel(round3TargetType) + '</strong>)' : '') + '.';
  }

  function updateTimerDisplay(remainingMs) {
    var clamped = Math.max(0, remainingMs);
    var wholeSec = Math.floor(clamped / 1000);
    var centiseconds = Math.floor((clamped % 1000) / 10);
    el.timerValueSec.textContent = String(wholeSec);
    el.timerValueMs.textContent = '.' + String(centiseconds).padStart(2, '0');
  }

  function endRound(cfg, onDone) {
    if (cfg.round === 3) {
      // Capture the game screenshot before the canvas is cleared.
      Heatmap.captureGameScreenshot(el.canvas)
        .then(function (img) { gameScreenshot = img; })
        .catch(function () { gameScreenshot = null; })
        .then(function () {
          game.stopRound();
          finishRoundBookkeeping(cfg);
          el.timerHud.hidden = true;
          currentRound = null;
          onDone();
        });
      return;
    }
    console.log('Pressure Clock round finish', { samples: roundsMeta[cfg.round].samples.length, trials: trialLogger.getTrials(cfg.round).length });
    wordSearch.stopRound();
    finishRoundBookkeeping(cfg);
    el.timerHud.hidden = true;
    currentRound = null;
    onDone();
  }

  function finishRoundBookkeeping(cfg) {
    var meta = roundsMeta[cfg.round];
    var buffered = ROI.applyBuffer(ROI.TIMER_ROI, ROI.DEFAULT_BUFFER);
    var classification = ROI.classifyGazeStream(meta.samples, buffered, ROI.DEFAULT_MIN_VISIT_MS);
    meta.classifiedSamples = classification.classifiedSamples;
    meta.timerVisits = ROI.withTimeRemaining(classification.timerVisits, meta.roundStartT, cfg.durationSec * 1000);
    meta.attentionSwitchCount = ROI.countAttentionSwitches(classification.classifiedSamples);
    meta.trials = trialLogger.getTrials(cfg.round);
  }

  // -----------------------------------------------------------------------
  // Reveal + results
  // -----------------------------------------------------------------------

  function aggregateSession() {
    var allVisits = [];
    var allSamples = [];
    var allTrials = [];
    var totalDurationSec = 0;
    var totalSwitches = 0;

    ROUND_CONFIGS.forEach(function (cfg) {
      var meta = roundsMeta[cfg.round];
      if (!meta) return;
      allVisits = allVisits.concat(meta.timerVisits);
      allSamples = allSamples.concat(meta.classifiedSamples);
      allTrials = allTrials.concat(meta.trials);
      totalDurationSec += cfg.durationSec;
      totalSwitches += meta.attentionSwitchCount;
    });

    var timerAttention = Metrics.computeTimerAttention(allVisits, totalDurationSec);
    var deadlineSensitivity = Metrics.computeDeadlineSensitivity(allVisits);
    var attentionSwitching = Metrics.computeAttentionSwitching(totalSwitches, totalDurationSec);
    var accuracy = Metrics.computeAccuracy(allTrials);
    var rtStats = Metrics.computeReactionTimeStats(allTrials);
    var performanceDelta = Metrics.computePerformanceDelta(allTrials);

    var pressure = Metrics.computePressureIndex({
      timerCheckCount: timerAttention.timerCheckCount,
      deadlineSensitivityRatio: deadlineSensitivity.deadlineSensitivityRatio,
      rtStddevMs: rtStats.stddevReactionTimeMs,
      performanceDelta: performanceDelta,
      attentionSwitchesPerMinute: attentionSwitching.switchesPerMinute
    });

    return {
      timerAttention: timerAttention,
      deadlineSensitivity: deadlineSensitivity,
      attentionSwitching: attentionSwitching,
      accuracy: accuracy,
      rtStats: rtStats,
      performanceDelta: performanceDelta,
      pressure: pressure,
      allVisits: allVisits,
      allSamples: allSamples,
      allTrials: allTrials
    };
  }

  function finishAndReveal() {
    var agg = aggregateSession();
    showScreen(el.screenReveal);
    var script = Reveal.buildRevealScript(agg.timerAttention.timerCheckCount);
    cancelReveal = Reveal.playReveal(el.revealContainer, script, function () {
      cancelReveal = null;
      showResults(agg);
    });
  }

  function fmtSec(ms) {
    return (ms / 1000).toFixed(1) + 's';
  }
  function fmtPct(frac) {
    return Math.round(frac * 100) + '%';
  }
  function fmtSignedPct(frac) {
    var pct = Math.round(frac * 100);
    return (pct > 0 ? '+' : '') + pct + '%';
  }

  function interpretationFor(agg) {
    var q = agg.deadlineSensitivity.checksPerQuarter;
    var label = agg.deadlineSensitivity.deadlineSensitivityLabel;
    if (q[3] > q[0]) {
      return 'Your timer checks rose ' + (label === 'High' ? 'sharply' : 'somewhat') +
        ' in the final quarter of each round — a pattern consistent with ' + label.toLowerCase() + ' deadline sensitivity.';
    }
    if (q[3] < q[0]) {
      return 'Your timer checks were front-loaded rather than rising near the deadline — ' +
        label.toLowerCase() + ' deadline sensitivity by this measure.';
    }
    return 'Your timer checks were evenly spread across each round — ' + label.toLowerCase() + ' deadline sensitivity.';
  }

  function showResults(agg) {
    showScreen(el.screenResults);

    var rows = [
      ['TIMER CHECKS', String(agg.timerAttention.timerCheckCount)],
      ['TOTAL TIMER TIME', fmtSec(agg.timerAttention.totalDwellMs)],
      ['AVG GLANCE LENGTH', agg.timerAttention.timerCheckCount ? fmtSec(agg.timerAttention.avgGlanceMs) : '\u2014'],
      ['CHECKS / MINUTE', agg.timerAttention.checksPerMinute.toFixed(1)],
      ['ACCURACY', fmtPct(agg.accuracy)],
      ['AVG REACTION TIME', agg.rtStats.sampleSize ? fmtSec(agg.rtStats.meanReactionTimeMs) : '\u2014'],
      ['MEDIAN REACTION TIME', agg.rtStats.sampleSize ? fmtSec(agg.rtStats.medianReactionTimeMs) : '\u2014'],
      ['RT VARIABILITY (STD DEV)', agg.rtStats.sampleSize ? fmtSec(agg.rtStats.stddevReactionTimeMs) : '\u2014'],
      ['ATTENTION SWITCHING', agg.attentionSwitching.switchesPerMinute.toFixed(1) + '/min'],
      ['DEADLINE SENSITIVITY', agg.deadlineSensitivity.deadlineSensitivityLabel + ' (' + agg.deadlineSensitivity.deadlineSensitivityRatio.toFixed(2) + ')'],
      ['PERFORMANCE CHANGE', agg.performanceDelta === null ? 'n/a (too few trials)' : fmtSignedPct(agg.performanceDelta)]
    ];

    el.metricsTable.innerHTML = rows
      .map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
      })
      .join('');

    el.pressureIndexValue.textContent = agg.pressure.pressureIndex + '/100';
    el.interpretationLine.textContent = interpretationFor(agg);

    // Build and submit the session result BEFORE any visualization work so a
    // rendering problem can never block submission or leaving the game.
    window.__pressureClockSession = buildSessionResult(agg);
    var submission = submitResultToEvent(window.__pressureClockSession);
    if (typeof hostOptions.onTimerComplete === 'function') {
      Promise.resolve(submission).then(function (outcome) {
        hostOptions.onTimerComplete(window.__pressureClockSession, outcome);
      });
    }

    try {
      renderHeatmapCanvas(agg.allSamples);
    } catch (err) {
      // The heatmap is cosmetic; leave the canvas blank and keep the flow alive.
      console.warn('Pressure Clock: heatmap rendering failed:', err);
    }
  }

  function renderHeatmapCanvas(allSamples) {
    var canvas = el.heatmapCanvas;
    var cssWidth = canvas.clientWidth || 600;
    var cssHeight = canvas.clientHeight || 320;
    canvas.width = cssWidth * window.devicePixelRatio;
    canvas.height = cssHeight * window.devicePixelRatio;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    Heatmap.renderHeatmap(ctx, cssWidth, cssHeight, null, allSamples);
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  function relTime(t) {
    return Math.round(t - sessionStartT);
  }

  function buildSessionResult(agg) {
    var rounds = ROUND_CONFIGS.map(function (cfg) {
      var meta = roundsMeta[cfg.round];
      return {
        roundNum: cfg.round,
        durationSec: cfg.durationSec,
        trials: (meta ? meta.trials : []).map(function (t) {
          return {
            round: t.round,
            trialId: t.trialId,
            targetShownAt: relTime(t.targetShownAt),
            respondedAt: t.respondedAt === null ? null : relTime(t.respondedAt),
            reactionTimeMs: t.reactionTimeMs,
            correct: t.correct,
            targetType: t.targetType,
            clickedType: t.clickedType
          };
        })
      };
    });

    var gazeSamples = [];
    var timerVisits = [];
    ROUND_CONFIGS.forEach(function (cfg) {
      var meta = roundsMeta[cfg.round];
      if (!meta) return;
      meta.classifiedSamples.forEach(function (s) {
        gazeSamples.push({ t: relTime(s.t), x: s.x, y: s.y, region: s.region });
      });
      meta.timerVisits.forEach(function (v) {
        timerVisits.push({
          startT: relTime(v.startT),
          endT: relTime(v.endT),
          durationMs: v.durationMs,
          timeRemainingAtVisit: v.timeRemainingAtVisit
        });
      });
    });

    return {
      rounds: rounds,
      gazeSamples: gazeSamples,
      timerVisits: timerVisits,
      metrics: {
        timerCheckCount: agg.timerAttention.timerCheckCount,
        totalDwellMs: agg.timerAttention.totalDwellMs,
        avgGlanceMs: agg.timerAttention.avgGlanceMs,
        checksPerMinute: agg.timerAttention.checksPerMinute,
        deadlineSensitivityRatio: agg.deadlineSensitivity.deadlineSensitivityRatio,
        deadlineSensitivityLabel: agg.deadlineSensitivity.deadlineSensitivityLabel,
        checksPerQuarter: agg.deadlineSensitivity.checksPerQuarter,
        attentionSwitchesPerMinute: agg.attentionSwitching.switchesPerMinute,
        accuracy: agg.accuracy,
        meanReactionTimeMs: agg.rtStats.meanReactionTimeMs,
        medianReactionTimeMs: agg.rtStats.medianReactionTimeMs,
        stddevReactionTimeMs: agg.rtStats.stddevReactionTimeMs,
        performanceDelta: agg.performanceDelta,
        pressureIndex: agg.pressure.pressureIndex,
        pressureIndexComponentScores: agg.pressure.componentScores,
        note: 'Experimental behavioral score, not a clinical measure. Pressure Index calibration ranges are placeholders — see js/metrics.js DEFAULT_CALIBRATION.'
      }
    };
  }

  function exportSession() {
    var data = window.__pressureClockSession;
    if (!data) return;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pressure-clock-session-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // -----------------------------------------------------------------------
  // Wire up UI
  // -----------------------------------------------------------------------

  el.btnStart.addEventListener('click', begin);
  el.calibrationTarget.addEventListener('click', recordCalibrationClick);
  el.btnCalibrationRetry.addEventListener('click', function () { beginCalibration(calibrationAvailable); });
  el.btnCalibrationContinue.addEventListener('click', function () { runRoundSequence(0); });
  el.btnExport.addEventListener('click', exportSession);
  el.btnRestart.addEventListener('click', function () {
    cancelActiveFlow();
    if (gazePipeline) gazePipeline.stop();
    updateGazeDebug(null);
    if (wordSearch) wordSearch.destroy();
    el.gazeStatus.hidden = true;
    showScreen(el.screenStart);
  });
})();
