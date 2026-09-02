/* Render a session's final report to a print-ready PDF.
 *
 *   node tools/render_report_pdf.js EVT-2026-00001 EVT-2026-00003
 *
 * With no arguments it renders one clean run and one disastrous run, which is
 * the pair worth showing anyone reviewing the copy. Writes an .html and a .pdf
 * per session into samples/. The default IDs are seeded demo sessions; pass
 * your own if the store has been reset since.
 *
 * Neither the text nor the pictures are re-implemented here. This loads
 * static/shell/report-roast.js in a sandbox and inlines
 * static/shell/report-visuals.js into the page, so the PDF says exactly what
 * the browser says and draws exactly what the browser draws. Only the layout
 * differs — paper instead of a scrolling card. Headless Chrome or Edge does the
 * conversion, so there are no new dependencies to install.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const BASE = 'http://127.0.0.1:8000';
const ROOT = path.join(__dirname, '..');
const ROAST_PATH = path.join(ROOT, 'static', 'shell', 'report-roast.js');
const VISUALS_PATH = path.join(ROOT, 'static', 'shell', 'report-visuals.js');
const POSTER_DIR = path.join(ROOT, 'static', 'games', 'gaze-timer', 'Images');
const OUT_DIR = path.join(ROOT, 'samples');

const GAME_ORDER = ['gaze', 'timer', 'deadpan', 'wobblewalk'];
const DEFAULT_IDS = ['EVT-2026-00012', 'EVT-2026-00014'];

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

function findBrowser() {
  for (const exe of BROWSERS) if (fs.existsSync(exe)) return exe;
  throw new Error('No Chrome or Edge found — cannot convert HTML to PDF.');
}

function loadRoast() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ROAST_PATH, 'utf8'), sandbox, { filename: ROAST_PATH });
  return sandbox.window.ReportRoast;
}

// The dev server is a single uvicorn worker and occasionally drops a connection
// right after a Chrome run exits, so a failed fetch gets two more attempts
// before it counts as a real outage.
async function getJson(urlPath, attempt = 1) {
  try {
    const res = await fetch(BASE + urlPath);
    if (!res.ok) throw new Error(`${urlPath} -> HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3 || /HTTP \d/.test(err.message)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    return getJson(urlPath, attempt + 1);
  }
}

function esc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Same palette as static/shell/shell.css, re-cut for A4: the shell's colours and
// type hierarchy, without the parts that only make sense on screen.
const STYLES = `
  @page { size: A4; margin: 14mm 15mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", -apple-system, Inter, Arial, sans-serif;
    color: #182126;
    background: #fff;
    font-size: 11pt;
    line-height: 1.45;
  }
  .sheet-head {
    display: flex; align-items: baseline; justify-content: space-between;
    border-bottom: 1px solid #dfe3dc; padding-bottom: 8px; margin-bottom: 16px;
  }
  .brand { font-size: 9.5pt; font-weight: 800; letter-spacing: .1em; }
  .sheet-meta { font-size: 9pt; color: #667079; }
  .hero { padding: 18px 20px; border-radius: 8px; background: #182126; color: #fff; }
  .hero-kicker {
    font-size: 8.5pt; font-weight: 800; letter-spacing: .13em;
    text-transform: uppercase; opacity: .7;
  }
  .hero-title { margin-top: 6px; font-size: 21pt; font-weight: 900; line-height: 1.08; }
  .hero-score { margin-top: 10px; font-size: 26pt; font-weight: 900; }
  .hero-note {
    margin: 9px 0 0; max-width: 52ch; font-size: 10pt;
    line-height: 1.5; color: rgba(255,255,255,.74);
  }
  .chips { display: flex; gap: 8px; margin-top: 14px; }
  .chip {
    flex: 1; padding: 8px 10px; border-radius: 6px;
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14);
  }
  .chip-label {
    font-size: 7.5pt; letter-spacing: .07em; text-transform: uppercase;
    font-weight: 700; color: rgba(255,255,255,.7);
  }
  .chip-val { margin-top: 3px; font-size: 13pt; font-weight: 800; }
  .roast {
    margin: 14px 0 18px; padding: 15px 18px;
    border: 1px solid #c4db62; border-radius: 8px; background: #e4f88a;
  }
  .roast-kicker {
    font-size: 8pt; font-weight: 800; letter-spacing: .1em;
    text-transform: uppercase; color: #5c6b34;
  }
  .roast-quote {
    margin: 7px 0 0; max-width: 48ch; font-size: 14pt;
    font-weight: 650; line-height: 1.25; color: #232d16;
  }
  .card {
    border: 1px solid #dfe3dc; border-radius: 8px; padding: 14px 16px;
    margin-bottom: 11px; break-inside: avoid;
  }
  .card h3 { margin: 0; font-size: 12pt; }
  .card-sub {
    margin: 4px 0 0; font-size: 8pt; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: #667079;
  }
  .card-score { margin: 6px 0 0; font-size: 10.5pt; font-weight: 800; color: #168c65; }
  .verdict {
    margin: 11px 0 0; padding-left: 10px; border-left: 3px solid #182126;
    font-size: 10.5pt; font-weight: 600; line-height: 1.45;
  }
  .metrics {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 5px 18px; margin: 12px 0 0; font-size: 9.5pt;
  }
  .metrics div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dotted #dfe3dc; }
  .metrics span:first-child { color: #667079; }
  .metrics span:last-child { font-weight: 700; }
  .callouts { list-style: none; margin: 12px 0 0; padding: 0; border-top: 1px solid #dfe3dc; }
  .callouts li {
    position: relative; padding: 7px 0 7px 15px;
    border-bottom: 1px solid #dfe3dc; font-size: 9.5pt; line-height: 1.4;
  }
  .callouts li:last-child { border-bottom: none; padding-bottom: 0; }
  .callouts li::before { content: '—'; position: absolute; left: 0; color: #667079; }
  .missing { margin: 10px 0 0; font-size: 10pt; color: #667079; }
  .disclaimer {
    margin-top: 16px; padding-left: 10px; border-left: 3px solid #dfe3dc;
    font-size: 8.5pt; color: #667079; line-height: 1.45; break-inside: avoid;
  }
  .figure { margin: 13px 0 0; break-inside: avoid; }
  .figure h4 { margin: 0 0 6px; font-size: 10pt; }
  .figure canvas { display: block; width: 100%; height: auto; border: 1px solid #dfe3dc; border-radius: 5px; }
  .figure-note { margin: 6px 0 0; font-size: 8pt; color: #667079; line-height: 1.4; }
  .fig-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .legend { display: flex; gap: 10px; font-size: 7.5pt; font-weight: 700; color: #617078; }
  .legend span { display: flex; align-items: center; gap: 4px; }
  .legend i { display: block; width: 14px; height: 3px; background: #ff8268; }
  .legend i.ideal { height: 2px; background: repeating-linear-gradient(90deg, #182126 0 4px, transparent 4px 7px); }
  .heat-legend {
    display: flex; align-items: center; gap: 6px; margin-top: 6px;
    font-size: 7.5pt; font-weight: 700; color: #617078;
  }
  .heat-ramp {
    flex: 1; height: 6px; border-radius: 3px; border: 1px solid #dfe3dc;
    background: linear-gradient(90deg,
      #0a1046 0%, #1a3ac8 14%, #00bacd 32%, #28d25a 52%,
      #ffdc3c 70%, #ff8218 86%, #f02820 100%);
  }
  .research {
    margin-top: 13px; padding: 11px 13px; border: 1px solid #dfe3dc;
    border-left: 3px solid #2b6cb0; border-radius: 5px; background: #f4f7fa;
    break-inside: avoid;
  }
  .research-head {
    font-size: 7.5pt; font-weight: 800; letter-spacing: .08em;
    text-transform: uppercase; color: #2b6cb0;
  }
  .research-intro { margin: 5px 0 0; font-size: 8.5pt; font-weight: 700; }
  .research ul { margin: 7px 0 0; padding-left: 15px; font-size: 8.5pt; line-height: 1.45; color: #43505a; }
  .research li { margin-top: 4px; }
`;

function chips(roast, report) {
  return GAME_ORDER.map((key) => {
    const s = report.summary && report.summary[key];
    const val = s && s.score !== undefined && s.score !== null ? Number(s.score).toFixed(1) : '—';
    return `<div class="chip"><div class="chip-label">${esc(roast.chip(key))}</div>` +
      `<div class="chip-val">${esc(val)}<span style="font-size:8pt;opacity:.6"> /25</span></div></div>`;
  }).join('');
}

function researchBlock(roast, key) {
  const lines = roast.stationResearch(key);
  if (!lines.length) return '';
  return `<div class="research">` +
    `<div class="research-head">Also used in autism research</div>` +
    `<p class="research-intro">${esc(roast.researchIntro)}</p>` +
    `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul></div>`;
}

// The canvases are drawn by report-visuals.js, inlined at the bottom of the
// document. Headless Chrome runs it before printing, so the PDF gets the same
// heatmap and deviation plot the browser draws.
function gazeFigures(sessionDoc) {
  const result = sessionDoc && sessionDoc.games && sessionDoc.games.gaze && sessionDoc.games.gaze.result;
  const images = (result && result.images) || [];

  return [1, 2].map((id) => {
    const info = images.find((im) => im.id === id);
    const count = info && info.samples ? info.samples.length : 0;
    return `<div class="figure" id="fig-gaze-${id}">
      <h4>Image ${id} — Gaze Heatmap</h4>
      <canvas data-gaze="${id}" width="600" height="400"></canvas>
      <div class="heat-legend"><span>Fewer looks</span><i class="heat-ramp"></i><span>More looks</span></div>
      <p class="figure-note">${count
        ? `${count} samples. The line is the order they looked — dark dot first, lime dot last.`
        : 'No gaze samples were captured for this image.'}</p>
    </div>`;
  }).join('');
}

function routeFigure(sessionDoc) {
  const result = sessionDoc && sessionDoc.games && sessionDoc.games.wobblewalk && sessionDoc.games.wobblewalk.result;
  if (!result || !result.route || !result.route.length) return '';
  return `<div class="figure" id="fig-route">
    <div class="fig-head">
      <h4>Deviation from the centre line</h4>
      <div class="legend"><span><i class="ideal"></i>Ideal</span><span><i></i>You</span></div>
    </div>
    <canvas data-route="1" width="620" height="420"></canvas>
    <p class="figure-note">Start at the bottom, finish at the top. The shaded area is how far off centre the
      walk ran, normalised to shoulder width so camera distance does not change the number.</p>
  </div>`;
}

// report-visuals.js verbatim, plus a bootstrap that feeds it the raw samples
// and a file:// poster path. Same drawing code as the browser; only the source
// of the data differs.
function visualsScript(sessionDoc) {
  const games = (sessionDoc && sessionDoc.games) || {};
  const gaze = games.gaze && games.gaze.result;
  const ww = games.wobblewalk && games.wobblewalk.result;

  const data = {
    images: ((gaze && gaze.images) || []).map((im) => ({
      id: im.id,
      src: 'file:///' + path.join(POSTER_DIR, `${im.id}.png`).replace(/\\/g, '/'),
      samples: (im.samples || []).map((pt) => ({ x: pt.x, y: pt.y }))
    })),
    route: ((ww && ww.route) || []).map((pt) => ({ x: pt.x, y: pt.y }))
  };

  return `<script>${fs.readFileSync(VISUALS_PATH, 'utf8')}</script>
<script>
(function () {
  var data = ${JSON.stringify(data).replace(/</g, '\\u003c')};
  Array.prototype.forEach.call(document.querySelectorAll('canvas[data-gaze]'), function (canvas) {
    var id = Number(canvas.getAttribute('data-gaze'));
    for (var i = 0; i < data.images.length; i += 1) {
      if (data.images[i].id === id) {
        window.ReportVisuals.gazeHeatmap(canvas, data.images[i].src, data.images[i].samples);
        return;
      }
    }
  });
  var routeCanvas = document.querySelector('canvas[data-route]');
  if (routeCanvas && data.route.length) window.ReportVisuals.routeDeviation(routeCanvas, data.route);
}());
</script>`;
}

function stationCard(roast, key, summary, sessionDoc) {
  const head = `<h3>${esc(roast.title(key))}</h3>`;

  if (!summary) {
    return `<div class="card">${head}<div class="card-sub">${esc(key)}</div>` +
      `<p class="missing">${esc(roast.skipped(key))}</p>${researchBlock(roast, key)}</div>`;
  }

  const sub = `<div class="card-sub">${esc(summary.label || key)}</div>`;
  const score = summary.score === undefined || summary.score === null
    ? ''
    : `<div class="card-score">${Number(summary.score).toFixed(1)} / 25</div>`;

  if (summary.available === false) {
    return `<div class="card">${head}${sub}${score}` +
      `<p class="missing">${esc(roast.unavailable(key, summary.reason))}</p>` +
      `${researchBlock(roast, key)}</div>`;
  }

  const metrics = roast.stationMetrics(key, summary)
    .map(([label, value]) => `<div><span>${esc(label)}</span><span>${esc(value)}</span></div>`)
    .join('');
  const callouts = roast.stationCallouts(key, summary)
    .map((line) => `<li>${esc(line)}</li>`)
    .join('');

  let figures = '';
  if (key === 'gaze') figures = gazeFigures(sessionDoc);
  else if (key === 'wobblewalk') figures = routeFigure(sessionDoc);

  return `<div class="card">${head}${sub}${score}` +
    `<p class="verdict">${esc(roast.stationVerdict(key, summary))}</p>` +
    (metrics ? `<div class="metrics">${metrics}</div>` : '') +
    figures +
    (callouts ? `<ul class="callouts">${callouts}</ul>` : '') +
    researchBlock(roast, key) +
    `</div>`;
}

function buildHtml(roast, report, sessionDoc) {
  const maxScore = report.max_score || 100;
  const tier = roast.overallTier(report.overall_score, maxScore);
  const score = report.overall_score === null || report.overall_score === undefined
    ? `— / ${maxScore}`
    : `${Number(report.overall_score).toFixed(1)} / ${maxScore}`;
  const done = (report.games_completed || []).length;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<title>Behavior Lab Report — ${esc(report.session_id)}</title>
<style>${STYLES}</style></head>
<body>
  <div class="sheet-head">
    <span class="brand">BEHAVIOR LAB</span>
    <span class="sheet-meta">Session ${esc(report.session_id)} · ${done} of 4 stations completed</span>
  </div>

  <div class="hero">
    <div class="hero-kicker">${esc(tier.label)}</div>
    <div class="hero-title">${esc(tier.title)}</div>
    <div class="hero-score">${esc(score)}</div>
    <p class="hero-note">${esc(tier.note)}</p>
    <div class="chips">${chips(roast, report)}</div>
  </div>

  <div class="roast">
    <div class="roast-kicker">Verdict of the session</div>
    <p class="roast-quote">&ldquo;${esc(roast.overallRoast(report))}&rdquo;</p>
  </div>

  ${GAME_ORDER.map((key) => stationCard(roast, key, report.summary && report.summary[key], sessionDoc)).join('\n  ')}

  <p class="disclaimer">${esc(report.disclaimer || '')}</p>
  ${visualsScript(sessionDoc)}
</body></html>`;
}

// The canvases are drawn after the posters decode, which happens after the load
// event. --virtual-time-budget lets Chrome run that out before it prints, and
// --allow-file-access-from-files lets a file:// page load a file:// poster.
function toPdf(exe, htmlPath, pdfPath) {
  execFileSync(exe, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--virtual-time-budget=10000',
    '--run-all-compositor-stages-before-draw',
    '--no-pdf-header-footer',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    'file:///' + htmlPath.replace(/\\/g, '/')
  ], { stdio: 'ignore', timeout: 90000 });
}

async function main() {
  const roast = loadRoast();
  const exe = findBrowser();
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_IDS;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const id of ids) {
    const [report, sessionDoc] = await Promise.all([
      getJson(`/api/sessions/${encodeURIComponent(id)}/report`),
      getJson(`/api/sessions/${encodeURIComponent(id)}`)
    ]);
    const htmlPath = path.join(OUT_DIR, `report-${id}.html`);
    const pdfPath = path.join(OUT_DIR, `report-${id}.pdf`);

    fs.writeFileSync(htmlPath, buildHtml(roast, report, sessionDoc), 'utf8');
    toPdf(exe, htmlPath, pdfPath);

    const size = fs.existsSync(pdfPath) ? fs.statSync(pdfPath).size : 0;
    if (!size) throw new Error(`PDF was not produced for ${id}`);
    console.log(`${id}  ->  ${path.relative(ROOT, pdfPath)}  (${size} bytes)`);
  }
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  console.error(`Is the server running on ${BASE}?`);
  process.exitCode = 1;
});
