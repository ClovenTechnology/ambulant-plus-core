import React from 'react';

export function Collapse({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
        open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      } ${className || ''}`}
      aria-hidden={!open}
    >
      <div className="pt-2">{children}</div>
    </div>
  );
}
