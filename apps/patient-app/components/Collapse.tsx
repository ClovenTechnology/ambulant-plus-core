// components/Collapse.tsx
import React from 'react';

export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return <div className={`pt-2 ${className || ''}`}>{children}</div>;
}
