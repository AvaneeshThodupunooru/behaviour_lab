/**
 * report-charts.js — the report's charts.
 *
 * Everything here except the score ring is built from ordinary DOM elements
 * with percentage widths. That is deliberate: DOM survives the browser's PDF
 * writer as vector geometry and selectable text, while a canvas chart would be
 * rasterised. Only the ring needs real arcs, so only the ring is canvas.
 *
 * No chart derives a value. Each one is handed numbers that backend/report.py
 * already computed, and simply gives them a length.
 */
window.ReportCharts = (function () {
  'use strict';

  var D = window.ReportDom;

  /** Overall score as a ring. `max` is the scale, not a scaling factor. */
  function ring(score, max, caption) {
    var wrap = D.el('div', 'rp-ring');
    var canvas = D.el('canvas', 'rp-ring-canvas');
    var size = 240;
    var ctx = D.sizeCanvas(canvas, size, size);
    var mid = size / 2;
    var radius = mid - 18;
    var fraction = Math.max(0, Math.min(1, (score || 0) / max));

    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,244,228,0.16)';
    ctx.beginPath();
    ctx.arc(mid, mid, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (fraction > 0) {
      var sweep = ctx.createLinearGradient(0, 0, size, size);
      sweep.addColorStop(0, D.themeColor('--sky', '#4cc9f0'));
      sweep.addColorStop(0.5, D.themeColor('--mint', '#3fe0a0'));
      sweep.addColorStop(1, D.themeColor('--zap', '#ffd23f'));
      ctx.strokeStyle = sweep;
      ctx.beginPath();
      ctx.arc(mid, mid, radius, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
      ctx.stroke();
    }

    D.append(wrap, canvas);
    var face = D.el('div', 'rp-ring-face');
    D.append(face, D.el('div', 'rp-ring-value', D.num(score, 1)));
    D.append(face, D.el('div', 'rp-ring-max', 'out of ' + D.int(max)));
    if (caption) D.append(face, D.el('div', 'rp-ring-caption', caption));
    D.append(wrap, face);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Overall score ' + D.num(score, 1) + ' out of ' + D.int(max));
    return wrap;
  }

  /**
   * Four station scores as bars on a shared 0-25 scale, so their lengths are
   * directly comparable.
   */
  function stationBars(rows, maxScore) {
    var wrap = D.el('div', 'rp-bars');
    rows.forEach(function (row) {
      var item = D.el('div', 'rp-bar');
      item.style.setProperty('--rp-bar-accent', 'var(' + row.color + ')');

      var head = D.el('div', 'rp-bar-head');
      D.append(head, D.el('span', 'rp-bar-name', row.label));
      var score = D.el('span', 'rp-bar-score');
      if (D.isNum(row.score)) {
        D.append(score, D.el('b', null, D.num(row.score, 1)));
        D.append(score, D.el('span', 'rp-bar-of', '/' + D.int(maxScore)));
      } else {
        D.append(score, D.el('span', 'rp-bar-of', 'not recorded'));
      }
      D.append(head, score);
      D.append(item, head);

      var rail = D.el('div', 'rp-bar-rail');
      if (D.isNum(row.score)) {
        var fill = D.el('div', 'rp-bar-fill');
        fill.style.width = Math.max(0, Math.min(100, (row.score / maxScore) * 100)) + '%';
        D.append(rail, fill);
      } else {
        rail.className = 'rp-bar-rail rp-bar-rail--empty';
      }
      D.append(item, rail);
      if (row.blurb) D.append(item, D.el('p', 'rp-bar-blurb', row.blurb));
      D.append(wrap, item);
    });
    return wrap;
  }

  /**
   * The same four scores stacked into one 100-point bar, which is how they
   * combine: 25 + 25 + 25 + 25. Missing stations stay visible as the unfilled
   * remainder rather than being quietly dropped.
   */
  function distribution(rows, maxScore, total) {
    var wrap = D.el('div', 'rp-dist');
    var bar = D.el('div', 'rp-dist-bar');
    var scale = maxScore * rows.length;

    rows.forEach(function (row) {
      var earned = D.isNum(row.score) ? row.score : 0;
      if (earned > 0.05) {
        var seg = D.el('div', 'rp-dist-seg');
        seg.style.width = (earned / scale) * 100 + '%';
        seg.style.background = 'var(' + row.color + ')';
        seg.title = row.label + ': ' + D.num(row.score, 1) + ' of ' + D.int(maxScore);
        D.append(bar, seg);
      }
      var missed = Math.max(0, maxScore - earned);
      if (missed > 0.05) {
        var gap = D.el('div', 'rp-dist-seg rp-dist-seg--gap');
        gap.style.width = (missed / scale) * 100 + '%';
        D.append(bar, gap);
      }
    });

    D.append(wrap, bar);
    var foot = D.el('div', 'rp-dist-foot');
    D.append(foot, D.el('span', 'rp-dist-sum', D.num(total, 1) + ' of ' + D.int(scale) + ' points earned'));
    D.append(foot, D.el('span', 'rp-dist-hint', 'Each station contributes up to ' + D.int(maxScore) + '.'));
    D.append(wrap, foot);
    return wrap;
  }

  /** Small legend mapping station colours to names, shared by both charts. */
  function stationKey(rows) {
    var wrap = D.el('div', 'rp-station-key');
    rows.forEach(function (row) {
      var item = D.el('span', 'rp-key');
      var swatch = D.el('i', 'rp-key-swatch');
      swatch.style.background = 'var(' + row.color + ')';
      D.append(item, swatch);
      D.append(item, D.el('span', null, row.label));
      D.append(wrap, item);
    });
    return wrap;
  }

  /**
   * When each glance at the clock happened, laid out across the round.
   * @param {Array<{durationMs:number,timeRemainingAtVisit:number}>} visits
   * @param {number} roundSeconds full round length
   */
  function clockTimeline(visits, roundSeconds) {
    if (!visits || !visits.length || !D.isNum(roundSeconds) || roundSeconds <= 0) return null;
    var wrap = D.el('div', 'rp-timeline');
    var rail = D.el('div', 'rp-timeline-rail');

    visits.forEach(function (visit, i) {
      if (!D.isNum(visit.timeRemainingAtVisit)) return;
      var elapsed = roundSeconds - visit.timeRemainingAtVisit;
      var at = Math.max(0, Math.min(100, (elapsed / roundSeconds) * 100));
      var tick = D.el('div', 'rp-timeline-tick');
      tick.style.left = at + '%';
      if (D.isNum(visit.durationMs)) {
        // Longer looks read as taller ticks, capped so one long stare cannot
        // flatten the rest of the row.
        tick.style.height = (12 + Math.min(visit.durationMs, 1500) / 1500 * 22) + 'px';
        tick.title = 'Look ' + (i + 1) + ': ' + D.ms(visit.durationMs) + ' at ' + D.seconds(visit.timeRemainingAtVisit) + ' remaining';
      }
      D.append(rail, tick);
    });

    D.append(wrap, rail);
    var axis = D.el('div', 'rp-timeline-axis');
    D.append(axis, D.el('span', null, 'Round start'));
    D.append(axis, D.el('span', null, 'Deadline'));
    D.append(wrap, axis);
    D.append(wrap, D.el('p', 'rp-chart-note', 'Each mark is one look at the clock, placed where it happened in the round. Taller marks are longer looks.'));
    return wrap;
  }

  /** Clock checks split across the four quarters of the round. */
  function quarters(counts) {
    if (!counts || counts.length !== 4) return null;
    var peak = Math.max.apply(null, counts);
    var wrap = D.el('div', 'rp-quarters');
    counts.forEach(function (count, i) {
      var col = D.el('div', 'rp-quarter');
      var rail = D.el('div', 'rp-quarter-rail');
      var fill = D.el('div', 'rp-quarter-fill');
      fill.style.height = (peak > 0 ? (count / peak) * 100 : 0) + '%';
      D.append(rail, fill);
      D.append(col, D.el('span', 'rp-quarter-count', String(count)));
      D.append(col, rail);
      D.append(col, D.el('span', 'rp-quarter-label', 'Q' + (i + 1)));
      D.append(wrap, col);
    });
    return wrap;
  }

  /**
   * Expression events in the order they were logged, sized by their peak
   * intensity. The station records a peak per event but not an elapsed
   * timestamp, so this is a sequence, not a time axis.
   */
  function eventStrip(events) {
    if (!events || !events.length) return null;
    var wrap = D.el('div', 'rp-events');
    var row = D.el('div', 'rp-events-row');
    events.forEach(function (event, i) {
      var peak = D.isNum(event.peak) ? Math.max(0, Math.min(100, event.peak)) : null;
      var col = D.el('div', 'rp-event');
      var rail = D.el('div', 'rp-event-rail');
      var fill = D.el('div', 'rp-event-fill');
      fill.style.height = (peak === null ? 4 : Math.max(4, peak)) + '%';
      D.append(rail, fill);
      D.append(col, rail);
      D.append(col, D.el('span', 'rp-event-num', String(i + 1)));
      if (peak !== null) col.title = 'Event ' + (i + 1) + ': peak intensity ' + peak + '%';
      D.append(row, col);
    });
    D.append(wrap, row);
    D.append(wrap, D.el('p', 'rp-chart-note', 'Expression events in the order they were recorded. Bar height is that event’s peak intensity.'));
    return wrap;
  }

  return {
    ring: ring,
    stationBars: stationBars,
    distribution: distribution,
    stationKey: stationKey,
    clockTimeline: clockTimeline,
    quarters: quarters,
    eventStrip: eventStrip
  };
})();
