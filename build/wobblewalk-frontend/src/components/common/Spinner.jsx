import React from 'react';
import BrandMark from './BrandMark.jsx';

export default function Spinner({ text = 'Analyzing skeletal data…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-7">
      <div className="relative grid place-items-center h-28 w-28">
        {/* expanding rings */}
        <span className="absolute h-20 w-20 rounded-full border-[3px] border-punch/50" style={{ animation: 'pulse-ring 1.8s cubic-bezier(0.22,1,0.36,1) infinite' }} />
        <span className="absolute h-20 w-20 rounded-full border-[3px] border-mint/50" style={{ animation: 'pulse-ring 1.8s cubic-bezier(0.22,1,0.36,1) infinite', animationDelay: '0.6s' }} />

        {/* rotating conic ring */}
        <span
          className="absolute h-24 w-24 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, #3fe0a0 120deg, #ff4d8d 300deg, transparent 360deg)',
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            animation: 'spin-slow 1.4s linear infinite',
          }}
        />

        {/* orbiting dot */}
        <span className="absolute h-24 w-24" style={{ animation: 'spin-rev 3s linear infinite' }}>
          <span className="absolute -top-1 left-1/2 -ml-1.5 h-3 w-3 rounded-full border-2 border-ink-900 bg-zap" />
        </span>

        {/* core */}
        <div className="relative grid place-items-center h-14 w-14 rounded-xl border-[3px] border-ink-900 bg-void-800 shadow-soft">
          <BrandMark className="relative w-8 h-8" />
        </div>
      </div>
      <p className="font-display text-base font-extrabold tracking-tight">
        <span className="gradient-text">{text}</span>
      </p>
    </div>
  );
}
