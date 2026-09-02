/**
 * report-walkpath.js — WobbleWalk path visualisation.
 *
 * Draws the station's own replay route (result.route) rather than recomputing
 * anything: the analyser already projected the tracked hip centres onto a
 * 0-100 box where x = 50 is the ideal straight line and index 0 is the first
 * tracked frame of the walk. See backend/wobblewalk_backend/game_metrics.py.
 *
 * Shown: the ideal centre line, the participant's actual path, the shaded
 * deviation between the two, start and end points, direction of travel, and
 * the single widest deviation from centre.
 */
window.ReportWalkPath = (function () {
  'use strict';

  var D = window.ReportDom;
  var VIEW = { w: 400, h: 540 };
  var PAD = { top: 34, right: 30, bottom: 34, left: 30 };

  function project(point) {
    return {
      x: PAD.left + (point.x / 100) * (VIEW.w - PAD.left - PAD.right),
      y: PAD.top + (point.y / 100) * (VIEW.h - PAD.top - PAD.bottom)
    };
  }

  function centreX() {
    return PAD.left + 0.5 * (VIEW.w - PAD.left - PAD.right);
  }

  function drawBackdrop(ctx, colors) {
    ctx.fillStyle = colors.void950;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.fillStyle = 'rgba(255,244,228,0.10)';
    for (var y = 12; y < VIEW.h; y += 22) {
      for (var x = 12; x < VIEW.w; x += 22) {
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCentreLine(ctx, colors) {
    var x = centreX();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,244,228,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.moveTo(x, PAD.top - 14);
    ctx.lineTo(x, VIEW.h - PAD.bottom + 14);
    ctx.stroke();
    ctx.restore();
  }

  function drawDeviationRibbon(ctx, points, colors) {
    var x = centreX();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, points[0].y);
    points.forEach(function (point) { ctx.lineTo(point.x, point.y); });
    ctx.lineTo(x, points[points.length - 1].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(183,156,255,0.26)';
    ctx.fill();
    ctx.restore();
  }

  function drawPath(ctx, points, colors) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(63,224,160,0.28)';
    ctx.lineWidth = 11;
    ctx.beginPath();
    points.forEach(function (point, i) {
      if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.strokeStyle = colors.mint;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  function arrowAt(ctx, from, to, colors) {
    var angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.save();
    ctx.translate(to.x, to.y);
    ctx.rotate(angle);
    ctx.fillStyle = colors.cream;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-6, 5);
    ctx.lineTo(-6, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Direction of travel, marked along the path at even intervals. */
  function drawDirection(ctx, points, colors) {
    if (points.length < 4) return;
    var lengths = [0];
    for (var i = 1; i < points.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    var total = lengths[lengths.length - 1];
    if (total < 24) return;
    [0.3, 0.62, 0.9].forEach(function (fraction) {
      var target = total * fraction;
      for (var j = 1; j < lengths.length; j++) {
        if (lengths[j] >= target) {
          arrowAt(ctx, points[j - 1], points[j], colors);
          return;
        }
      }
    });
  }

  function drawEndpoint(ctx, point, fill, label, colors) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.void950;
    ctx.stroke();
    ctx.font = '700 11px "IBM Plex Mono", monospace';
    ctx.fillStyle = colors.cream;
    ctx.textAlign = point.x > centreX() ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, point.x + (point.x > centreX() ? -15 : 15), point.y);
    ctx.restore();
  }

  /** Marks the frame that sat furthest from the ideal line. */
  function drawWidestDeviation(ctx, route, points, colors) {
    var worst = 0;
    for (var i = 1; i < route.length; i++) {
      if (Math.abs(route[i].x - 50) > Math.abs(route[worst].x - 50)) worst = i;
    }
    if (Math.abs(route[worst].x - 50) < 2) return;
    var point = points[worst];
    var x = centreX();
    ctx.save();
    ctx.strokeStyle = colors.zap;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, point.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.zap;
    ctx.fill();
    ctx.font = '700 10px "IBM Plex Mono", monospace';
    ctx.textAlign = point.x > x ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('WIDEST', point.x + (point.x > x ? 8 : -8), point.y - 6);
    ctx.restore();
  }

  function render(canvas, route) {
    var points = (route || []).map(project);
    if (points.length < 2) return false;
    var colors = {
      void950: D.themeColor('--void-950', '#120b26'),
      cream: D.themeColor('--cream', '#fff4e4'),
      mint: D.themeColor('--mint', '#3fe0a0'),
      sky: D.themeColor('--sky', '#4cc9f0'),
      punch: D.themeColor('--punch', '#ff4d8d'),
      zap: D.themeColor('--zap', '#ffd23f')
    };
    var ctx = D.sizeCanvas(canvas, VIEW.w, VIEW.h);
    drawBackdrop(ctx, colors);
    drawDeviationRibbon(ctx, points, colors);
    drawCentreLine(ctx, colors);
    drawPath(ctx, points, colors);
    drawWidestDeviation(ctx, route, points, colors);
    drawDirection(ctx, points, colors);
    drawEndpoint(ctx, points[0], colors.sky, 'START', colors);
    drawEndpoint(ctx, points[points.length - 1], colors.punch, 'END', colors);
    return true;
  }

  function legend() {
    var wrap = D.el('div', 'rp-walk-legend');
    [
      ['rp-key--ideal', 'Ideal centre line'],
      ['rp-key--path', 'Your path'],
      ['rp-key--start', 'Start'],
      ['rp-key--end', 'End'],
      ['rp-key--drift', 'Deviation from centre']
    ].forEach(function (entry) {
      var item = D.el('span', 'rp-key');
      D.append(item, D.el('i', 'rp-key-swatch ' + entry[0]));
      D.append(item, D.el('span', null, entry[1]));
      D.append(wrap, item);
    });
    return wrap;
  }

  return { render: render, legend: legend };
})();
