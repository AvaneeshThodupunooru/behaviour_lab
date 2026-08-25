/**
 * Run with: node tests/roi.test.js
 * No dependencies — Node's built-in `assert` only, matching the project's
 * "no build step" constraint.
 */
var assert = require('assert');
var roi = require('../js/roi.js');

var ROI = roi.TIMER_ROI; // {xMin:0.80, yMin:0, xMax:1.0, yMax:0.20}

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

console.log('roi.js');

test('inROI: a sample dead-center of the ROI is inside', function () {
  assert.strictEqual(roi.inROI({ x: 0.9, y: 0.1 }, ROI), true);
});

test('inROI: a sample outside the ROI (game area) is outside', function () {
  assert.strictEqual(roi.inROI({ x: 0.5, y: 0.5 }, ROI), false);
});

test('applyBuffer expands and clamps to [0,1]', function () {
  var buffered = roi.applyBuffer(ROI, 0.02);
  assert.ok(Math.abs(buffered.xMin - 0.78) < 1e-9);
  assert.strictEqual(buffered.xMax, 1); // clamped, can't exceed 1
  assert.ok(Math.abs(buffered.yMax - 0.22) < 1e-9);
});

test('classifyGazeStream: a single 500ms dwell inside the ROI produces exactly one visit, not one per sample', function () {
  // 15 samples across 500ms, all inside ROI — mirrors the spec's own example
  // ("a 0.5s glance can produce 15 raw samples at 30Hz — that's one visit").
  var samples = [];
  for (var i = 0; i < 15; i++) {
    samples.push({ t: i * (500 / 15), x: 0.9, y: 0.1 });
  }
  var result = roi.classifyGazeStream(samples, ROI, 100);
  assert.strictEqual(result.timerVisits.length, 1);
  assert.ok(result.timerVisits[0].durationMs > 400);
});

test('classifyGazeStream: debounce drops visits shorter than minVisitMs', function () {
  var samples = [
    { t: 0, x: 0.5, y: 0.5 },   // outside
    { t: 10, x: 0.9, y: 0.1 }, // inside (brief flicker)
    { t: 40, x: 0.9, y: 0.1 }, // still inside
    { t: 60, x: 0.5, y: 0.5 }  // back outside — total dwell 50ms < 100ms
  ];
  var result = roi.classifyGazeStream(samples, ROI, 100);
  assert.strictEqual(result.timerVisits.length, 0);
});

test('classifyGazeStream: two separate dwells produce two visits', function () {
  var samples = [
    { t: 0, x: 0.9, y: 0.1 },
    { t: 200, x: 0.9, y: 0.1 },
    { t: 400, x: 0.5, y: 0.5 },   // exit
    { t: 600, x: 0.5, y: 0.5 },
    { t: 800, x: 0.9, y: 0.1 },   // re-enter
    { t: 1000, x: 0.9, y: 0.1 },
    { t: 1200, x: 0.5, y: 0.5 }   // exit
  ];
  var result = roi.classifyGazeStream(samples, ROI, 100);
  assert.strictEqual(result.timerVisits.length, 2);
});

test('classifyGazeStream: a visit still open at end-of-stream is flushed, not dropped', function () {
  var samples = [
    { t: 0, x: 0.5, y: 0.5 },
    { t: 100, x: 0.9, y: 0.1 },
    { t: 500, x: 0.9, y: 0.1 } // stream ends while still inside the ROI
  ];
  var result = roi.classifyGazeStream(samples, ROI, 100);
  assert.strictEqual(result.timerVisits.length, 1);
  assert.strictEqual(result.timerVisits[0].durationMs, 400);
});

test('classifyGazeStream: classifiedSamples are tagged with the right region', function () {
  var samples = [{ t: 0, x: 0.9, y: 0.1 }, { t: 50, x: 0.5, y: 0.5 }];
  var result = roi.classifyGazeStream(samples, ROI, 0);
  assert.strictEqual(result.classifiedSamples[0].region, 'timer');
  assert.strictEqual(result.classifiedSamples[1].region, 'game');
});

test('withTimeRemaining: elapsedFrac and timeRemainingAtVisit are computed relative to round start', function () {
  var visits = [{ startT: 5000, endT: 5300, durationMs: 300 }];
  var out = roi.withTimeRemaining(visits, 0, 10000); // 10s round, visit at 5s in
  assert.ok(Math.abs(out[0].elapsedFrac - 0.5) < 1e-9);
  assert.ok(Math.abs(out[0].timeRemainingAtVisit - 5) < 1e-9);
});

test('countAttentionSwitches: counts game<->timer transitions only', function () {
  var samples = [
    { region: 'game' }, { region: 'game' }, { region: 'timer' },
    { region: 'timer' }, { region: 'game' }, { region: 'timer' }
  ];
  // game->timer, timer->game, game->timer = 3 switches
  assert.strictEqual(roi.countAttentionSwitches(samples), 3);
});

console.log('');
