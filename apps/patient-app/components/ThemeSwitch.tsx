'use client';
import { useEffect, useState } from 'react';

export default function ThemeSwitch() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' && localStorage.getItem('theme')) as
      | 'light'
      | 'dark'
      | null;
    const initial = saved ?? 'dark';
    document.documentElement.setAttribute('data-theme', initial);
    setMode(initial);
  }, []);

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    setMode(next);
  }

  return (
    <button
      onClick={toggle}
      className="glass rounded-full px-3 py-1 text-xs font-medium hover:opacity-90 transition"
      aria-label="Toggle color theme"
      title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
    >
      {mode === 'dark' ? '🌞 Light' : '🌙 Dark'}
    </button>
  );
}
