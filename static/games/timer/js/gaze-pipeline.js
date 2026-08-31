/**
 * gaze-pipeline.js — GazeCloudAPI wiring.
 * Browser-only (touches window/document/GazeCloudAPI), not unit tested as a
 * pure function like roi.js/metrics.js. It adapts GazeCloud's pixel samples
 * to the normalized {t, x, y} contract used by the Pressure Clock.
 */
(function (root) {
  'use strict';

  function createGazePipeline(options) {
    options = options || {};
    var onSample = options.onSample || function () {};
    var onStatusChange = options.onStatusChange || function () {};
    var available = false;
    var running = false;
    var trackerStartedOnThisPage = false;
    var latestSample = null;
    var startPromise = null;

    function clamp01(value) {
      return Math.max(0, Math.min(1, value));
    }

    function normalizeSample(gazeData) {
      return {
        t: performance.now(),
        x: clamp01(Number(gazeData.docX) / window.innerWidth),
        y: clamp01(Number(gazeData.docY) / window.innerHeight)
      };
    }

    function fail(reason, resolve) {
      available = false;
      running = false;
      startPromise = null;
      onStatusChange({ available: false, reason: reason });
      if (resolve) resolve(false);
    }

    function attachCallbacks(resolve) {
      root.GazeCloudAPI.OnResult = function (gazeData) {
        // GazeCloud uses state 0 for a valid, calibrated gaze estimate.
        if (!gazeData || gazeData.state !== 0) return;
        latestSample = normalizeSample(gazeData);
        if (running) onSample(latestSample);
      };

      root.GazeCloudAPI.OnCalibrationComplete = function () {
        available = true;
        running = true;
        trackerStartedOnThisPage = true;
        startPromise = null;
        onStatusChange({ available: true });
        resolve(true);
      };

      root.GazeCloudAPI.OnCamDenied = function () {
        fail('Camera permission denied.', resolve);
      };

      root.GazeCloudAPI.OnError = function (message) {
        fail(message || 'GazeCloudAPI failed to start.', resolve);
      };
    }

    /**
     * @param {object} [startOptions]
     * @param {boolean} [startOptions.skipCalibration=false] Reuse tracking
     * already started in this same document. GazeCloud cannot carry a live
     * tracker through a full-page navigation.
     * @returns {Promise<boolean>} true when calibrated tracking is available
     */
    function start(startOptions) {
      startOptions = startOptions || {};
      if (typeof root.GazeCloudAPI === 'undefined') {
        available = false;
        onStatusChange({ available: false, reason: 'GazeCloudAPI failed to load (offline, or CDN blocked).' });
        return Promise.resolve(false);
      }

      if (startOptions.skipCalibration) {
        // The caller owns the lifetime check here (for example, a shell that
        // keeps GazeCloud alive in a shared iframe). Do not call
        // StartEyeTracking: that would reopen GazeCloud's calibration UI.
        attachCallbacks(function () {});
        trackerStartedOnThisPage = true;
        available = true;
        running = true;
        onStatusChange({ available: true });
        return Promise.resolve(true);
      }

      if (startPromise) return startPromise;
      if (trackerStartedOnThisPage && available) {
        running = true;
        return Promise.resolve(true);
      }

      startPromise = new Promise(function (resolve) {
        try {
          attachCallbacks(resolve);
          root.GazeCloudAPI.StartEyeTracking();
        } catch (err) {
          fail((err && err.message) || 'Unexpected GazeCloudAPI error.', resolve);
        }
      });
      return startPromise;
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
      startPromise = null;
      trackerStartedOnThisPage = false;
      if (typeof root.GazeCloudAPI !== 'undefined') {
        try {
          root.GazeCloudAPI.StopEyeTracking();
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
