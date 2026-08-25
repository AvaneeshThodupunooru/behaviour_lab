function showScreen(id) {
  document.querySelectorAll('section').forEach(s => s.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}

async function initSetupScreen() {
  const statusEl = document.getElementById('setupStatus');
  const listEl = document.getElementById('imageList');
  const startBtn = document.getElementById('startExperimentBtn');

  statusEl.textContent = 'Scanning images/ folder...';
  const images = await detectImages();

  if (images.length === 0) {
    statusEl.textContent = 'No images found. Add 1.jpg, 2.png, etc. to the images/ folder, then reload this page.';
    return;
  }

  statusEl.textContent = `${images.length} image(s) detected.`;
  listEl.innerHTML = '';
  images.forEach(img => {
    const li = document.createElement('li');
    li.textContent = `Poster ${img.id}: ${img.url} — ${img.width}×${img.height}`;
    listEl.appendChild(li);
  });

  startBtn.disabled = false;
  startBtn.addEventListener('click', () => startCalibration(images));

  window.detectedImages = images;
}
function renderResults(images) {
  const container = document.getElementById('resultsList');
  container.innerHTML = '';

  images.forEach(img => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '30px';

    const title = document.createElement('h3');
    title.textContent = `Poster ${img.id}`;
    wrapper.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.style.maxWidth = '500px';
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.border = '1px solid #ccc';
    wrapper.appendChild(canvas);

    container.appendChild(wrapper);

    const posterImg = new Image();
    posterImg.onload = () => {
      const samples = DataStore.getSamplesForImage(img.id);
      Heatmap.drawHeatmap(canvas, posterImg, samples);
    };
    posterImg.src = img.url;
  });
}

function startCalibration(images) {
  showScreen('calibrationScreen');
  const statusEl = document.getElementById('calibrationStatus');
  statusEl.textContent = 'Starting eye tracker... allow camera access if prompted.';

  GazeTracker.onCamDenied(() => {
    statusEl.textContent = 'Camera access denied. Please allow camera permission and reload the page.';
  });

  GazeTracker.onError((msg) => {
    statusEl.textContent = 'Eye tracker error: ' + msg;
    console.error('GazeCloudAPI error:', msg);
  });

      GazeTracker.onCalibrationComplete(() => {
    showScreen('experimentScreen');
    Experiment.start(images, () => {
      showScreen('resultsScreen');
      renderResults(images);
      submitEventResults(images);
    });
  });

  GazeTracker.start();
}

// ------------------------------------------------------------------------
// Event session integration — wraps ONLY the existing completion stage.
// Reads what the experiment already collected (DataStore samples) plus the
// number of posters shown; no new tracking, calibration or heatmap logic.
// ------------------------------------------------------------------------
var lastEventImages = null;

function buildEventResult(images) {
  return {
    imageCount: images.length,
    sampleCount: DataStore.getAllSamples().length
  };
}

async function submitEventResults(images) {
  if (typeof EventClient === 'undefined') return; // standalone use, no backend
  var params = EventClient.getParams();
  var statusEl = document.getElementById('submitStatus');
  var retryBtn = document.getElementById('retrySubmitBtn');
  var returnBtn = document.getElementById('returnEventBtn');
  if (!params.sessionId) {
    if (statusEl) statusEl.textContent = 'No event session detected \u2014 results kept on this page only.';
    return;
  }
  lastEventImages = images;
  var target = params.returnUrl + (params.returnUrl.indexOf('?') === -1 ? '?' : '&') +
    'session_id=' + encodeURIComponent(params.sessionId);
  if (returnBtn) returnBtn.href = target;

  if (statusEl) statusEl.textContent = 'Sending results to the event server\u2026';
  var outcome = await EventClient.submitResult(params.sessionId, 'gaze', buildEventResult(images), { apiBase: params.apiBase });
  if (outcome.ok) {
    if (statusEl) statusEl.textContent = 'Results saved to the event server.';
    if (retryBtn) retryBtn.hidden = true;
    if (returnBtn) returnBtn.hidden = false;
  } else {
    if (statusEl) statusEl.textContent = 'Could not reach the event server (' + (outcome.error || 'unknown error') + '). You can retry.';
    if (retryBtn) retryBtn.hidden = false;
    if (returnBtn) returnBtn.hidden = true;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var retryBtn = document.getElementById('retrySubmitBtn');
  if (retryBtn) retryBtn.addEventListener('click', function () {
    if (lastEventImages) submitEventResults(lastEventImages);
  });
});

document.addEventListener('DOMContentLoaded', initSetupScreen);