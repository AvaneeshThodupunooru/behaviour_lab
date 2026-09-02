import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Footprints,
  Gauge,
  RefreshCw,
  Route,
  Sparkles,
  Trophy,
  Undo2,
} from 'lucide-react';
import { getEventParams, eventShellUrl } from '../api/eventSession.js';

// Neutral, non-clinical labels only. This is a game-performance score
// describing how closely the tracked path followed a straight line -
// not a medical, balance, or sobriety assessment of any kind.
// Tier colors are deepened variants of the THE THING accents (mint, sky, zap,
// tang, punch, lilac) so they stay legible as text and strokes on the cream
// report surfaces.
const RESULT_TIERS = [
  { max: 12, title: 'Highly Consistent Path', label: 'Minimal deviation', color: '#0f8f63', note: 'The tracked path closely followed a straight line, with very little side-to-side movement.' },
  { max: 27, title: 'Mostly Consistent Path', label: 'Slight deviation', color: '#1a7fb5', note: 'The tracked path stayed close to a straight line, with small, typical deviations.' },
  { max: 45, title: 'Moderate Drift', label: 'Noticeable deviation', color: '#b5820b', note: 'The tracked path showed a steady, moderate drift away from a straight line.' },
  { max: 64, title: 'Wide Deviation', label: 'Frequent course changes', color: '#d1571a', note: 'The tracked path moved well off a straight line, with several course corrections.' },
  { max: 82, title: 'High Variability', label: 'Substantial deviation', color: '#d61e63', note: 'The tracked path deviated substantially from a straight line for much of the walk.' },
  { max: 100, title: 'Very High Variability', label: 'Maximum deviation', color: '#7a4cd6', note: 'The tracked path showed large, frequent swings away from a straight line.' },
];

const SAMPLE_REPORT = {
  game_metrics: {
    available: true,
    wobble_score: 57.4,
    mean_deviation_pct: 31.8,
    max_deviation_pct: 72.4,
    path_efficiency_pct: 78.6,
    direction_changes: 6,
    drift_direction: 'right',
    walk_duration_seconds: 8.7,
    walk_distance_body_widths: 5.9,
    tracked_frames: 261,
    measurement_unit: 'percent of shoulder width',
    route: [
      { x: 50, y: 92 }, { x: 45, y: 89 }, { x: 39, y: 86 },
      { x: 35, y: 82 }, { x: 38, y: 78 }, { x: 48, y: 74 },
      { x: 59, y: 70 }, { x: 66, y: 66 }, { x: 68, y: 62 },
      { x: 62, y: 58 }, { x: 51, y: 54 }, { x: 41, y: 50 },
      { x: 36, y: 46 }, { x: 40, y: 42 }, { x: 51, y: 38 },
      { x: 63, y: 34 }, { x: 70, y: 30 }, { x: 66, y: 26 },
      { x: 57, y: 22 }, { x: 52, y: 18 }, { x: 55, y: 14 },
      { x: 61, y: 10 }, { x: 64, y: 8 },
    ],
  },
};

const REPORT_CSS = `
.ww-page{--ink:#120b26;--muted:#5b4a7d;--paper:#fbead1;--cream:#fff4e4;--line:#120b26;--lime:#3fe0a0;--cyan:#4cc9f0;--coral:#ff4d8d;--yellow:#ffd23f;--lilac:#b79cff;--hard:6px 6px 0 0 #120b26;--hard-sm:4px 4px 0 0 #120b26;--font-body:'Space Grotesk',system-ui,sans-serif;--font-title:'Baloo 2','Trebuchet MS',system-ui,sans-serif;width:100%;max-width:100%;overflow-x:clip;color:var(--ink);font-family:var(--font-body);letter-spacing:0}
.ww-page *{box-sizing:border-box}
.ww-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.ww-action{display:inline-flex;align-items:center;gap:8px;min-height:42px;border:3px solid var(--line);border-radius:999px;padding:8px 16px;background:var(--cream);color:var(--ink);font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.12em;box-shadow:var(--hard-sm);transition:transform .2s cubic-bezier(0.22,1,0.36,1),box-shadow .2s cubic-bezier(0.22,1,0.36,1),background .2s}
.ww-action:hover{transform:translateY(-2px) rotate(-1.5deg);box-shadow:var(--hard);background:var(--yellow)}
.ww-action:active{transform:translateY(1px);box-shadow:none}
.ww-action.primary{background:var(--coral);color:var(--cream);border-color:var(--line)}
.ww-action.primary:hover{background:#ff77a5;color:var(--cream)}
.ww-hero{position:relative;min-width:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:center;background:var(--cream);border:3px solid var(--line);border-bottom:10px solid var(--tier);border-radius:2rem;box-shadow:var(--hard);padding:30px 32px}
.ww-hero:after{content:'';position:absolute;width:170px;height:170px;right:116px;bottom:-130px;border:30px solid var(--lime);border-radius:50%;opacity:.5;pointer-events:none}
.ww-kicker{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:6px 14px;border:3px solid var(--line);border-radius:999px;background:var(--yellow);box-shadow:var(--hard-sm);color:var(--ink);font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.ww-title{margin:0;font-family:var(--font-title);font-size:clamp(34px,6vw,62px);font-weight:800;line-height:.98;max-width:650px;text-shadow:0 4px 0 rgba(18,11,38,.12)}
.ww-note{margin:14px 0 0;max-width:58ch;color:var(--muted);font-size:15px;line-height:1.55}
.ww-score{position:relative;width:150px;height:150px;display:grid;place-items:center;z-index:1}
.ww-score svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ww-score .track{stroke:rgba(18,11,38,.14)}.ww-score .fill{stroke:var(--tier);transition:stroke-dashoffset .8s cubic-bezier(0.22,1,0.36,1)}
.ww-score-value{font-family:var(--font-title);font-size:48px;font-weight:800;line-height:1}.ww-score-label{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:3px;text-align:center}
.ww-chips{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0 0}
.ww-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border:3px solid var(--line);border-radius:999px;background:var(--cream);box-shadow:var(--hard-sm);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}
.ww-main{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(240px,.62fr);gap:16px;min-width:0;align-items:stretch}
.ww-panel{min-width:0;background:var(--cream);border:3px solid var(--line);border-radius:1.5rem;box-shadow:var(--hard);padding:22px}
.ww-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
.ww-panel-title{display:flex;align-items:center;gap:8px;margin:0;font-family:var(--font-title);font-size:19px;font-weight:800}.ww-panel-sub{margin:4px 0 0;color:var(--muted);font-size:12px}
.ww-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.ww-legend span{display:flex;align-items:center;gap:5px}.ww-legend i{display:block;width:16px;height:4px;background:var(--coral)}.ww-legend i.ideal{background:repeating-linear-gradient(90deg,var(--ink) 0 4px,transparent 4px 7px)}
.ww-route{width:100%;min-width:0;height:390px;border:3px solid var(--line);border-radius:14px;background-color:var(--paper);background-image:linear-gradient(rgba(18,11,38,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(18,11,38,.07) 1px,transparent 1px);background-size:24px 24px;overflow:hidden}
.ww-route svg{width:100%;height:100%;display:block}.ww-route-path{fill:none;stroke:var(--coral);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.ww-route-shadow{fill:none;stroke:var(--cream);stroke-width:9;stroke-linecap:round;stroke-linejoin:round}.ww-route-ideal{stroke:var(--ink);stroke-width:1.6;stroke-dasharray:4 5;opacity:.5}
.ww-side{min-width:0}.ww-verdict{background:var(--lime);border-color:var(--line)}.ww-roast-band{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;padding:24px 28px}.ww-verdict blockquote{max-width:38ch;margin:0;font-family:var(--font-title);font-size:24px;font-weight:700;line-height:1.18;overflow-wrap:break-word;text-wrap:balance}.ww-verdict p{margin:0;font-size:13px;line-height:1.5;color:rgba(18,11,38,.72)}.ww-roast-meta{max-width:180px;text-align:right}
.ww-callouts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}.ww-callouts li{display:flex;gap:10px;padding:12px 0;border-top:2px solid rgba(18,11,38,.14);font-size:13px;line-height:1.45}.ww-callouts li:first-child{border-top:0;padding-top:2px}.ww-callouts svg{flex:none;margin-top:1px;color:var(--tier)}
.ww-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.ww-stat{background:var(--cream);border:3px solid var(--line);border-radius:1.25rem;box-shadow:var(--hard-sm);padding:18px}.ww-stat-icon{width:38px;height:38px;display:grid;place-items:center;border:3px solid var(--line);border-radius:11px;margin-bottom:18px;color:var(--ink)}.ww-stat:nth-child(1) .ww-stat-icon{background:var(--cyan)}.ww-stat:nth-child(2) .ww-stat-icon{background:var(--yellow)}.ww-stat:nth-child(3) .ww-stat-icon{background:var(--coral);color:var(--cream)}.ww-stat:nth-child(4) .ww-stat-icon{background:var(--lime)}
.ww-stat-value{font-family:var(--font-title);font-size:29px;font-weight:800;line-height:1}.ww-stat-label{margin-top:6px;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.ww-footer{display:flex;justify-content:space-between;gap:20px;margin-top:16px;padding:12px 2px;color:rgba(255,244,228,.62);font-size:11px;line-height:1.4}
.ww-empty{max-width:560px;margin:70px auto;background:var(--cream);border:3px solid var(--line);border-radius:2rem;box-shadow:var(--hard);padding:36px;text-align:center}.ww-empty-icon{width:62px;height:62px;display:grid;place-items:center;margin:0 auto 18px;background:var(--yellow);border:3px solid var(--line);border-radius:14px;box-shadow:var(--hard-sm)}.ww-empty h1{font-family:var(--font-title);font-size:34px;font-weight:800;margin:0}.ww-empty p{color:var(--muted);line-height:1.55;margin:10px 0 22px}
@media(max-width:980px){.ww-hero{grid-template-columns:1fr;padding:24px}.ww-hero:after{display:none}.ww-score{width:130px;height:130px}.ww-main{grid-template-columns:1fr}.ww-route{height:360px}.ww-roast-band{grid-template-columns:1fr}.ww-roast-meta{max-width:none;text-align:left}}
@media(max-width:760px){.ww-route{height:330px}.ww-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ww-footer{flex-direction:column}.ww-toolbar .ww-action span{display:none}.ww-verdict blockquote{font-size:21px}}
@media(max-width:430px){.ww-title{font-size:38px}.ww-hero{padding:20px}.ww-route{height:290px}.ww-stat{padding:14px}.ww-stat-value{font-size:23px}.ww-panel{padding:15px}.ww-panel-head{display:block}.ww-legend{margin-top:8px}}
@media print{.ww-no-print{display:none!important}.ww-page{padding:0!important}.ww-hero,.ww-panel,.ww-stat,.ww-empty{break-inside:avoid;box-shadow:none;border-width:1px}.ww-hero{border-bottom:6px solid var(--tier)}.ww-kicker,.ww-chip,.ww-empty-icon,.ww-stat-icon{box-shadow:none;border-width:1px}.ww-route{height:330px;border-width:1px}.ww-footer{color:var(--muted)}.ww-main{grid-template-columns:1.45fr .72fr}}
`;

const getTier = (score) => RESULT_TIERS.find((tier) => score <= tier.max) || RESULT_TIERS.at(-1);

// A short, factual, data-driven summary sentence - not a canned joke.
const getSummary = (game, tier) => {
  const changes = Number(game.direction_changes || 0);
  return `${tier.note} Average deviation from the straight path was ${game.mean_deviation_pct}%, ` +
    `with ${changes} direction change${changes === 1 ? '' : 's'} recorded over the walk.`;
};

const buildCallouts = (game) => {
  const lines = [];
  const changes = Number(game.direction_changes || 0);

  if (changes >= 5) lines.push(`${changes} direction changes were recorded during the walk.`);
  else if (changes >= 2) lines.push(`${changes} course correction${changes === 1 ? '' : 's'} were recorded during the walk.`);
  else lines.push('Very few course corrections were recorded during the walk.');

  if (game.drift_direction === 'center') lines.push('The path finished close to the center of the straight-line reference.');
  else lines.push(`The path drifted toward the ${game.drift_direction} side of the straight-line reference.`);

  lines.push(`Path efficiency was ${game.path_efficiency_pct}% compared with a perfectly straight walk.`);
  return lines;
};

const Metric = ({ icon, value, label }) => (
  <div className="ww-stat">
    <div className="ww-stat-icon">{React.createElement(icon, { size: 18 })}</div>
    <div className="ww-stat-value">{value}</div>
    <div className="ww-stat-label">{label}</div>
  </div>
);

const ReportPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const eventParams = getEventParams();
  const returnUrl = eventShellUrl(eventParams);

  return (
    <div className="ww-thanks-page" aria-live="polite">
      <style>{`
        .ww-thanks-page{min-height:calc(100vh - 128px);display:grid;place-items:center;padding:32px 20px;font-family:'Space Grotesk',system-ui,sans-serif}
        .ww-thanks-card{position:relative;isolation:isolate;overflow:hidden;width:min(680px,100%);padding:52px 40px;text-align:center;background:#fff4e4;color:#120b26;border:3px solid #120b26;border-radius:2rem;box-shadow:8px 8px 0 #120b26}
        .ww-thanks-card:before,.ww-thanks-card:after{content:'';position:absolute;z-index:-1;border:3px solid #120b26;border-radius:999px;opacity:.7}
        .ww-thanks-card:before{width:170px;height:170px;right:-64px;top:-76px;background:#3fe0a0;animation:ww-thanks-float 5s ease-in-out infinite}
        .ww-thanks-card:after{width:112px;height:112px;left:-42px;bottom:-54px;background:#ffd23f;animation:ww-thanks-float 5s ease-in-out .8s infinite reverse}
        .ww-thanks-icon{width:72px;height:72px;display:grid;place-items:center;margin:0 auto 22px;border:3px solid #120b26;border-radius:18px;background:#ff4d8d;color:#fff4e4;box-shadow:5px 5px 0 #120b26;animation:ww-thanks-pop .55s cubic-bezier(.22,1,.36,1) both}
        .ww-thanks-kicker{margin:0 0 13px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
        .ww-thanks-title{max-width:14ch;margin:0 auto;font-family:'Baloo 2','Trebuchet MS',sans-serif;font-size:clamp(36px,6vw,58px);font-weight:800;line-height:.98;letter-spacing:-.03em}
        .ww-thanks-copy{max-width:46ch;margin:22px auto 0;color:#5b4a7d;font-size:17px;line-height:1.58}
        .ww-thanks-next{display:inline-flex;align-items:center;gap:9px;margin-top:28px;padding:9px 15px;border:3px solid #120b26;border-radius:999px;background:#b79cff;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;box-shadow:4px 4px 0 #120b26}
        @keyframes ww-thanks-pop{from{opacity:0;transform:scale(.7) rotate(-12deg)}to{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes ww-thanks-float{50%{transform:translateY(12px) rotate(8deg)}}
      `}</style>
      <section className="ww-thanks-card">
        <div className="ww-thanks-icon"><Sparkles size={34} aria-hidden="true" /></div>
        <p className="ww-thanks-kicker">All games complete</p>
        <h1 className="ww-thanks-title">Thank you for spending time and playing games with us.</h1>
        <p className="ww-thanks-copy">You can collect your report and check your score on the leaderboard at the next station.</p>
        <button className="ww-thanks-next" onClick={() => window.location.assign(returnUrl)} type="button"><Footprints size={16} aria-hidden="true" /> Head to the next station</button>
      </section>
    </div>
  );

  const isSample = new URLSearchParams(location.search).get('sample') === '1';
  const report = location.state?.report || (isSample ? SAMPLE_REPORT : null);
  const game = report?.game_metrics;

  if (!game?.available) {
    return (
      <div className="ww-page max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <style>{REPORT_CSS}</style>
        <div className="ww-empty">
          <div className="ww-empty-icon"><Route size={27} /></div>
          <h1>No route to score</h1>
          <p>{game?.reason || 'Record a WobbleWalk round first, then your route and score will appear here.'}</p>
          <button className="ww-action primary" onClick={() => navigate('/')}><RefreshCw size={16} /> Start a round</button>
        </div>
      </div>
    );
  }

  const score = Math.round(Number(game.wobble_score || 0));
  const tier = getTier(score);
  const circumference = 2 * Math.PI * 61;
  const dashOffset = circumference * (1 - score / 100);
  const routePoints = (game.route || []).map((point) => `${point.x},${point.y}`).join(' ');
  const callouts = buildCallouts(game);
  const summary = getSummary(game, tier);
  return (
    <div className="ww-page max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24" style={{ '--tier': tier.color }}>
      <style>{REPORT_CSS}</style>

      <div className="ww-toolbar ww-no-print">
        <button className="ww-action" onClick={() => navigate('/')}><ArrowLeft size={16} /><span>New round</span></button>
        {isSample && <span className="ww-chip"><Sparkles size={14} /> Sample round</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ww-action" onClick={() => window.print()}><Download size={16} /><span>Save score</span></button>
          {eventParams.sessionId && (
            <a className="ww-action primary" href={returnUrl}><span>Return to event</span></a>
          )}
        </div>
      </div>

      <section className="ww-hero">
        <div>
          <p className="ww-kicker"><Trophy size={16} /> {tier.label}</p>
          <h1 className="ww-title">{tier.title}</h1>
          <p className="ww-note">{tier.note}</p>
          <div className="ww-chips">
            <span className="ww-chip"><Footprints size={14} /> {game.walk_duration_seconds}s walk</span>
            <span className="ww-chip"><Sparkles size={14} /> {game.direction_changes} direction change{game.direction_changes === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="ww-score" aria-label={`Stability score ${score} out of 100`}>
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle className="track" cx="70" cy="70" r="61" fill="none" strokeWidth="12" />
            <circle className="fill" cx="70" cy="70" r="61" fill="none" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
          </svg>
          <div><div className="ww-score-value">{score}</div><div className="ww-score-label">deviation / 100</div></div>
        </div>
      </section>

      <section className="ww-panel ww-verdict ww-roast-band" style={{ marginTop: 16 }}>
        <div>
          <p className="ww-kicker" style={{ marginBottom: 12 }}>Round summary</p>
          <blockquote>{summary}</blockquote>
        </div>
        <p className="ww-roast-meta">Based on {game.direction_changes} direction change{game.direction_changes === 1 ? '' : 's'} and a {game.drift_direction === 'center' ? 'centered' : `${game.drift_direction}-drifting`} finish.</p>
      </section>

      <section className="ww-stats" aria-label="Round statistics">
        <Metric icon={Gauge} value={`${game.mean_deviation_pct}%`} label="Average deviation" />
        <Metric icon={Route} value={`${game.max_deviation_pct}%`} label="Biggest detour" />
        <Metric icon={Footprints} value={`${game.path_efficiency_pct}%`} label="Path efficiency" />
        <Metric icon={Undo2} value={game.direction_changes} label="Direction changes" />
      </section>

      <div className="ww-main" style={{ marginTop: 16 }}>
        <section className="ww-panel">
          <div className="ww-panel-head">
            <div><h2 className="ww-panel-title"><Route size={18} /> Route replay</h2><p className="ww-panel-sub">Start at the bottom. Survive to the finish.</p></div>
            <div className="ww-legend"><span><i className="ideal" /> Ideal</span><span><i /> You</span></div>
          </div>
          <div className="ww-route">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Tracked walking route compared with a straight line">
              <line className="ww-route-ideal" x1="50" y1="92" x2="50" y2="8" vectorEffect="non-scaling-stroke" />
              {routePoints && <>
                <polyline className="ww-route-shadow" points={routePoints} vectorEffect="non-scaling-stroke" />
                <polyline className="ww-route-path" points={routePoints} vectorEffect="non-scaling-stroke" />
                <circle cx={game.route[0].x} cy={game.route[0].y} r="2.4" fill="#120b26" vectorEffect="non-scaling-stroke" />
                <circle cx={game.route.at(-1).x} cy={game.route.at(-1).y} r="3" fill="#ffd23f" stroke="#120b26" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
              </>}
              <text x="55" y="94" fontSize="3.2" fontWeight="800" fill="#5b4a7d">START</text>
              <text x="55" y="10" fontSize="3.2" fontWeight="800" fill="#5b4a7d">FINISH</text>
            </svg>
          </div>
        </section>

        <aside className="ww-side">
          <section className="ww-panel">
            <h2 className="ww-panel-title" style={{ marginBottom: 10 }}><Sparkles size={18} /> Replay commentary</h2>
            <ul className="ww-callouts">
              {callouts.map((line) => <li key={line}><Undo2 size={16} /><span>{line}</span></li>)}
            </ul>
          </section>
        </aside>
      </div>

      <div className="ww-footer">
        <span>Deviation is normalized to shoulder width for a fair score at different camera distances.</span>
        <span>Game performance score only, not a medical or balance assessment.</span>
      </div>
    </div>
  );
};

export default ReportPage;
