//apps/admin-dashboard/components/Tooltip.tsx
'use client';

import { ReactNode, useState } from 'react';

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

export default function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md border bg-gray-900 text-xs text-white px-2 py-1 shadow-md ${
            side === 'top'
              ? 'bottom-full mb-1 left-1/2 -translate-x-1/2'
              : side === 'bottom'
              ? 'top-full mt-1 left-1/2 -translate-x-1/2'
              : side === 'left'
              ? 'right-full mr-1 top-1/2 -translate-y-1/2'
              : 'left-full ml-1 top-1/2 -translate-y-1/2'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
