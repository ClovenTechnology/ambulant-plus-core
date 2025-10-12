import React from "react";

export default function BatteryIcon({ level = 63 }: { level?: number }) {
  const pct = Math.max(0, Math.min(100, level));
  const color =
    pct < 15 ? "fill-red-500" :
    pct < 35 ? "fill-amber-500" :
    "fill-emerald-500";
  return (
    <div className="flex items-center gap-2 text-sm">
      <svg width="28" height="16" viewBox="0 0 28 16" className="shrink-0">
        <rect x="1" y="3" width="22" height="10" rx="2" className="fill-slate-200 dark:fill-slate-700"/>
        <rect x="1" y="3" width={(22 * pct) / 100} height="10" rx="2" className={color}/>
        <rect x="24" y="6" width="3" height="4" rx="1" className="fill-slate-400 dark:fill-slate-600"/>
      </svg>
      <span className="tabular-nums">{pct}%</span>
    </div>
  );
}
