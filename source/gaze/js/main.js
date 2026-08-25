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
    });
  });

  GazeTracker.start();
}

document.addEventListener('DOMContentLoaded', initSetupScreen);