import React from 'react';

type MoodGaugeProps = { level: number }; // 0–100
export default function MoodGauge({ level }: MoodGaugeProps) {
  const color = level > 70 ? 'bg-green-400' : level > 40 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="w-full p-4">
      <span className="text-sm font-semibold">Energy / Mood</span>
      <div className="w-full h-4 bg-white/20 rounded-full mt-2">
        <div className={`${color} h-4 rounded-full`} style={{ width: `${level}%` }} />
      </div>
    </div>
  );
}
