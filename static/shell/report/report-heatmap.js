/**
 * report-heatmap.js — the participant's real gaze heatmap.
 *
 * Draws from the coordinates the gaze station actually recorded
 * (result.images[].samples, in each poster's own pixel space). There is no
 * synthetic or decorative fallback: when no samples were captured the card
 * says so and shows the plain poster, because a made-up heatmap would be a
 * fabricated measurement.
 *
 * The intensity ramp reuses the site's own accents (sky -> mint -> zap ->
 * punch) so the visualisation belongs to the same design system, and the heat
 * layer stays translucent so the poster underneath is still recognisable.
 */
window.ReportHeatmap = (function () {
  'use strict';

  var D = window.ReportDom;
  var IMAGE_BASE = '/games/gaze-timer/';
  var MAX_EDGE = 1100;          // caps canvas memory, keeps print quality high
  var SPOT_RADIUS_RATIO = 0.04; // matches the station's own live heatmap
  var INTENSITY_CEILING = 180;  // floor on the normaliser: below this a sparse map stays cool
  var MAX_HEAT_ALPHA = 190;     // leaves the poster readable underneath

  function hexToRgb(hex, fallback) {
    var match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!match) return fallback;
    var value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function palette() {
    return [
      hexToRgb(D.themeColor('--sky', '#4cc9f0'), [76, 201, 240]),
      hexToRgb(D.themeColor('--mint', '#3fe0a0'), [63, 224, 160]),
      hexToRgb(D.themeColor('--zap', '#ffd23f'), [255, 210, 63]),
      hexToRgb(D.themeColor('--punch', '#ff4d8d'), [255, 77, 141])
    ];
  }

  function lerp(a, b, f) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f)
    ];
  }

  /** Cool (rarely looked at) through warm (looked at most). */
  function intensityToColor(t, stops) {
    var span = 1 / (stops.length - 1);
    var index = Math.min(Math.floor(t / span), stops.length - 2);
    return lerp(stops[index], stops[index + 1], (t - index * span) / span);
  }

  function cssGradient() {
    var stops = palette();
    return 'linear-gradient(90deg, ' + stops.map(function (rgb) {
      return 'rgb(' + rgb.join(',') + ')';
    }).join(', ') + ')';
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLImageElement} img loaded poster
   * @param {Array<{x:number,y:number}>} samples poster-pixel gaze points
   */
  function draw(canvas, img, samples) {
    var natural = { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
    if (!natural.w || !natural.h) return false;

    var scale = Math.min(1, MAX_EDGE / Math.max(natural.w, natural.h));
    var width = Math.max(1, Math.round(natural.w * scale));
    var height = Math.max(1, Math.round(natural.h * scale));

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.aspectRatio = natural.w + ' / ' + natural.h;

    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    if (!samples || !samples.length) return false;

    var heat = document.createElement('canvas');
    heat.width = width;
    heat.height = height;
    var heatCtx = heat.getContext('2d');
    var radius = Math.max(width, height) * SPOT_RADIUS_RATIO;

    samples.forEach(function (sample) {
      var x = sample.x * scale;
      var y = sample.y * scale;
      var gradient = heatCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.25)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      heatCtx.fillStyle = gradient;
      heatCtx.beginPath();
      heatCtx.arc(x, y, radius, 0, Math.PI * 2);
      heatCtx.fill();
    });

    var stops = palette();
    var imageData = heatCtx.getImageData(0, 0, width, height);
    var data = imageData.data;

    // Normalise against the busiest pixel this participant actually produced,
    // with INTENSITY_CEILING as a floor on the divisor. A dense recording then
    // spreads the whole cool-to-warm ramp across its real range instead of
    // saturating, while a sparse one stays honestly cool rather than being
    // stretched into a hotspot it never earned.
    var peak = 0;
    for (var p = 3; p < data.length; p += 4) {
      if (data[p] > peak) peak = data[p];
    }
    var divisor = Math.max(peak, INTENSITY_CEILING);

    for (var i = 0; i < data.length; i += 4) {
      var alpha = data[i + 3];
      if (alpha === 0) continue;
      var color = intensityToColor(Math.min(alpha / divisor, 1), stops);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = Math.min(alpha + 55, MAX_HEAT_ALPHA);
    }
    heatCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(heat, 0, 0);
    return true;
  }

  function legend() {
    var wrap = D.el('div', 'rp-heat-legend');
    D.append(wrap, D.el('span', 'rp-heat-legend-end', 'Lower attention ←'));
    var bar = D.el('span', 'rp-heat-legend-bar');
    bar.style.background = cssGradient();
    D.append(wrap, bar);
    D.append(wrap, D.el('span', 'rp-heat-legend-end', '→ Higher attention'));
    return wrap;
  }

  /**
   * Poster loads are asynchronous, so the PDF path needs to know when every
   * canvas has actually been painted. Each card registers its load here and
   * ready() resolves once none are outstanding.
   */
  var pending = [];

  function ready() {
    return Promise.all(pending.slice());
  }

  /**
   * Builds one poster card and starts loading its image. Returns synchronously
   * so section layout is not blocked; the canvas fills in on load.
   */
  function card(image, index) {
    var wrap = D.el('figure', 'rp-heat-card');
    D.append(wrap, D.el('figcaption', 'rp-heat-title', 'Poster ' + (index + 1)));

    var frame = D.el('div', 'rp-heat-frame');
    var canvas = D.el('canvas', 'rp-heat-canvas');
    canvas.setAttribute('role', 'img');
    D.append(frame, canvas);
    D.append(wrap, frame);

    var samples = image.samples || [];
    var caption = D.el('p', 'rp-heat-caption');
    D.append(wrap, caption);

    if (samples.length) {
      canvas.setAttribute('aria-label', 'Gaze heatmap over poster ' + (index + 1) +
        ', built from ' + samples.length + ' recorded gaze points.');
      caption.textContent = samples.length.toLocaleString() + ' gaze points recorded on this poster';
      D.append(wrap, legend());
    } else {
      canvas.setAttribute('aria-label', 'Poster ' + (index + 1) + ', shown without a heatmap because no gaze points were recorded.');
      caption.textContent = 'No gaze points were recorded for this poster, so it is shown without a heatmap.';
      caption.className = 'rp-heat-caption rp-heat-caption--empty';
    }

    var img = new Image();
    img.decoding = 'sync';
    pending.push(new Promise(function (resolve) {
      img.onload = function () {
        draw(canvas, img, samples);
        resolve(true);
      };
      img.onerror = function () {
        if (canvas.parentNode === frame) frame.removeChild(canvas);
        D.append(frame, D.el('p', 'rp-heat-missing', 'Poster image unavailable'));
        resolve(false);
      };
    }));
    img.src = /^(https?:|\/)/.test(image.url || '') ? image.url : IMAGE_BASE + image.url;
    return wrap;
  }

  return { card: card, draw: draw, legend: legend, cssGradient: cssGradient, ready: ready };
})();
