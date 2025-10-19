// components/CollapseBtn.tsx
'use client';
import React from 'react';

type Props = { open: boolean; onClick: () => void; className?: string; titleOpen?: string; titleClosed?: string; };
export function CollapseBtn({ open, onClick, className, titleOpen = 'Collapse', titleClosed = 'Expand' }: Props) {
  return (
    <button
      className={`text-xs px-2 py-1 border rounded ${open ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'} ${className||''}`}
      onClick={onClick}
      aria-expanded={open}
      title={open ? titleOpen : titleClosed}
      aria-label={open ? titleOpen : titleClosed}
      type="button"
    >
      {open ? titleOpen : titleClosed}
    </button>
  );
}
