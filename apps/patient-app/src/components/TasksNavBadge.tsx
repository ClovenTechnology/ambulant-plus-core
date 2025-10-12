'use client';
import React, { useEffect, useState, useRef } from 'react';

type Task = { id: string; text: string; due: string; done: boolean };

export default function TasksNavBadge() {
  const [openCount, setOpenCount] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      const data: Task[] = await res.json();
      setOpenCount(data.filter(t => !t.done).length);
    } catch {
      // fail silently: badge just won’t show
    }
  }

  useEffect(() => {
    // initial
    load();

    // refresh on interval
    timerRef.current = window.setInterval(load, 20_000);

    // refresh on tab focus/visibility
    const onVis = () => document.visibilityState === 'visible' && load();
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, []);

  if (!openCount) return null;

  return (
    <span
      aria-label={`${openCount} open tasks`}
      className="ml-1 inline-flex items-center justify-center text-[11px] leading-none rounded-full px-2 py-[2px] bg-gray-900 text-white"
    >
      {openCount}
    </span>
  );
}
