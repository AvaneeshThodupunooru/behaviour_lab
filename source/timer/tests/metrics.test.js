/**
 * Run with: node tests/metrics.test.js
 */
var assert = require('assert');
var metrics = require('../js/metrics.js');

function test(name, fn) {
  try {
    fn();
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('metrics.js');

test('computeTimerAttention: totals, average, and per-minute rate', function () {
  var visits = [{ durationMs: 400 }, { durationMs: 600 }, { durationMs: 500 }];
  var out = metrics.computeTimerAttention(visits, 30); // 30s round
  assert.strictEqual(out.timerCheckCount, 3);
  assert.strictEqual(out.totalDwellMs, 1500);
  assert.strictEqual(out.avgGlanceMs, 500);
  assert.strictEqual(out.checksPerMinute, 6); // 3 checks / 0.5 min
});

test('computeTimerAttention: zero visits does not divide by zero', function () {
  var out = metrics.computeTimerAttention([], 30);
  assert.strictEqual(out.avgGlanceMs, 0);
});

test('computeDeadlineSensitivity: checks concentrated in the last quarter score High', function () {
  var visits = [
    { elapsedFrac: 0.85 }, { elapsedFrac: 0.9 }, { elapsedFrac: 0.95 }, { elapsedFrac: 0.99 }
  ];
  var out = metrics.computeDeadlineSensitivity(visits);
  assert.strictEqual(out.checksPerQuarter[3], 4);
  assert.strictEqual(out.checksPerQuarter[0], 0);
  assert.strictEqual(out.deadlineSensitivityRatio, 4); // 4 / (0 + 1)
  assert.strictEqual(out.deadlineSensitivityLabel, 'High');
});

test('computeDeadlineSensitivity: evenly spread checks score Low', function () {
  var visits = [{ elapsedFrac: 0.1 }, { elapsedFrac: 0.4 }, { elapsedFrac: 0.6 }, { elapsedFrac: 0.9 }];
  var out = metrics.computeDeadlineSensitivity(visits);
  assert.strictEqual(out.deadlineSensitivityRatio, 0.5); // 1 / (1 + 1)
  assert.strictEqual(out.deadlineSensitivityLabel, 'Low');
});

test('computeAccuracy: correct fraction of trials', function () {
  var trials = [{ correct: true }, { correct: true }, { correct: false }, { correct: true }];
  assert.strictEqual(metrics.computeAccuracy(trials), 0.75);
});

test('computeAccuracy: empty trial list is 0, not NaN', function () {
  assert.strictEqual(metrics.computeAccuracy([]), 0);
});

test('computeReactionTimeStats: mean/median/stddev, ignoring null (missed) trials', function () {
  var trials = [
    { reactionTimeMs: 400 },
    { reactionTimeMs: 600 },
    { reactionTimeMs: null }, // a miss — must not pollute RT stats
    { reactionTimeMs: 500 }
  ];
  var out = metrics.computeReactionTimeStats(trials);
  assert.strictEqual(out.sampleSize, 3);
  assert.strictEqual(out.meanReactionTimeMs, 500);
  assert.strictEqual(out.medianReactionTimeMs, 500);
  assert.ok(out.stddevReactionTimeMs > 0);
});

test('computePerformanceDelta: decline from first third to last third is negative', function () {
  var trials = [
    { targetShownAt: 0, correct: true },
    { targetShownAt: 1, correct: true },
    { targetShownAt: 2, correct: true },
    { targetShownAt: 3, correct: false },
    { targetShownAt: 4, correct: false },
    { targetShownAt: 5, correct: false }
  ];
  var delta = metrics.computePerformanceDelta(trials);
  assert.strictEqual(delta, -1); // 0% correct in last third - 100% correct in first third
});

test('computePerformanceDelta: too few trials returns null rather than a misleading number', function () {
  assert.strictEqual(metrics.computePerformanceDelta([{ targetShownAt: 0, correct: true }]), null);
});

test('computePressureIndex: worst-case inputs saturate near 100', function () {
  var out = metrics.computePressureIndex({
    timerCheckCount: 999,
    deadlineSensitivityRatio: 999,
    rtStddevMs: 999999,
    performanceDelta: -1,
    attentionSwitchesPerMinute: 999
  });
  assert.strictEqual(out.pressureIndex, 100);
});

test('computePressureIndex: best-case inputs are near 0', function () {
  var out = metrics.computePressureIndex({
    timerCheckCount: 0,
    deadlineSensitivityRatio: 0,
    rtStddevMs: 0,
    performanceDelta: 1, // pure improvement
    attentionSwitchesPerMinute: 0
  });
  assert.strictEqual(out.pressureIndex, 0);
});

console.log('');
