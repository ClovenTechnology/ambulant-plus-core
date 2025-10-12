// apps/clinician-app/src/hooks/useAutocomplete.ts
'use client';

import { useEffect, useState } from 'react';

export type ICD10Hit = { code: string; title: string; synonyms?: string[] };
export type RxNormHit = { rxcui?: string; name?: string; title?: string; tty?: string };

export function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/**
 * Tiny reusable autocomplete hook with debounced query + graceful errors.
 */
export function useAutocomplete<T>(
  search: (q: string) => Promise<T[]>,
  { min = 2, delay = 250 }: { min?: number; delay?: number } = {},
) {
  const [q, setQ] = useState('');
  const deb = useDebounced(q, delay);
  const [opts, setOpts] = useState<T[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!deb || (typeof deb === 'string' && deb.length < min)) { setOpts([]); return; }
      setBusy(true);
      try {
        const list = await search(String(deb));
        setOpts(Array.isArray(list) ? list : []);
      } catch {
        setOpts([]);
      } finally {
        setBusy(false);
      }
    })();
  }, [deb, min, search]);

  return { q, setQ, opts, busy };
}

/** Client-side ranked ICD-10 search against /api/codes/icd10 */
export async function icdSearch(q: string) {
  const res = await fetch(`/api/codes/icd10?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) return [] as ICD10Hit[];
  const js = await res.json();
  const hits = (js?.results ?? []) as ICD10Hit[];
  const s = q.toLowerCase();
  hits.sort((a, b) => {
    const ax = `${a.code} ${a.title}`.toLowerCase();
    const bx = `${b.code} ${b.title}`.toLowerCase();
    const ap = ax.startsWith(s) ? 0 : ax.includes(s) ? 1 : 2;
    const bp = bx.startsWith(s) ? 0 : bx.includes(s) ? 1 : 2;
    return ap - bp;
  });
  return hits.slice(0, 20);
}

/** RxNorm search against /api/codes/rxnorm (normalized name) */
export async function rxnormSearch(q: string) {
  const res = await fetch(`/api/codes/rxnorm?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) return [] as RxNormHit[];
  const js = await res.json();
  const hits = (js?.results ?? []) as RxNormHit[];
  return hits
    .filter((x) => !!(x.name || x.title))
    .map((x) => ({ ...x, name: x.name || x.title })) // normalize
    .slice(0, 25);
}
