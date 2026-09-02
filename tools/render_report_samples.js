/* Print the final report's copy as plain text, for reviewing the roast layer
 * without clicking through the browser.
 *
 *   node tools/render_report_samples.js EVT-2026-00001 EVT-2026-00002
 *
 * With no arguments it renders every completed session on the leaderboard.
 * Loads static/shell/report-roast.js in a sandbox so the text shown here is
 * exactly the copy the shell would render.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = 'http://127.0.0.1:8000';
const ROAST_PATH = path.join(__dirname, '..', 'static', 'shell', 'report-roast.js');

const GAME_ORDER = ['gaze', 'timer', 'deadpan', 'wobblewalk'];

function loadRoast() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ROAST_PATH, 'utf8'), sandbox, { filename: ROAST_PATH });
  return sandbox.window.ReportRoast;
}

async function getJson(urlPath) {
  const response = await fetch(BASE + urlPath);
  if (!response.ok) throw new Error(`${urlPath} -> HTTP ${response.status}`);
  return response.json();
}

function rule(char) {
  return char.repeat(74);
}

function wrap(text, width, indent) {
  const pad = ' '.repeat(indent || 0);
  const lines = [];
  let current = pad;
  for (const word of String(text).split(/\s+/)) {
    if (current.trim() && current.length + word.length + 1 > width) {
      lines.push(current);
      current = pad + word;
    } else {
      current += (current.trim() ? ' ' : '') + word;
    }
  }
  if (current.trim()) lines.push(current);
  return lines.join('\n');
}

function renderReport(roast, report) {
  const maxScore = report.max_score || 100;
  const tier = roast.overallTier(report.overall_score, maxScore);
  const overall = report.overall_score === null || report.overall_score === undefined
    ? `— / ${maxScore}`
    : `${Number(report.overall_score).toFixed(1)} / ${maxScore}`;

  const out = [];
  out.push(rule('='));
  out.push(`  ${report.session_id}   ${overall}   (${report.games_completed.length} of 4 stations)`);
  out.push(rule('='));
  out.push('');
  out.push(`  ${tier.label.toUpperCase()}`);
  out.push(`  ${tier.title}`);
  out.push(`  ${overall}`);
  out.push(wrap(tier.note, 74, 2));
  out.push('');
  out.push('  ' + GAME_ORDER.map((key) => {
    const s = report.summary && report.summary[key];
    const value = s && s.score !== undefined && s.score !== null ? `${Number(s.score).toFixed(1)}/25` : '—';
    return `${roast.chip(key)} ${value}`;
  }).join('   ·   '));
  out.push('');
  out.push('  VERDICT OF THE SESSION');
  out.push(wrap(`“${roast.overallRoast(report)}”`, 74, 2));
  out.push('');

  for (const key of GAME_ORDER) {
    const summary = report.summary && report.summary[key];
    out.push(rule('-'));
    out.push(`  ${roast.title(key)}`);

    if (!summary) {
      out.push(`  ${key.toUpperCase()}`);
      out.push(wrap(roast.skipped(key), 74, 2));
      out.push('');
      continue;
    }

    out.push(`  ${String(summary.label || key).toUpperCase()}`);
    if (summary.score !== undefined && summary.score !== null) {
      out.push(`  ${Number(summary.score).toFixed(1)} / 25`);
    }

    if (summary.available === false) {
      out.push(wrap(roast.unavailable(key, summary.reason), 74, 2));
      out.push('');
      continue;
    }

    out.push('');
    out.push(wrap(roast.stationVerdict(key, summary), 74, 2));
    out.push('');
    for (const [label, value] of roast.stationMetrics(key, summary)) {
      out.push(`    ${label.padEnd(24, '.')} ${value}`);
    }
    const callouts = roast.stationCallouts(key, summary);
    if (callouts.length) out.push('');
    for (const line of callouts) out.push(wrap(`— ${line}`, 74, 4));
    out.push('');
  }

  out.push(rule('-'));
  out.push(wrap(report.disclaimer || '', 74, 2));
  out.push('');
  return out.join('\n');
}

async function main() {
  const roast = loadRoast();
  let ids = process.argv.slice(2);
  if (!ids.length) {
    const leaderboard = await getJson('/api/leaderboard');
    ids = (leaderboard.entries || leaderboard || []).map((e) => e.session_id).filter(Boolean);
  }
  if (!ids.length) {
    console.log('No completed sessions. Seed one: .venv/Scripts/python tools/seed_demo_session.py mid');
    return;
  }
  for (const id of ids) {
    const report = await getJson(`/api/sessions/${encodeURIComponent(id)}/report`);
    console.log(renderReport(roast, report));
  }
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  console.error(`Is the server running on ${BASE}?`);
  process.exitCode = 1;
});
