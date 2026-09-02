const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png'];

function loadOneImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject();
    img.src = url;
  });
}

async function findImageForNumber(n) {
  for (const ext of SUPPORTED_EXTENSIONS) {
    const url = `Images/${n}.${ext}?v=${Date.now()}`;
    try {
      const img = await loadOneImage(url);
      return { id: n, url, width: img.naturalWidth, height: img.naturalHeight };
    } catch (e) {
      // that extension doesn't exist for this number, try the next one
    }
  }
  return null; // no file found for this number at all
}

async function detectImages() {
  const images = [];
  let n = 1;
  while (true) {
    const found = await findImageForNumber(n);
    if (!found) break;
    images.push(found);
    n++;
  }
  return images;
}

// Loads a specific, explicit list of image numbers (e.g. the 4 numbers
// assigned to one age/gender category) instead of auto-scanning from 1.
// Numbers that don't resolve to a file (any supported extension) are
// skipped rather than stopping the scan, since gaps are expected once
// images are split across categories.
async function loadImagesByNumbers(numbers) {
  const images = [];
  for (const n of numbers) {
    const found = await findImageForNumber(n);
    if (found) images.push(found);
  }
  return images;
}