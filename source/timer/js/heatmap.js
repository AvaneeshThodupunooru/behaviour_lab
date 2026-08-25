/**
 * Technique: accumulate radial gradients on an offscreen canvas using
 * 'lighter' composite (so overlapping gaze points build up brightness),
 * then remap each pixel's accumulated alpha through a blue->red color
 * ramp — the standard "simple-heat" approach, done without a library.
 */
(function (root) {
  'use strict';

  var RAMP = [
    { stop: 0.0, color: [0, 0, 0, 0] },
    { stop: 0.2, color: [37, 99, 235, 90] }, // blue
    { stop: 0.45, color: [45, 212, 191, 140] }, // teal
    { stop: 0.7, color: [250, 204, 21, 190] }, // yellow
    { stop: 1.0, color: [239, 68, 68, 230] } // red
  ];

  function rampColor(t) {
    t = Math.max(0, Math.min(1, t));
    for (var i = 1; i < RAMP.length; i++) {
      if (t <= RAMP[i].stop) {
        var a = RAMP[i - 1];
        var b = RAMP[i];
        var span = b.stop - a.stop || 1;
        var localT = (t - a.stop) / span;
        return [
          a.color[0] + (b.color[0] - a.color[0]) * localT,
          a.color[1] + (b.color[1] - a.color[1]) * localT,
          a.color[2] + (b.color[2] - a.color[2]) * localT,
          a.color[3] + (b.color[3] - a.color[3]) * localT
        ];
      }
    }
    return RAMP[RAMP.length - 1].color;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx destination context to draw into
   * @param {number} width
   * @param {number} height
   * @param {{x:number,y:number}[]} gazeSamples normalized 0-1 coordinates
   * @param {number} [radiusPx]
   */
  function renderHeatmap(ctx, width, height, gazeSamples, radiusPx) {
    radiusPx = radiusPx || Math.max(18, Math.round(Math.min(width, height) * 0.03));

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, width, height);

    if (!gazeSamples.length) return;

    // Accumulate density on an offscreen canvas.
    var density = document.createElement('canvas');
    density.width = width;
    density.height = height;
    var dctx = density.getContext('2d');
    dctx.globalCompositeOperation = 'lighter';

    gazeSamples.forEach(function (s) {
      var px = s.x * width;
      var py = s.y * height;
      var gradient = dctx.createRadialGradient(px, py, 0, px, py, radiusPx);
      gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = gradient;
      dctx.beginPath();
      dctx.arc(px, py, radiusPx, 0, Math.PI * 2);
      dctx.fill();
    });

    var imageData = dctx.getImageData(0, 0, width, height);
    var pixels = imageData.data;
    var maxAlpha = 0;
    for (var i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > maxAlpha) maxAlpha = pixels[i];
    }
    if (maxAlpha === 0) return;

    for (var p = 0; p < pixels.length; p += 4) {
      var a = pixels[p + 3];
      if (a === 0) {
        continue;
      }
      var t = a / maxAlpha;
      var color = rampColor(t);
      pixels[p] = color[0];
      pixels[p + 1] = color[1];
      pixels[p + 2] = color[2];
      pixels[p + 3] = color[3];
    }
    dctx.putImageData(imageData, 0, 0);

    ctx.globalAlpha = 0.85;
    ctx.drawImage(density, 0, 0);
    ctx.globalAlpha = 1;
  }

  root.PressureClockHeatmap = { renderHeatmap: renderHeatmap };
})(typeof window !== 'undefined' ? window : globalThis);
