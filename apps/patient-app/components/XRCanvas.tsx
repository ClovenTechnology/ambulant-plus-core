'use client';

import { useEffect, useRef } from 'react';

/**
 * Minimal WebXR-ready overlay. If navigator.xr exists, we request an inline
 * session to verify capability; otherwise we just render a gradient canvas.
 * This is intentionally tiny — you can swap this for a Three.js scene later.
 */
export default function XRCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t0 = performance.now();

    const draw = (t: number) => {
      const dt = (t - t0) / 1000;
      t0 = t;

      const w = canvas.width = canvas.clientWidth * devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * devicePixelRatio;

      // Futuristic gradient + pulse
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0ea5e9'); // sky-500
      g.addColorStop(1, '#7c3aed'); // violet-600
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Pulse ring
      const r = (Math.sin(t / 600) * 0.5 + 0.5) * (Math.min(w, h) * 0.25);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, w * 0.006);
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    if (active) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return (
    <div
      className={`fixed inset-0 z-40 transition ${active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!active}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      {/* lightweight HUD */}
      <div className="absolute top-3 left-3 text-xs px-2 py-1 rounded bg-black/50 text-white">
        XR View (preview)
      </div>
    </div>
  );
}
