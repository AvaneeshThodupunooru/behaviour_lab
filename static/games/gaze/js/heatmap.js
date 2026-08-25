const Heatmap = (function () {
  function drawHeatmap(canvas, img, samples) {
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // 1. Draw the original poster as the base layer
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (samples.length === 0) return;

    // 2. Build an intensity layer on an offscreen canvas
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = canvas.width;
    heatCanvas.height = canvas.height;
    const heatCtx = heatCanvas.getContext('2d');

    const radius = Math.max(canvas.width, canvas.height) * 0.04; // scales with image size

    samples.forEach(({ x, y }) => {
      const gradient = heatCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.25)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      heatCtx.fillStyle = gradient;
      heatCtx.beginPath();
      heatCtx.arc(x, y, radius, 0, Math.PI * 2);
      heatCtx.fill();
    });

    // 3. Recolor the grayscale intensity into a heat gradient (blue -> yellow -> red)
    const imageData = heatCtx.getImageData(0, 0, heatCanvas.width, heatCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]; // built-up intensity from overlapping gradients
      if (alpha === 0) continue;
      const t = Math.min(alpha / 180, 1); // normalize 0..1
      const [r, g, b] = intensityToColor(t);
      data[i] = r; data[i + 1] = g; data[i + 2] = b;
      data[i + 3] = Math.min(alpha + 60, 200); // keep it semi-transparent over the poster
    }
    heatCtx.putImageData(imageData, 0, 0);

    // 4. Composite the heat layer on top of the poster
    ctx.drawImage(heatCanvas, 0, 0);
  }

  function intensityToColor(t) {
    // simple blue -> green -> yellow -> red ramp
    if (t < 0.33) return lerpColor([0, 0, 255], [0, 255, 0], t / 0.33);
    if (t < 0.66) return lerpColor([0, 255, 0], [255, 255, 0], (t - 0.33) / 0.33);
    return lerpColor([255, 255, 0], [255, 0, 0], (t - 0.66) / 0.34);
  }

  function lerpColor(a, b, f) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f)
    ];
  }

  return { drawHeatmap };
})();