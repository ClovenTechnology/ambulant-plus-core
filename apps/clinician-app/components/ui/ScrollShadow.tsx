'use client';
import React, { useEffect, useRef, useState } from 'react';

export function ScrollShadow({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState(false);
  const [bot, setBot] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const upd = () => {
      setTop(el.scrollTop > 2);
      setBot(el.scrollHeight - el.clientHeight - el.scrollTop > 2);
    };
    upd();

    el.addEventListener('scroll', upd, { passive: true });
    const ro = new ResizeObserver(upd);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', upd);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`relative ${className || ''}`}>
      <div ref={ref} className="overflow-auto max-h-[calc(100vh-220px)]">
        {children}
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/5 to-transparent transition-opacity ${
          top ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/5 to-transparent transition-opacity ${
          bot ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
