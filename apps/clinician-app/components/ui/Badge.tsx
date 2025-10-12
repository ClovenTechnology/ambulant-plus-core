import React, { memo } from 'react';

export const Badge = memo(function Badge({
  label,
  active,
  color,
  className,
}: {
  label: string;
  active: boolean;
  color: 'emerald' | 'indigo' | 'sky' | 'red' | 'gray';
  className?: string;
}) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium transition-opacity duration-300';
  const map: Record<typeof color, string> = {
    emerald: 'bg-emerald-600 text-white',
    indigo: 'bg-indigo-600 text-white',
    sky: 'bg-sky-600 text-white',
    red: 'bg-red-600 text-white',
    gray: 'bg-gray-900 text-white',
  };
  const inactive = 'bg-gray-700 text-gray-200 opacity-70';
  return <span className={`${base} ${active ? map[color] : inactive} ${className || ''}`}>{label}</span>;
});
