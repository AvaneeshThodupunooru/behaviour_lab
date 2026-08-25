import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  Minus,
  Plus,
  RotateCw,
  Route,
  Sparkles,
  Trophy,
} from 'lucide-react';

import VideoDropzone from '../components/upload/VideoDropzone.jsx';
import Spinner from '../components/common/Spinner.jsx';
import Reveal from '../components/common/Reveal.jsx';
import { analyzeRound } from '../api/analyzeApi.js';
import { useTiltSpotlight } from '../hooks/useInteractions.js';

const FEATURES = [
  { icon: Route, title: 'Route replay', body: 'See the walk plotted against the straight path, detours and all.' },
  { icon: Gauge, title: 'Wobble score', body: 'Lateral drift, path efficiency, and course corrections become one score.' },
  { icon: Trophy, title: 'Funny verdicts', body: 'From Human Ruler to Side Quest Specialist, every route earns a title.' },
];

const MARQUEE = [
  'Spin', 'Walk', 'Wobble score', 'Route replay',
  'Biggest detour', 'Path efficiency', 'Course corrections', 'Funny verdict',
];

const FeatureCard = ({ icon, title, body, delay }) => {
  const { ref, onMouseMove, onMouseLeave } = useTiltSpotlight(5);
  return (
    <Reveal delay={delay}>
      <div ref={ref} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} className="group glow-card spotlight tilt surface h-full rounded-lg p-7">
        <div className="mb-6 flex items-center justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-ink-900 text-white">{React.createElement(icon, { className: 'h-5 w-5' })}</div>
          <ArrowUpRight className="h-5 w-5 text-ink-300 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-600" />
        </div>
        <h3 className="mb-2 font-display text-xl font-medium text-ink-900">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-500">{body}</p>
      </div>
    </Reveal>
  );
};

const HomePage = () => {
  const [file, setFile] = useState(null);
  const [spinCount, setSpinCount] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileUpload = async (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setIsProcessing(true);
    setError(null);
    try {
      const results = await analyzeRound(selectedFile, spinCount);
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
          <p className="text-sm text-ink-700">Scoring <span className="font-semibold text-ink-900">{file?.name}</span></p>
          <p className="mt-1.5 text-xs text-ink-400">Finding the straight path, detours, and course corrections.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative overflow-hidden pb-10 pt-14 text-center sm:pt-20">
        <svg className="pointer-events-none absolute left-1/2 top-2 h-[360px] w-[760px] max-w-none -translate-x-1/2 opacity-[0.08]" viewBox="0 0 760 360" fill="none" aria-hidden="true">
          <path d="M380 350C315 300 452 264 374 215C301 170 451 127 380 18" stroke="#182126" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 12" />
          <path d="M380 350V18" stroke="#5f49d9" strokeWidth="2" />
        </svg>
        <div className="chip shine relative mb-6 inline-flex items-center gap-2 animate-fade-up">
          <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Spin. Walk. Try not to take a side quest.
        </div>
        <h1 className="relative font-display text-5xl font-medium leading-[.98] text-ink-900 animate-fade-up sm:text-6xl lg:text-7xl" style={{ animationDelay: '60ms' }}>
          WobbleWalk
          <br className="hidden sm:block" />
          <span className="gradient-text italic"> How straight can you go?</span>
        </h1>
        <p className="relative mx-auto mt-6 max-w-2xl text-lg text-ink-500 animate-fade-up" style={{ animationDelay: '120ms' }}>
          Pick the spins, record the walk, and let the route decide whether you are a Human Ruler or a certified Side Quest Specialist.
        </p>
      </section>

      <section className="animate-fade-up" style={{ animationDelay: '180ms' }}>
        {error && (
          <div className="mx-auto mb-6 flex max-w-2xl items-center gap-3 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 shadow-soft">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        <div className="mb-5 flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-4 rounded-lg border border-white/70 bg-white/70 px-4 py-3 shadow-soft backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-700"><RotateCw className="h-4 w-4 text-brand-600" /> Spins</div>
            <div className="inline-flex items-center gap-1">
              <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-ink-900/10 bg-white text-ink-700 disabled:opacity-35" onClick={() => setSpinCount((count) => Math.max(1, count - 1))} disabled={spinCount === 1} aria-label="Decrease spins"><Minus className="h-4 w-4" /></button>
              <output className="w-12 text-center font-mono text-xl font-bold text-ink-900" aria-live="polite">{spinCount}</output>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-ink-900/10 bg-white text-ink-700 disabled:opacity-35" onClick={() => setSpinCount((count) => Math.min(12, count + 1))} disabled={spinCount === 12} aria-label="Increase spins"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <VideoDropzone onFileSelect={handleFileUpload} />
        <p className="mt-4 text-center text-xs text-ink-400">Clear the lane, keep a spotter nearby, and stop if the player feels dizzy.</p>
      </section>

      <div className="marquee mt-16 border-y border-white/50 py-3">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center gap-3 px-6 text-sm font-medium text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500/70" />{item}
            </span>
          ))}
        </div>
      </div>

      <section className="perspective mt-20 pb-24">
        <Reveal className="mb-8 flex items-end justify-between">
          <div><p className="eyebrow mb-2">The scorecard</p><h2 className="font-display text-3xl font-medium text-ink-900">Every wobble gets receipts</h2></div>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon, title, body }, index) => <FeatureCard key={title} icon={icon} title={title} body={body} delay={index * 110} />)}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
