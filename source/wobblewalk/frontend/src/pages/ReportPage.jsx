import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Footprints,
  Gauge,
  RefreshCw,
  RotateCw,
  Route,
  Sparkles,
  Trophy,
  Undo2,
} from 'lucide-react';

const RESULT_TIERS = [
  { max: 12, title: 'Designated Driver Energy', label: 'Suspiciously responsible', color: '#168c65', note: 'Calm, centred, and irritatingly competent. You are buying the fries.' },
  { max: 27, title: 'One-Drink Confidence', label: 'Mostly believable', color: '#2f7fd3', note: 'You said "I am completely fine" and, annoyingly, the data mostly agrees.' },
  { max: 45, title: 'Office Chair Wheel', label: 'Professionally wonky', color: '#d38b16', note: 'Functional, determined, and drifting toward Accounts for no clear reason.' },
  { max: 64, title: 'GPS Left the Chat', label: 'Scenic route unlocked', color: '#e2673f', note: 'You did not walk the line. You entered negotiations with it.' },
  { max: 82, title: 'Dignity Took an Uber', label: 'Boldly off course', color: '#db3e67', note: 'Your feet started a group project and nobody read the brief.' },
  { max: 100, title: 'Floor: 1, You: 0', label: 'Maximum wobble', color: '#8e4bc5', note: 'That route needs a meeting, a witness, and possibly its own legal counsel.' },
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
    spin_count: 5,
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

const ROAST_LINES = {
  clean: [
    'Bro walked so straight Google Maps asked for directions.',
    "Bro's balance has a better resume than half the office.",
    'You walked like your dignity had a performance review.',
    'Bro treated that line like a legally binding contract.',
    'That walk was cleaner than your browser history claims to be.',
  ],
  wobbly: [
    'Bro, you walk like a girly pop leaving brunch with unfinished business.',
    "Bro's feet are in a long-distance relationship.",
    "The way you walk won't get you far in life, but it will get you around the entire lane.",
    'Your left foot and right foot are not on speaking terms.',
    'Bro walked like he was being chased by Tung Tung Tung Sahur.',
    'Bro zigzagged like the Wi-Fi signal depended on it.',
    'You walked like every step needed manager approval.',
    'Bro moved like the floor had pop-up ads.',
  ],
  chaos: [
    'That walk had more plot twists than a season finale.',
    "Bro's GPS did not recalculate. It resigned.",
    'You walked like rent was due on both sides of the lane.',
    'Bro treated the straight line like terms and conditions.',
    'Your balance clocked out before you started.',
    'The finish line saw you coming and updated its privacy settings.',
    'Bro walked like the floor just sent a risky text.',
  ],
};

const REPORT_CSS = `
.ww-page{--ink:#182126;--muted:#617078;--paper:#f6f7f2;--line:#dfe3dc;--lime:#e4f88a;--cyan:#8ddcf1;--coral:#ff8268;--yellow:#ffd868;width:100%;max-width:100%;overflow-x:clip;color:var(--ink);font-family:Inter,system-ui,sans-serif;letter-spacing:0}
.ww-page *{box-sizing:border-box;letter-spacing:0}
.ww-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
.ww-action{display:inline-flex;align-items:center;gap:8px;min-height:40px;border:1px solid var(--line);border-radius:6px;padding:8px 12px;background:#fff;color:var(--ink);font-weight:700;font-size:13px;transition:transform .18s ease,box-shadow .18s ease}
.ww-action:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(24,33,38,.09)}
.ww-action.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
.ww-hero{position:relative;min-width:0;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:center;background:#fff;border:1px solid var(--line);border-bottom:7px solid var(--tier);border-radius:8px;padding:28px 30px}
.ww-hero:after{content:'';position:absolute;width:170px;height:170px;right:116px;bottom:-130px;border:30px solid var(--lime);border-radius:50%;opacity:.65;pointer-events:none}
.ww-kicker{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--tier);font-size:12px;font-weight:800;text-transform:uppercase}
.ww-title{margin:0;font-family:Fraunces,Georgia,serif;font-size:clamp(34px,6vw,62px);font-weight:650;line-height:.98;max-width:650px}
.ww-note{margin:14px 0 0;max-width:58ch;color:var(--muted);font-size:15px;line-height:1.55}
.ww-score{position:relative;width:150px;height:150px;display:grid;place-items:center;z-index:1}
.ww-score svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ww-score .track{stroke:#edf0eb}.ww-score .fill{stroke:var(--tier);transition:stroke-dashoffset .8s ease}
.ww-score-value{font-size:46px;font-weight:850;line-height:1}.ww-score-label{font-size:10px;font-weight:800;text-transform:uppercase;color:var(--muted);margin-top:3px;text-align:center}
.ww-chips{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0 0}
.ww-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.78);font-size:12px;font-weight:750;color:var(--ink)}
.ww-main{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(240px,.62fr);gap:16px;min-width:0;align-items:stretch}
.ww-panel{min-width:0;background:#fff;border:1px solid var(--line);border-radius:8px;padding:20px}
.ww-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
.ww-panel-title{display:flex;align-items:center;gap:8px;margin:0;font-size:15px;font-weight:850}.ww-panel-sub{margin:4px 0 0;color:var(--muted);font-size:12px}
.ww-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:11px;font-weight:700}.ww-legend span{display:flex;align-items:center;gap:5px}.ww-legend i{display:block;width:16px;height:3px;background:var(--coral)}.ww-legend i.ideal{background:repeating-linear-gradient(90deg,var(--ink) 0 4px,transparent 4px 7px)}
.ww-route{width:100%;min-width:0;height:390px;border:1px solid var(--line);border-radius:6px;background-color:var(--paper);background-image:linear-gradient(rgba(24,33,38,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(24,33,38,.045) 1px,transparent 1px);background-size:24px 24px;overflow:hidden}
.ww-route svg{width:100%;height:100%;display:block}.ww-route-path{fill:none;stroke:var(--coral);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}.ww-route-shadow{fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round;stroke-linejoin:round}.ww-route-ideal{stroke:var(--ink);stroke-width:1.3;stroke-dasharray:4 5;opacity:.55}
.ww-side{min-width:0}.ww-verdict{background:var(--lime);border-color:#c4db62}.ww-roast-band{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;padding:22px 26px}.ww-verdict blockquote{max-width:38ch;margin:0;font-family:Fraunces,Georgia,serif;font-size:23px;font-weight:620;line-height:1.18;overflow-wrap:break-word;text-wrap:balance}.ww-verdict p{margin:0;font-size:13px;line-height:1.5;color:#425028}.ww-roast-meta{max-width:180px;text-align:right}
.ww-callouts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}.ww-callouts li{display:flex;gap:10px;padding:12px 0;border-top:1px solid var(--line);font-size:13px;line-height:1.45}.ww-callouts li:first-child{border-top:0;padding-top:2px}.ww-callouts svg{flex:none;margin-top:1px;color:var(--tier)}
.ww-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}.ww-stat{background:#fff;border:1px solid var(--line);border-radius:8px;padding:17px}.ww-stat-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:6px;margin-bottom:18px;color:var(--ink)}.ww-stat:nth-child(1) .ww-stat-icon{background:var(--cyan)}.ww-stat:nth-child(2) .ww-stat-icon{background:var(--yellow)}.ww-stat:nth-child(3) .ww-stat-icon{background:var(--coral)}.ww-stat:nth-child(4) .ww-stat-icon{background:var(--lime)}
.ww-stat-value{font-size:27px;font-weight:850;line-height:1}.ww-stat-label{margin-top:6px;color:var(--muted);font-size:11px;font-weight:750;text-transform:uppercase}
.ww-footer{display:flex;justify-content:space-between;gap:20px;margin-top:14px;padding:12px 2px;color:var(--muted);font-size:11px;line-height:1.4}
.ww-empty{max-width:560px;margin:70px auto;background:#fff;border:1px solid var(--line);border-radius:8px;padding:34px;text-align:center}.ww-empty-icon{width:58px;height:58px;display:grid;place-items:center;margin:0 auto 18px;background:var(--yellow);border-radius:8px}.ww-empty h1{font-family:Fraunces,Georgia,serif;font-size:32px;margin:0}.ww-empty p{color:var(--muted);line-height:1.55;margin:10px 0 22px}
@media(max-width:980px){.ww-hero{grid-template-columns:1fr;padding:24px}.ww-score{width:130px;height:130px}.ww-main{grid-template-columns:1fr}.ww-route{height:360px}.ww-roast-band{grid-template-columns:1fr}.ww-roast-meta{max-width:none;text-align:left}}
@media(max-width:760px){.ww-route{height:330px}.ww-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ww-footer{flex-direction:column}.ww-toolbar .ww-action span{display:none}.ww-verdict blockquote{font-size:21px}}
@media(max-width:430px){.ww-title{font-size:38px}.ww-hero{padding:20px}.ww-route{height:290px}.ww-stat{padding:14px}.ww-stat-value{font-size:23px}.ww-panel{padding:15px}.ww-panel-head{display:block}.ww-legend{margin-top:8px}}
@media print{.ww-no-print{display:none!important}.ww-page{padding:0!important}.ww-hero,.ww-panel,.ww-stat{break-inside:avoid;box-shadow:none}.ww-route{height:330px}.ww-main{grid-template-columns:1.45fr .72fr}}
`;

const getTier = (score) => RESULT_TIERS.find((tier) => score <= tier.max) || RESULT_TIERS.at(-1);

const getRoast = (game, score) => {
  const pool = score <= 27 ? ROAST_LINES.clean : score <= 64 ? ROAST_LINES.wobbly : ROAST_LINES.chaos;
  const seed = Math.round(score) + Number(game.spin_count || 0) + Number(game.direction_changes || 0);
  return pool[seed % pool.length];
};

const buildCallouts = (game) => {
  const lines = [];
  if (game.spin_count >= 5) lines.push(`${game.spin_count} spins. Your inner ear has submitted a formal complaint.`);
  else lines.push(`${game.spin_count} spin${game.spin_count === 1 ? '' : 's'}: enough chaos to make confidence medically interesting.`);

  if (game.direction_changes >= 5) lines.push(`You changed sides ${game.direction_changes} times. Commitment issues, now available in 4K.`);
  else if (game.direction_changes >= 2) lines.push(`${game.direction_changes} course corrections. Your balance was clearly working from home.`);
  else lines.push('Very few course corrections. Annoyingly mature behaviour.');

  if (game.drift_direction === 'center') lines.push('You finished near centre. Your dignity completed a late comeback.');
  else lines.push(`You drifted ${game.drift_direction}. Apparently that side had better Wi-Fi.`);
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
  const roast = getRoast(game, score);

  return (
    <div className="ww-page max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24" style={{ '--tier': tier.color }}>
      <style>{REPORT_CSS}</style>

      <div className="ww-toolbar ww-no-print">
        <button className="ww-action" onClick={() => navigate('/')}><ArrowLeft size={16} /><span>New round</span></button>
        {isSample && <span className="ww-chip"><Sparkles size={14} /> Sample round</span>}
        <button className="ww-action primary" onClick={() => window.print()}><Download size={16} /><span>Save score</span></button>
      </div>

      <section className="ww-hero">
        <div>
          <p className="ww-kicker"><Trophy size={16} /> {tier.label}</p>
          <h1 className="ww-title">{tier.title}</h1>
          <p className="ww-note">{tier.note}</p>
          <div className="ww-chips">
            <span className="ww-chip"><RotateCw size={14} /> {game.spin_count} spin{game.spin_count === 1 ? '' : 's'}</span>
            <span className="ww-chip"><Footprints size={14} /> {game.walk_duration_seconds}s walk</span>
            <span className="ww-chip"><Sparkles size={14} /> {game.direction_changes} zigzag{game.direction_changes === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="ww-score" aria-label={`Wobble score ${score} out of 100`}>
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle className="track" cx="70" cy="70" r="61" fill="none" strokeWidth="12" />
            <circle className="fill" cx="70" cy="70" r="61" fill="none" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
          </svg>
          <div><div className="ww-score-value">{score}</div><div className="ww-score-label">wobble / 100</div></div>
        </div>
      </section>

      <section className="ww-panel ww-verdict ww-roast-band" style={{ marginTop: 16 }}>
        <div>
          <p className="ww-kicker" style={{ color: '#425028', marginBottom: 10 }}>Roast of the round</p>
          <blockquote>&ldquo;{roast}&rdquo;</blockquote>
        </div>
        <p className="ww-roast-meta">Official verdict after {game.spin_count} spin{game.spin_count === 1 ? '' : 's'} and {game.direction_changes} direction change{game.direction_changes === 1 ? '' : 's'}.</p>
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
              <line className="ww-route-ideal" x1="50" y1="92" x2="50" y2="8" />
              {routePoints && <>
                <polyline className="ww-route-shadow" points={routePoints} vectorEffect="non-scaling-stroke" />
                <polyline className="ww-route-path" points={routePoints} vectorEffect="non-scaling-stroke" />
                <circle cx={game.route[0].x} cy={game.route[0].y} r="2.2" fill="#182126" vectorEffect="non-scaling-stroke" />
                <circle cx={game.route.at(-1).x} cy={game.route.at(-1).y} r="2.8" fill="#d9f46a" stroke="#182126" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </>}
              <text x="55" y="94" fontSize="3.2" fontWeight="800" fill="#617078">START</text>
              <text x="55" y="10" fontSize="3.2" fontWeight="800" fill="#617078">FINISH</text>
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
        <span>Game score only. Keep the lane clear and stop if the player feels dizzy.</span>
      </div>
    </div>
  );
};

export default ReportPage;
