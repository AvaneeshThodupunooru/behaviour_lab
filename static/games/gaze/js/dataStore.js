const DataStore = (function () {
  const samples = []; // { imageId, x, y, timestamp }

  function addSample(imageId, x, y, timestamp) {
    samples.push({ imageId, x, y, timestamp });
  }

  function getSamplesForImage(imageId) {
    return samples.filter(s => s.imageId === imageId);
  }

  function getAllSamples() {
    return samples;
  }

  return { addSample, getSamplesForImage, getAllSamples };
})();