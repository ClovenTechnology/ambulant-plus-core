'use client';
import React, { memo } from 'react';

export function Icon({ name, className = 'w-5 h-5' }: { name: string; className?: string }) {
  const common = {
    className,
    stroke: 'currentColor',
    fill: 'none',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as any;

  switch (name) {
    case 'mic':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 1v11a3 3 0 01-6 0V7" />
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10a7 7 0 01-14 0" />
          <path d="M12 19v4" />
        </svg>
      );
    case 'mic-off':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 9v3a3 3 0 005.12 2.12M15 9V5a3 3 0 00-6 0v1" />
          <path d="M19 10a7 7 0 01-2.05 4.95M5 10a7 7 0 002.05 4.95" />
          <path d="M1 1l22 22" />
        </svg>
      );
    case 'video':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="5" width="13" height="14" rx="2" />
          <path d="M16 8l5-3v14l-5-3z" />
        </svg>
      );
    case 'video-off':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="5" width="13" height="14" rx="2" />
          <path d="M1 1l22 22" />
        </svg>
      );
    case 'heart':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M20.8 4.6a5.5 5.5 0 00-7.78 0L12 5.62 10.98 4.6a5.5 5.5 0 10-7.78 7.78L12 21.2l8.8-8.82a5.5 5.5 0 000-7.78z" />
        </svg>
      );
    case 'cc':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M8 12h4M8 16h6" />
        </svg>
      );
    case 'layers':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 2l9 5-9 5-9-5 9-5z" />
          <path d="M3 12l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </svg>
      );
    case 'rec':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="5" fill="currentColor" />
        </svg>
      );
    case 'xr':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="2" y="6" width="20" height="12" rx="3" />
          <path d="M7 14l2-2 2 2 2-2 2 2" />
        </svg>
      );
    case 'gear':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V22a2 2 0 01-4 0v-.11a1.65 1.65 0 00-1 1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 010-4h.11a1.65 1.65 0 001.51-1z" />
        </svg>
      );
    case 'expand':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      );
    case 'collapse':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5" />
        </svg>
      );
    case 'kbd':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h1M5 14h6M13 14h6" />
        </svg>
      );

    /** NEW: distinct icon for transparent Vitals Overlay on video */
    case 'vitals-overlay':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          {/* HUD frame */}
          <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
          {/* ECG waveform */}
          <path d="M5 12h3l2-4 3 8 2-4h4" />
        </svg>
      );

    default:
      return null;
  }
}

export const IconBtn = memo(function IconBtn({
  title,
  active,
  danger,
  onClick,
  children,
  className,
}: {
  title: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center w-10 h-10 rounded-full border text-[13px] transition-colors duration-200 motion-reduce:transition-none';
  const cls = [
    base,
    active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white/90 hover:bg-white border-gray-300',
    danger ? 'text-red-600 border-red-300 hover:bg-red-50' : '',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
    className || '',
  ].join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={!!active}
    >
      {children}
    </button>
  );
});
