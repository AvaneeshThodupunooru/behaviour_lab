/**
 * gaze-pipeline.js — WebGazer wiring.
 * Browser-only (touches window/document/webgazer), not unit tested as a
 * pure function like roi.js/metrics.js. Responsibilities:
 *   - start/stop WebGazer
 *   - normalize its pixel (x, y) output to 0-1 screen-fraction coordinates
 *   - suppress WebGazer's own video preview / prediction dot (the whole
 *     point of the study is that gaze tracking is not visible to the
 *     participant — see spec §8)
 *   - fail soft: if the camera is denied or WebGazer errors, the game
 *     keeps running with gaze tracking simply marked unavailable
 */
(function (root) {
  'use strict';

  function createGazePipeline(options) {
    options = options || {};
    var cameraSerialNo = options.cameraSerialNo !== undefined ? Number(options.cameraSerialNo) : 1;
    if (!Number.isFinite(cameraSerialNo) || cameraSerialNo < 0) {
      cameraSerialNo = 1;
    }

    var onSample = options.onSample || function () {};
    var onStatusChange = options.onStatusChange || function () {};

    var available = false;
    var running = false;
    var latestSample = null;

    function normalizeSample(x, y, t) {
      return {
        t: t,
        x: clamp01(x / window.innerWidth),
        y: clamp01(y / window.innerHeight)
      };
    }

    function clamp01(v) {
      return Math.max(0, Math.min(1, v));
    }

    /**
     * @returns {Promise<boolean>} resolves true if tracking started, false if unavailable
     */
    function start() {
      if (typeof root.webgazer === 'undefined') {
        available = false;
        onStatusChange({ available: false, reason: 'WebGazer.js failed to load (offline, or CDN blocked).' });
        return Promise.resolve(false);
      }

      try {
        root.webgazer.cameraSerialNo = cameraSerialNo;

        root.webgazer
          .setRegression('ridge')
          .setGazeListener(function (data, elapsedTime) {
            if (!data) return;
            latestSample = normalizeSample(data.x, data.y, performance.now());
            if (running) onSample(latestSample);
          })
          .saveDataAcrossSessions(false);

        // Hide every visual trace of tracking — participants must not be
        // cued that their eyes are being watched (spec §7a / §8).
        root.webgazer.showVideo(false);
        root.webgazer.showFaceOverlay(false);
        root.webgazer.showFaceFeedbackBox(false);
        root.webgazer.showPredictionPoints(false);

        return root.webgazer
          .begin()
          .then(function () {
            available = true;
            running = true;
            onStatusChange({ available: true });
            return true;
          })
          .catch(function (err) {
            available = false;
            onStatusChange({ available: false, reason: (err && err.message) || 'Camera permission denied or tracker init failed.' });
            return false;
          });
      } catch (err) {
        available = false;
        onStatusChange({ available: false, reason: (err && err.message) || 'Unexpected gaze pipeline error.' });
        return Promise.resolve(false);
      }
    }

    function pause() {
      running = false;
    }

    function resume() {
      if (available) running = true;
    }

    function stop() {
      running = false;
      available = false;
      latestSample = null;
      if (typeof root.webgazer !== 'undefined') {
        try {
          root.webgazer.end();
        } catch (err) {
          // Already stopped or never fully started — nothing to clean up.
        }
      }
    }

    function isAvailable() {
      return available;
    }

    function getLatestSample() {
      return latestSample;
    }

    return { start: start, pause: pause, resume: resume, stop: stop, isAvailable: isAvailable, getLatestSample: getLatestSample };
  }

  root.PressureClockGazePipeline = { createGazePipeline: createGazePipeline };
})(typeof window !== 'undefined' ? window : globalThis);
