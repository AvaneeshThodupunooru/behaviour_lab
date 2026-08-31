(function () {
  'use strict';

  var calibrationScreen = document.getElementById('merged-calibration-screen');
  var calibrationStatus = document.getElementById('merged-calibration-status');
  var startButton = document.getElementById('merged-start');
  var experimentScreen = document.getElementById('experimentScreen');
  var timerApp = document.getElementById('app');
  var completedGazeResult = null;
  var images = [];
  var eventParams = EventClient.getParams();

  // Retry any results stranded in localStorage from a prior failed submission.
  if (eventParams.sessionId) {
    EventClient.flushPending(eventParams.sessionId, 'gaze', { apiBase: eventParams.apiBase });
    EventClient.flushPending(eventParams.sessionId, 'timer', { apiBase: eventParams.apiBase });
  }

  function showGazePhase() {
    calibrationScreen.hidden = true;
    timerApp.hidden = true;
    experimentScreen.style.display = 'flex';
  }

  function gazeResult() {
    // Matches the gaze game's existing buildEventResult payload.
    return { imageCount: images.length, sampleCount: DataStore.getAllSamples().length, questionResults: Experiment.getQuestionResults() };
  }

  function nextUrl() {
    return new URLSearchParams(window.location.search).get('next_url') || eventParams.returnUrl;
  }

  function startTimerPhase() {
    experimentScreen.style.display = 'none';
    timerApp.hidden = false;
    completedGazeResult = gazeResult();
    document.getElementById('btn-start').click();
  }

  window.PressureClockHostOptions.onTimerComplete = function (timerResult, timerSubmission) {
    // Keep backend game records separate: both payloads are submitted only
    // after Phase 2 completes, then the station follows the shell handoff.
    var gazeSubmission = EventClient.submitResult(eventParams.sessionId, 'gaze', completedGazeResult, { apiBase: eventParams.apiBase });
    Promise.allSettled([gazeSubmission, Promise.resolve(timerSubmission)]).then(function () {
      window.location.href = nextUrl();
    });
  };

  function startGazePhase() {
    showGazePhase();
    Experiment.start(images, startTimerPhase);
  }

  async function begin() {
    startButton.disabled = true;
    calibrationStatus.textContent = 'Loading the four optical-illusion images…';
    images = await detectImages();
    if (images.length !== 4) {
      calibrationStatus.textContent = 'Expected four images in Images/. Please restore the station assets and reload.';
      return;
    }
    calibrationStatus.textContent = 'Allow camera access, then complete the GazeCloud calibration.';
    GazeTracker.onCamDenied(function () {
      calibrationScreen.hidden = false;
      calibrationStatus.textContent = 'Camera access was denied. Reload and allow camera access to continue.';
    });
    GazeTracker.onError(function (message) {
      calibrationScreen.hidden = false;
      calibrationStatus.textContent = 'Eye tracker error: ' + message;
    });
    GazeTracker.onCalibrationComplete(startGazePhase);
    // GazeCloud renders its own full-screen calibration overlay.
    calibrationScreen.hidden = true;
    GazeTracker.start();
  }

  startButton.addEventListener('click', function () { begin().catch(function (err) {
    calibrationStatus.textContent = err.message || 'Could not start this station.';
  }); });
})();
