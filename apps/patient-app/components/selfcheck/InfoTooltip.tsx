'use client';

import React, { useState } from 'react';

export default function InfoTooltip({
  children,
  label,
}: {
  children?: React.ReactNode;
  label: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label={label}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200 shadow-sm"
        type="button"
      >
        i
      </button>

      {show && (
        <div
          role="tooltip"
          className="absolute right-0 z-50 w-72 p-3 bg-white text-xs text-slate-700 rounded-xl shadow-lg border border-slate-200 -top-2 translate-x-full"
        >
          {children}
        </div>
      )}
    </div>
  );
}
