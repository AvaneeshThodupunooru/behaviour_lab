(function () {
  'use strict';

  var calibrationScreen = document.getElementById('merged-calibration-screen');
  var calibrationStatus = document.getElementById('merged-calibration-status');
  var startButton = document.getElementById('merged-start');
  var experimentScreen = document.getElementById('experimentScreen');
  var timerApp = document.getElementById('app');
  var completedTimerSubmission = null;
  var images = [];
  var eventParams = EventClient.getParams();
  var participantAge = eventParams.age ? parseInt(eventParams.age, 10) : null;
  var participantGender = eventParams.gender || null;
  var participantCategory = eventParams.category || null;

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

  function showTimerPhase() {
    calibrationScreen.hidden = true;
    experimentScreen.style.display = 'none';
    timerApp.hidden = false;
  }

  function gazeResult() {
    // Matches the gaze game's existing buildEventResult payload,
    // augmented with per-image gaze sample paths for the final report.
    return {
      imageCount: images.length,
      sampleCount: DataStore.getAllSamples().length,
      questionResults: Experiment.getQuestionResults(),
      category: participantCategory,
      age: participantAge,
      gender: participantGender,
      images: images.map(function (img) {
        return {
          id: img.id,
          url: img.url,
          width: img.width,
          height: img.height,
          samples: DataStore.getSamplesForImage(img.id)
        };
      })
    };
  }

  function nextUrl() {
    return new URLSearchParams(window.location.search).get('next_url') || eventParams.returnUrl;
  }

  // Phase 1: Pressure Clock (runs immediately after eye-tracker calibration)
  function startTimerPhase() {
    showTimerPhase();
    document.getElementById('btn-start').click();
  }

  // Phase 2: Gaze Experiment (runs immediately after Pressure Clock finishes)
  function startGazePhase() {
    showGazePhase();
    Experiment.start(images, onGazeComplete);
  }

  // Phase 1 completion hook: triggered by Pressure Clock when 35s round finishes
  window.PressureClockHostOptions.onTimerComplete = function (timerResult, timerSubmission) {
    completedTimerSubmission = timerSubmission;
    // Seamlessly transition to Gaze images without recalibrating
    startGazePhase();
  };

  // Phase 2 completion hook: triggered after participant completes the 4 recall questions
  function onGazeComplete() {
    var completedGazeResult = gazeResult();
    var gazeSubmission = EventClient.submitResult(eventParams.sessionId, 'gaze', completedGazeResult, { apiBase: eventParams.apiBase });
    Promise.allSettled([gazeSubmission, Promise.resolve(completedTimerSubmission)]).then(function () {
      window.location.href = nextUrl();
    });
  }

  async function begin() {
    startButton.disabled = true;
    calibrationStatus.textContent = 'Loading images…';

    if (participantCategory && CATEGORY_IMAGE_NUMBERS[participantCategory]) {
      // Normal path: 2 random images out of this category's pool. Tolerant
      // of the category not having its full 4-image set on disk yet — tops
      // itself up from whatever images do exist. See categories.js.
      images = await loadImagesForCategory(participantCategory, 2);
    } else {
      // Fallback for launching this page directly without going through
      // the shell's participant form (no age/gender on the URL) — keeps
      // the station usable for standalone testing instead of hard-failing.
      console.warn('gaze-timer: no valid category on URL, falling back to the first 2 detected images.');
      var allImages = await detectImages();
      images = allImages.slice(0, 2);
    }

    if (!images || images.length === 0) {
      calibrationStatus.textContent = 'No images found for this station. Please check station assets and reload.';
      startButton.disabled = false;
      return;
    }

    calibrationStatus.textContent = 'Allow camera access, then complete the GazeCloud calibration.';

    var continueAnywayBtn = document.getElementById('btn-continue-anyway');
    if (!continueAnywayBtn) {
      continueAnywayBtn = document.createElement('button');
      continueAnywayBtn.id = 'btn-continue-anyway';
      continueAnywayBtn.className = 'btn btn--ghost';
      continueAnywayBtn.type = 'button';
      continueAnywayBtn.style.marginTop = '10px';
      continueAnywayBtn.style.display = 'none';
      continueAnywayBtn.textContent = 'Continue without eye-tracking';
      continueAnywayBtn.addEventListener('click', function () {
        calibrationScreen.hidden = true;
        startTimerPhase();
      });
      calibrationScreen.querySelector('.panel').appendChild(continueAnywayBtn);
    }

    GazeTracker.onCamDenied(function () {
      calibrationScreen.hidden = false;
      calibrationStatus.textContent = 'Camera access was denied. You can reload to allow camera, or continue without tracking.';
      continueAnywayBtn.style.display = 'inline-block';
    });

    GazeTracker.onError(function (message) {
      calibrationScreen.hidden = false;
      calibrationStatus.textContent = 'Eye tracker note: ' + message;
      continueAnywayBtn.style.display = 'inline-block';
    });

    // Eye tracking calibration completes -> start Pressure Clock
    GazeTracker.onCalibrationComplete(function () {
      calibrationScreen.hidden = true;
      startTimerPhase();
    });

    // GazeCloud renders its own full-screen calibration overlay.
    calibrationScreen.hidden = true;
    GazeTracker.start();
  }

  startButton.addEventListener('click', function () {
    begin().catch(function (err) {
      calibrationStatus.textContent = err.message || 'Could not start this station.';
      startButton.disabled = false;
    });
  });
})();
