'use client';

import { useEffect, useState } from 'react';

/**
 * Named export (preferred) + default export (back-compat).
 * This prevents "default is not a function" and other import-shape mismatches.
 */
export function useNow(intervalMs: number = 1000) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), Math.max(250, intervalMs | 0));
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

// Back-compat default export
export default useNow;
