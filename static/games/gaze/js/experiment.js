const Experiment = (function () {
  // Four posters × five seconds = the merged station's 20-second phase.
  const POSTER_DURATION_MS = 5000;
  let images = [];
  let currentIndex = 0;
  let currentImgEl = null;
  let currentImgDocRect = null; // {left, top, width, height} in document coordinates
  let onCompleteCb = null;

  function mapGazeToImagePixels(docX, docY) {
    if (!currentImgDocRect) return null;
    const { left, top, width, height } = currentImgDocRect;

    // Outside the displayed image (i.e. gaze landed on the letterbox padding)
    if (docX < left || docX > left + width || docY < top || docY > top + height) {
      return null;
    }

    const img = images[currentIndex];
    const relX = (docX - left) / width;   // 0..1 across the displayed image
    const relY = (docY - top) / height;

    return {
      x: relX * img.width,   // scaled to the ORIGINAL image's pixel dimensions
      y: relY * img.height
    };
  }

  function showPoster(index) {
    currentIndex = index;
    const img = images[index];

    const container = document.getElementById('posterContainer');
    container.innerHTML = '';
    currentImgEl = document.createElement('img');
    currentImgEl.src = img.url;
    currentImgEl.id = 'posterImg';
    container.appendChild(currentImgEl);

    document.getElementById('posterCounter').textContent =
      `Image ${index + 1} / ${images.length}`;

    // Wait for layout, then record where the image actually landed on screen
    currentImgEl.onload = () => {
      const rect = currentImgEl.getBoundingClientRect();
      currentImgDocRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    };

    setTimeout(() => {
      if (currentIndex + 1 < images.length) {
        showPoster(currentIndex + 1);
      } else {
        finish();
      }
    }, POSTER_DURATION_MS);
  }

  function finish() {
    currentImgDocRect = null;
    if (onCompleteCb) onCompleteCb();
  }

  function start(imageList, onComplete) {
    images = imageList;
    onCompleteCb = onComplete;

    GazeTracker.onResult((gazeData) => {
      if (gazeData.state !== 0) return; // skip blinks / tracking loss / uncalibrated
      const mapped = mapGazeToImagePixels(gazeData.docX, gazeData.docY);
      if (!mapped) return; // gaze was off the poster (on the letterbox padding)

      const currentImageId = images[currentIndex].id;
      DataStore.addSample(currentImageId, mapped.x, mapped.y, gazeData.time);
    });

    showPoster(0);
  }

  return { start };
})();
