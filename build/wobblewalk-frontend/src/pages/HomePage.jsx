import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  RefreshCw,
  Route,
  Sparkles,
  Trophy,
} from 'lucide-react';

import VideoRecorder from '../components/record/VideoRecorder.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Reveal from '../components/common/Reveal.jsx';
import { analyzeRound } from '../api/analyzeApi.js';
import { getEventParams, submitWobbleWalkResult } from '../api/eventSession.js';
import { useTiltSpotlight } from '../hooks/useInteractions.js';

const FEATURES = [
  { icon: Route, title: 'Route replay', body: 'See the walk plotted against the straight path, detours and all.' },
  { icon: Gauge, title: 'Wobble score', body: 'Lateral drift, path efficiency, and course corrections become one score.' },
  { icon: Trophy, title: 'Consistency tiers', body: 'From Highly Consistent to Very High Variability, every route gets a plain-language result.' },
];

const MARQUEE = [
  'Walk', 'Wobble score', 'Route replay',
  'Biggest detour', 'Path efficiency', 'Course corrections',
];

const TILE_COLORS = ['bg-sky', 'bg-zap', 'bg-mint'];

const FeatureCard = ({ icon, title, body, delay, index }) => {
  const { ref, onMouseMove, onMouseLeave } = useTiltSpotlight(5);
  return (
    <Reveal delay={delay}>
      <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} className="group glow-card spotlight tilt surface h-full rounded-lg p-7">
        <div className="mb-6 flex items-center justify-between">
          <div className={`grid h-12 w-12 place-items-center rounded-md border-[3px] border-ink-900 text-ink-900 shadow-soft ${TILE_COLORS[index % TILE_COLORS.length]}`}>{React.createElement(icon, { className: 'h-5 w-5' })}</div>
          <ArrowUpRight className="h-5 w-5 text-ink-400 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-600" />
        </div>
        <h3 className="mb-2 font-display text-xl font-extrabold text-ink-900">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-500">{body}</p>
      </div>
    </Reveal>
  );
};

const HomePage = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const eventParams = getEventParams();

  const handleFileUpload = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setIsProcessing(true);
    setError(null);
    try {
      // spin_count is a legacy field on the analysis API that no longer
      // affects scoring (no spin requirement for this event) - passed as
      // a fixed value so the existing backend contract is left untouched.
      const results = await analyzeRound(selectedFile, 1);
      if (eventParams.sessionId) {
        // Best-effort: the participant's score is already computed and
        // will be shown on the report page either way, so a submission
        // failure here doesn't block the flow - it just means this
        // result won't appear in the event's final report.
        submitWobbleWalkResult(eventParams.sessionId, results.game_metrics, eventParams.apiBase)
          .then((outcome) => {
            if (!outcome.ok) console.warn('WobbleWalk: could not submit result to event server:', outcome.error);
          });
      }
      navigate('/report', { state: { report: results } });
    } catch (err) {
      setError(err.message || 'The round could not be scored.');
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 animate-fade-in">
        <Spinner text="Tracking the route and calculating wobble..." />
        <div className="surface mt-10 max-w-md rounded-lg px-6 py-4 text-center">
          <p className="text-sm text-ink-600">Scoring <span className="font-extrabold text-ink-900">{file?.name}</span></p>
          <p className="mt-1.5 text-xs text-ink-500">Finding the straight path, detours, and course corrections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative overflow-hidden pb-10 pt-14 text-center sm:pt-20">
        <svg className="pointer-events-none absolute left-1/2 top-2 h-[360px] w-[760px] max-w-none -translate-x-1/2 opacity-25" viewBox="0 0 760 360" fill="none" aria-hidden="true">
          <path d="M380 350C315 300 452 264 374 215C301 170 451 127 380 18" stroke="#fff4e4" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 12" opacity="0.5" />
          <path d="M380 350V18" stroke="#ffd23f" strokeWidth="2" />
        </svg>
        <div className="chip shine relative mb-6 inline-flex items-center gap-2 animate-fade-up">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Walk a straight line. See how you did.
        </div>
        <h1
          className="relative font-display text-5xl font-extrabold leading-[.98] text-cream animate-fade-up sm:text-6xl lg:text-7xl"
          style={{ animationDelay: '60ms', textShadow: '0 6px 0 rgba(18,11,38,0.55)' }}
        >
          WobbleWalk
          <br className="hidden sm:block" />
          <span className="gradient-text"> How straight can you go?</span>
        </h1>
        <p className="relative mx-auto mt-6 max-w-2xl text-lg text-cream/70 animate-fade-up" style={{ animationDelay: '120ms' }}>
          Record the walk and let the route decide how consistent your line was.
        </p>
      </section>

      <section className="animate-fade-up" style={{ animationDelay: '180ms' }}>
        {error && (
          <div className="mx-auto mb-6 flex max-w-2xl items-center gap-3 rounded-lg border-[3px] border-ink-900 bg-punch px-4 py-3 shadow-soft">
            <AlertTriangle className="h-5 w-5 shrink-0 text-cream" />
            <p className="text-sm font-bold text-cream">{error}</p>
            {/* The recording is still in memory, so a failed upload can be sent
                again without making the participant walk the lane a second time. */}
            {file && file.size > 0 && (
              <button
                onClick={() => handleFileUpload(file)}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border-[3px] border-ink-900 bg-zap px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-900 shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Send again
              </button>
            )}
          </div>
        )}

        {/* The recorder hands back a File, exactly like the old dropzone did,
            so everything downstream (analyzeRound -> /api/analyze) is unchanged. */}
        <VideoRecorder onRecordingComplete={handleFileUpload} isLoading={isProcessing} />
        <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-cream/55">Clear the lane and keep a spotter nearby.</p>
      </section>

      <div className="marquee mt-16 py-3">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center gap-3 px-6 font-display text-sm font-extrabold uppercase tracking-[0.14em] text-cream">
              <span className="h-2 w-2 rounded-full border-2 border-ink-900 bg-zap" />{item}
            </span>
          ))}
        </div>
      </div>

      <section className="perspective mt-20 pb-24">
        <Reveal className="mb-8 flex items-end justify-between">
          <div><p className="eyebrow mb-3">The scorecard</p><h2 className="font-display text-3xl font-extrabold text-cream">Every wobble gets receipts</h2></div>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon, title, body }, index) => <FeatureCard key={title} icon={icon} title={title} body={body} delay={index * 110} index={index} />)}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
