/**
 * report.js — assembles the pages, gates the report, and drives the PDF.
 *
 * PDF approach, and why: this project has no build step and no PDF library
 * (the stations are plain static files that must work offline), so the report
 * is printed by the browser's own PDF writer against a dedicated print
 * stylesheet. That keeps text as selectable vector text, keeps real page
 * breaks, and — importantly — uses the exact same components as the on-screen
 * report rather than a screenshot of it.
 */
window.Report = (function () {
  'use strict';

  var D = window.ReportDom;
  var S = window.ReportSections;

  var PAGE_BUILDERS = ['summaryPage', 'distributionPage', 'timerPage', 'gazePage', 'deadpanPage', 'wobblePage', 'finalPage'];

  function build(report) {
    var doc = D.el('article', 'rp-doc');
    doc.setAttribute('aria-label', 'Session report ' + (report.session_id || ''));
    PAGE_BUILDERS.forEach(function (name) {
      D.append(doc, S[name](report));
    });
    return doc;
  }

  /** §15: nothing to show until all four stations have a score. */
  function gate(report) {
    var node = D.el('section', 'rp-gate');
    D.append(node, D.eyebrow('Report locked', '--tang'));
    D.append(node, D.el('h2', 'rp-h2', 'The report opens once all four stations are done'));
    D.append(node, D.el('p', 'rp-lede', 'Completed so far: ' + (report.stations_completed || 0) +
      ' of ' + (report.stations_total || 4) + '. Finish the remaining stations and this page fills itself in.'));
    var missing = (report.score_breakdown || []).filter(function (row) { return !row.available; });
    if (missing.length) {
      var list = D.el('ul', 'rp-list');
      missing.forEach(function (row) {
        D.append(list, D.el('li', null, row.label + (row.played
          ? ' — played, but no score could be calculated from what was recorded.'
          : ' — not played yet.')));
      });
      D.append(node, list);
    }
    return node;
  }

  function error(message) {
    var node = D.el('section', 'rp-gate');
    D.append(node, D.eyebrow('Report unavailable', '--punch'));
    D.append(node, D.el('h2', 'rp-h2', 'Could not load this report'));
    D.append(node, D.el('p', 'rp-lede', message || 'Unknown error.'));
    return node;
  }

  /**
   * @returns {boolean} whether the full report was rendered (false = gated)
   */
  function render(host, report) {
    host.innerHTML = '';
    if (!report || !report.report_ready) {
      D.append(host, gate(report || {}));
      return false;
    }
    D.append(host, build(report));
    return true;
  }

  function renderError(host, message) {
    host.innerHTML = '';
    D.append(host, error(message));
  }

  return { render: render, renderError: renderError, build: build };
})();

/** Fetches the scored report for a session. */
window.ReportGenerator = (function () {
  'use strict';

  function load(sessionId, apiBase) {
    var base = apiBase || '';
    return fetch(base + '/api/sessions/' + encodeURIComponent(sessionId) + '/report')
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.detail || 'Could not load the report.');
          return data;
        });
      });
  }

  return { load: load };
})();

window.ReportPDF = (function () {
  'use strict';

  var PRINT_ROOT_ID = 'rp-print-root';
  var RESTORE_TIMEOUT_MS = 120000;

  function printRoot() {
    var root = document.getElementById(PRINT_ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = PRINT_ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function fontsReady() {
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      return document.fonts.ready.catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  function assetsReady() {
    var waits = [fontsReady()];
    if (window.ReportHeatmap && window.ReportHeatmap.ready) {
      waits.push(window.ReportHeatmap.ready().catch(function () { return null; }));
    }
    return Promise.all(waits);
  }

  /**
   * Prints the report document itself rather than the page around it: the node
   * is moved to a top-level print root for the duration of the dialog so the
   * print stylesheet only has to hide one thing, then put back exactly where
   * it was. Moving the node preserves the already-painted canvases.
   */
  function printDocument(doc, report) {
    var home = doc.parentNode;
    var anchor = doc.nextSibling;
    var previousTitle = document.title;
    var restored = false;
    var mediaQuery = window.matchMedia ? window.matchMedia('print') : null;

    function onMediaChange(event) {
      if (!event.matches) restore();
    }

    function restore() {
      if (restored) return;
      restored = true;
      document.body.classList.remove('rp-printing');
      document.title = previousTitle;
      if (home) home.insertBefore(doc, anchor);
      window.removeEventListener('afterprint', restore);
      window.removeEventListener('focus', restore);
      if (mediaQuery && mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', onMediaChange);
      else if (mediaQuery && mediaQuery.removeListener) mediaQuery.removeListener(onMediaChange);
    }

    // The document title becomes the PDF's suggested filename.
    if (report && report.session_id) document.title = 'report-' + report.session_id;
    document.body.classList.add('rp-printing');
    printRoot().appendChild(doc);

    // Three ways back, because no single one of these is universal: afterprint
    // (Chromium, Firefox, Safari 13+), leaving print media, and the page
    // regaining focus once the dialog closes. Whichever lands first wins, and
    // the timeout guarantees the page never stays stuck in print layout.
    window.addEventListener('afterprint', restore);
    window.addEventListener('focus', restore);
    if (mediaQuery && mediaQuery.addEventListener) mediaQuery.addEventListener('change', onMediaChange);
    else if (mediaQuery && mediaQuery.addListener) mediaQuery.addListener(onMediaChange);
    setTimeout(restore, RESTORE_TIMEOUT_MS);
    window.print();
  }

  /**
   * @param {HTMLElement} host element containing a rendered .rp-doc
   * @param {object} report used only for the suggested filename
   * @returns {Promise<boolean>}
   */
  function download(host, report) {
    var doc = (host || document).querySelector('.rp-doc');
    if (!doc) return Promise.resolve(false);
    return assetsReady().then(function () {
      printDocument(doc, report);
      return true;
    });
  }

  return { download: download };
})();
