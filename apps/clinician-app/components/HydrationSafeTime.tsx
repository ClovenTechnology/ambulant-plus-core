'use client';
import React, { useEffect, useState } from 'react';

/**
 * Renders a time string without hydration mismatch by formatting on the client.
 * - kind="datetime" | "time" (default: "datetime")
 */
export function HydrationSafeTime({
  value,
  kind = 'datetime',
  className,
}: {
  value: string | number | Date | undefined | null;
  kind?: 'datetime' | 'time';
  className?: string;
}) {
  const [txt, setTxt] = useState('');

  useEffect(() => {
    if (!value) { setTxt(''); return; }
    const d = typeof value === 'number' ? new Date(value) : new Date(value);
    setTxt(kind === 'time' ? d.toLocaleTimeString() : d.toLocaleString());
  }, [value, kind]);

  return <span className={className} suppressHydrationWarning>{txt}</span>;
}
