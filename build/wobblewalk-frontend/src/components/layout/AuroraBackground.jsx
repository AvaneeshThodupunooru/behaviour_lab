import React from 'react';

// Living backdrop for THE THING: drifting blurred blobs over the void, a dot
// grid, and a few twinkling stars. Pure CSS animation, fixed behind all
// content (z-0).
const AuroraBackground = () => (
  <div className="aurora-bg fixed inset-0 -z-0 overflow-hidden pointer-events-none" aria-hidden="true">
    {/* base wash */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#1a1136] via-[#120b26] to-[#0d0720]" />

    {/* panning dot grid */}
    <div
      className="absolute inset-0 opacity-60"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,244,228,0.10) 1.5px, transparent 1.6px)',
        backgroundSize: '22px 22px',
        animation: 'grid-pan 8s linear infinite',
        maskImage: 'radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 78%)',
      }}
    />

    {/* drifting blobs */}
    <div
      className="absolute -top-32 -left-24 w-[42rem] h-[42rem] rounded-full blur-3xl"
      style={{ background: 'radial-gradient(circle, rgba(52,33,99,0.95), transparent 62%)', animation: 'aurora-1 22s ease-in-out infinite' }}
    />
    <div
      className="absolute top-1/3 -right-32 w-[38rem] h-[38rem] rounded-full blur-3xl"
      style={{ background: 'radial-gradient(circle, rgba(255,77,141,0.26), transparent 62%)', animation: 'aurora-2 26s ease-in-out infinite' }}
    />
    <div
      className="absolute bottom-0 left-1/4 w-[34rem] h-[34rem] rounded-full blur-3xl"
      style={{ background: 'radial-gradient(circle, rgba(183,156,255,0.20), transparent 62%)', animation: 'aurora-3 30s ease-in-out infinite' }}
    />

    {/* twinkling stars */}
    {[
      { top: '14%', left: '11%', size: 10, delay: '0s', color: '#ffd23f' },
      { top: '26%', left: '82%', size: 8, delay: '0.7s', color: '#b79cff' },
      { top: '58%', left: '18%', size: 7, delay: '1.4s', color: '#3fe0a0' },
      { top: '72%', left: '73%', size: 11, delay: '0.4s', color: '#4cc9f0' },
      { top: '42%', left: '48%', size: 7, delay: '1.9s', color: '#ff8a3d' },
    ].map((star) => (
      <span
        key={`${star.top}-${star.left}`}
        className="absolute animate-twinkle"
        style={{ top: star.top, left: star.left, animationDelay: star.delay }}
      >
        <svg width={star.size} height={star.size} viewBox="0 0 24 24" fill={star.color} aria-hidden="true">
          <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6Z" />
        </svg>
      </span>
    ))}

    {/* vignette */}
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% -10%, transparent 55%, rgba(9,5,20,0.55) 100%)' }} />
  </div>
);

export default AuroraBackground;
