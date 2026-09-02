/* Behavior Lab — report canvas rendering.
 *
 * Two pictures the numbers cannot make on their own:
 *
 *   gazeHeatmap    where a participant dwelled on a poster, and in what order
 *   routeDeviation how far off the centre line they walked, WobbleWalk's own view
 *
 * Split out of shell.js so the print/PDF renderer in tools/render_report_pdf.js
 * can inline the exact same drawing code. Nothing here reads a score or writes
 * copy; it takes the raw samples a station recorded and draws them.
 */
(function () {
  'use strict';

  // Dwell heatmap, thermal-camera palette. Same two-pass construction the gaze
  // station uses (gaze-experiment/js/heatmap.js): accumulate soft radial alpha
  // per sample to get a density field, then recolour that field. The heat layer
  // is built on its own offscreen canvas which never receives the poster, so
  // getImageData on it is safe regardless of where the image came from.
  //
  // Cold is transparent rather than blue, and alpha climbs with heat, so the
  // poster stays readable everywhere except the places they actually stared.
  var THERMAL = [
    [0.00, 10, 16, 70, 0],
    [0.14, 26, 58, 200, 78],
    [0.32, 0, 186, 205, 128],
    [0.52, 40, 210, 90, 160],
    [0.70, 255, 220, 60, 190],
    [0.86, 255, 130, 24, 212],
    [1.00, 240, 40, 30, 230]
  ];

  function heatColor(t) {
    var v = t < 0 ? 0 : (t > 1 ? 1 : t);
    var i = 1;
    while (i < THERMAL.length - 1 && v > THERMAL[i][0]) i += 1;
    var a = THERMAL[i - 1];
    var b = THERMAL[i];
    var f = (v - a[0]) / (b[0] - a[0]);
    if (f < 0) f = 0;
    else if (f > 1) f = 1;
    return [
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
      Math.round(a[3] + (b[3] - a[3]) * f),
      Math.round(a[4] + (b[4] - a[4]) * f)
    ];
  }

  // 'lighter' makes the per-sample alphas add, so overlapping looks build a real
  // density field instead of saturating on the first blob. The field is then
  // auto-ranged against its own hottest point, the way a thermal camera ranges
  // a frame — the legend promises a relative scale, not an absolute one. The
  // floor on the denominator only bites when the whole field is one faint blob,
  // which should not come out looking like a hotspot.
  function buildHeatLayer(width, height, samples) {
    var heat = document.createElement('canvas');
    heat.width = width;
    heat.height = height;
    var hx = heat.getContext('2d');
    var radius = Math.max(width, height) * 0.07;

    hx.globalCompositeOperation = 'lighter';
    samples.forEach(function (pt) {
      var gradient = hx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0.22)');
      gradient.addColorStop(0.4, 'rgba(0,0,0,0.11)');
      gradient.addColorStop(0.72, 'rgba(0,0,0,0.035)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      hx.fillStyle = gradient;
      hx.beginPath();
      hx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      hx.fill();
    });
    hx.globalCompositeOperation = 'source-over';

    try {
      var img = hx.getImageData(0, 0, width, height);
      var data = img.data;
      var peak = 0;
      var i;
      for (i = 3; i < data.length; i += 4) {
        if (data[i] > peak) peak = data[i];
      }
      if (!peak) return heat;

      var denom = Math.max(peak, 48);
      for (i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        var rgba = heatColor(data[i + 3] / denom);
        data[i] = rgba[0];
        data[i + 1] = rgba[1];
        data[i + 2] = rgba[2];
        data[i + 3] = rgba[3];
      }
      hx.putImageData(img, 0, 0);
    } catch (err) {
      return heat; // Uncoloured heat still reads as dwell density.
    }
    return heat;
  }

  // Heat answers "where did they dwell". The scan path on top answers "in what
  // order", which is a separate finding and worth keeping visible.
  function drawScanPath(ctx, samples, width) {
    if (samples.length < 2) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    samples.forEach(function (pt, idx) {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = Math.max(3.5, width * 0.008);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(24, 33, 38, 0.6)';
    ctx.lineWidth = Math.max(1.4, width * 0.003);
    ctx.stroke();

    var dot = Math.max(3, width * 0.0075);
    samples.forEach(function (pt, idx) {
      var first = idx === 0;
      var last = idx === samples.length - 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, first || last ? dot * 1.7 : dot, 0, Math.PI * 2);
      ctx.fillStyle = first ? '#182126' : (last ? '#d9f46a' : 'rgba(255,255,255,0.75)');
      ctx.fill();
      ctx.strokeStyle = 'rgba(24, 33, 38, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  }

  // The posters are ~2700px wide and the samples are recorded in that original
  // pixel space. Drawing at full natural size means a 4-megapixel canvas per
  // image for no visible gain, so cap the width and scale the samples with it.
  var MAX_CANVAS_WIDTH = 1100;

  function renderGazeHeatmap(canvas, imgUrl, samples) {
    var ctx = canvas.getContext('2d');
    var raw = (samples || []).filter(function (pt) {
      return pt && isFinite(pt.x) && isFinite(pt.y);
    });

    function paint(width, height, natural) {
      var scale = natural > 0 ? width / natural : 1;
      var points = raw.map(function (pt) {
        return { x: pt.x * scale, y: pt.y * scale };
      });
      if (!points.length) return;
      // Thermal colours need a cool base to read against; without this the
      // poster's own bright areas compete with the low end of the ramp.
      ctx.fillStyle = 'rgba(8, 12, 32, 0.3)';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(buildHeatLayer(width, height, points), 0, 0);
      drawScanPath(ctx, points, width);
    }

    var img = new Image();
    img.onload = function () {
      var natural = img.naturalWidth || 600;
      var naturalH = img.naturalHeight || 400;
      var width = Math.min(natural, MAX_CANVAS_WIDTH);
      canvas.width = Math.round(width);
      canvas.height = Math.round(naturalH * (width / natural));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      paint(canvas.width, canvas.height, natural);
    };
    img.onerror = function () {
      canvas.width = 600;
      canvas.height = 400;
      ctx.fillStyle = '#f1f1ee';
      ctx.fillRect(0, 0, 600, 400);
      paint(600, 400, 600);
      ctx.fillStyle = '#182126'; // Ink, not muted — paint() cools the base first.
      ctx.font = '600 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Poster image unavailable — gaze density only', 300, 380);
    };
    img.src = imgUrl;
  }

  // Deviation-from-centre view, drawn the way WobbleWalk draws its own route
  // panel: paper and grid, a dashed ideal line down the middle, the walked path
  // against it. `route` arrives in a 0-100 space where x=50 is the centre line
  // and y runs from 92 (start) to 8 (finish). The shaded area between path and
  // centre is the lateral deviation the wobble score is built from.
  function renderRouteCanvas(canvas, route) {
    var W = 620;
    var H = 420;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var px = function (v) { return (v / 100) * W; };
    var py = function (v) { return (v / 100) * H; };

    ctx.fillStyle = '#f6f7f2';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(24, 33, 38, 0.05)';
    ctx.lineWidth = 1;
    for (var gx = 24; gx < W; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (var gy = 24; gy < H; gy += 24) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    var pts = (route || [])
      .filter(function (pt) { return pt && isFinite(pt.x) && isFinite(pt.y); })
      .map(function (pt) { return { x: px(pt.x), y: py(pt.y) }; });

    // Deviation band: the gap between where they walked and the line they were
    // asked to walk, which is the whole measurement in one shape.
    if (pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(px(50), pts[0].y);
      pts.forEach(function (pt) { ctx.lineTo(pt.x, pt.y); });
      ctx.lineTo(px(50), pts[pts.length - 1].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 130, 104, 0.18)';
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(24, 33, 38, 0.55)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(px(50), py(92));
    ctx.lineTo(px(50), py(8));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#617078';
    ctx.font = '800 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('START', px(52), py(94));
    ctx.fillText('FINISH', px(52), py(11));

    if (!pts.length) {
      ctx.fillStyle = '#667079';
      ctx.font = '600 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No trajectory was recorded for this walk.', W / 2, H / 2);
      return;
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(function (pt, idx) {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#ff8268';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    var last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 4.6, 0, Math.PI * 2);
    ctx.fillStyle = '#182126';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 5.8, 0, Math.PI * 2);
    ctx.fillStyle = '#d9f46a';
    ctx.fill();
    ctx.strokeStyle = '#182126';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  window.ReportVisuals = {
    gazeHeatmap: renderGazeHeatmap,
    routeDeviation: renderRouteCanvas
  };
})();
