import React, { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import BrandMark from '../common/BrandMark.jsx';
import AuroraBackground from './AuroraBackground.jsx';

const Layout = ({ children }) => {
  const { pathname } = useLocation();
  const onReport = pathname.startsWith('/report');
  const glowRef = useRef(null);

  useEffect(() => {
    const move = (event) => {
      if (glowRef.current) glowRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col">
      <AuroraBackground />
      <div ref={glowRef} className="cursor-glow" style={{ transform: 'translate(-100px,-100px)' }} />
      <div className="grain-overlay" />

      <header className="app-header sticky top-0 z-30">
        <div className="absolute inset-0 border-b-4 border-ink-900 bg-void-900" />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110"><BrandMark className="h-9 w-9" /></span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-[0.12em] text-cream">THE <span className="gradient-text">THING</span></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-cream/55">WobbleWalk</span>
            </span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
            <NavLink to="/" end className={({ isActive }) => `px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] ${isActive ? 'text-zap' : 'text-cream/60 hover:text-cream'}`}>Play</NavLink>
          </nav>

          <span className="chip">
            {onReport ? <><Trophy className="h-3.5 w-3.5 text-brand-600" /> Results</> : <><span className="h-2 w-2 rounded-full border-2 border-ink-900 bg-mint" /> Camera ready</>}
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="app-footer relative z-10 mt-auto border-t-4 border-ink-900 bg-void-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-cream/55 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2"><BrandMark className="h-6 w-6" /><span>THE THING — the straight-line challenge.</span></div>
          <div className="flex items-center gap-5"><span>Game score only</span><span className="text-cream/30">/</span><span>&copy; {new Date().getFullYear()}</span></div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
