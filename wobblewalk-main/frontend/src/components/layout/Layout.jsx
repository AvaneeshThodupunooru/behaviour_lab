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
        <div className="absolute inset-0 border-b border-white/40 bg-paper/60 shadow-[0_1px_0_0_rgba(255,255,255,0.5)_inset] backdrop-blur-xl" />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="transition-transform duration-300 group-hover:-rotate-6"><BrandMark className="h-8 w-8" /></span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-semibold text-ink-900">Wobble<span className="gradient-text">Walk</span></span>
              <span className="text-[10px] font-medium uppercase text-ink-400">Spin. Step. Score.</span>
            </span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
            <NavLink to="/" end className={({ isActive }) => `px-3 py-1.5 text-sm font-semibold ${isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900'}`}>Play</NavLink>
          </nav>

          <span className="chip">
            {onReport ? <><Trophy className="h-3.5 w-3.5 text-brand-600" /> Results</> : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Camera ready</>}
          </span>
        </div>
      </header>

      <main className="relative z-10 flex-1">{children}</main>

      <footer className="app-footer relative z-10 mt-auto border-t border-white/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-ink-400 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2"><BrandMark className="h-5 w-5" /><span>WobbleWalk - the straight-line challenge.</span></div>
          <div className="flex items-center gap-5"><span>Game score only</span><span className="text-ink-300">/</span><span>&copy; {new Date().getFullYear()}</span></div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
