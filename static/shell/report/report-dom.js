/**
 * report-dom.js — small, shared building blocks for the final report.
 *
 * Presentation only. Every value handed to these helpers has already been
 * measured and scored on the server (backend/report.py); nothing here derives
 * a metric, and anything null is dropped rather than filled in.
 */
window.ReportDom = (function () {
  'use strict';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var child = arguments[i];
      if (child) parent.appendChild(child);
    }
    return parent;
  }

  /** Reads a live design-system token so canvas art matches the CSS. */
  function themeColor(name, fallback) {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (value || '').trim() || fallback;
    } catch (err) {
      return fallback;
    }
  }

  /**
   * Sizes a canvas for a crisp result on retina screens and, more importantly,
   * for print: the browser's PDF writer rasterises canvas at its backing-store
   * resolution, so a 1x canvas would print visibly soft.
   */
  function sizeCanvas(canvas, cssWidth, cssHeight, scale) {
    var ratio = scale || Math.max(2, Math.min(4, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = '100%';
    canvas.style.aspectRatio = cssWidth + ' / ' + cssHeight;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  function isNum(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function num(value, digits) {
    if (!isNum(value)) return null;
    var fixed = value.toFixed(digits === undefined ? 1 : digits);
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  function int(value) {
    return isNum(value) ? String(Math.round(value)) : null;
  }

  /** Milliseconds at a human scale: 820 ms, 1.4 s, 23.0 s. */
  function ms(value) {
    if (!isNum(value)) return null;
    if (value < 1000) return Math.round(value) + ' ms';
    return (value / 1000).toFixed(value < 10000 ? 2 : 1) + ' s';
  }

  function seconds(value) {
    return isNum(value) ? num(value, 1) + ' s' : null;
  }

  /** 0..1 fraction as a percentage. */
  function fraction(value) {
    return isNum(value) ? Math.round(value * 100) + '%' : null;
  }

  /** Already-a-percentage value. */
  function percent(value, digits) {
    return isNum(value) ? num(value, digits === undefined ? 1 : digits) + '%' : null;
  }

  function signedFraction(value) {
    if (!isNum(value)) return null;
    var points = Math.round(value * 100);
    return (points > 0 ? '+' : '') + points + '%';
  }

  function titleCase(value) {
    if (!value) return null;
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  /** Eyebrow pill in the site's own style, tinted with a palette token. */
  function eyebrow(text, colorToken) {
    var node = el('span', 'tt-eyebrow rp-eyebrow', text);
    if (colorToken) node.style.background = 'var(' + colorToken + ')';
    return node;
  }

  /** The big single-number block used for each station's signature figure. */
  function figure(value, label, sublabel, colorToken) {
    var wrap = el('div', 'rp-figure');
    if (colorToken) wrap.style.setProperty('--rp-figure-accent', 'var(' + colorToken + ')');
    append(wrap, el('div', 'rp-figure-label', label));
    append(wrap, el('div', 'rp-figure-value', value));
    if (sublabel) append(wrap, el('div', 'rp-figure-sub', sublabel));
    return wrap;
  }

  /**
   * Definition grid. Pairs whose value is null are dropped, so a station that
   * did not record something simply shows fewer cells instead of a blank one.
   */
  function metrics(pairs) {
    var grid = el('dl', 'rp-metrics');
    var used = 0;
    pairs.forEach(function (pair) {
      if (pair[1] === null || pair[1] === undefined || pair[1] === '') return;
      var cell = el('div', 'rp-metric');
      append(cell, el('dt', null, pair[0]));
      append(cell, el('dd', null, pair[1]));
      if (pair[2]) append(cell, el('p', 'rp-metric-hint', pair[2]));
      append(grid, cell);
      used++;
    });
    return used ? grid : null;
  }

  function note(text, className) {
    return text ? el('p', 'rp-note' + (className ? ' ' + className : ''), text) : null;
  }

  /** "Also used in research" panel that closes every station page. */
  function researchPanel(body, caveat) {
    if (!body) return null;
    var panel = el('aside', 'rp-research-note');
    append(panel, el('h4', null, 'Where this signal is studied'));
    append(panel, el('p', null, body));
    if (caveat) append(panel, el('p', 'rp-research-caveat', caveat));
    return panel;
  }

  return {
    el: el,
    append: append,
    themeColor: themeColor,
    sizeCanvas: sizeCanvas,
    isNum: isNum,
    num: num,
    int: int,
    ms: ms,
    seconds: seconds,
    fraction: fraction,
    percent: percent,
    signedFraction: signedFraction,
    titleCase: titleCase,
    eyebrow: eyebrow,
    figure: figure,
    metrics: metrics,
    note: note,
    researchPanel: researchPanel
  };
})();
