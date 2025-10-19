// apps/patient-app/components/AllergiesBlockWrapper.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AllergiesPanel from './AllergiesPanel';
import type { Allergy } from '@/types';

interface AllergiesBlockWrapperProps {
  allergies?: Allergy[]; // optional initial seed
}

export default function AllergiesBlockWrapper({ allergies = [] }: AllergiesBlockWrapperProps) {
  const [list, setList] = useState<Allergy[]>(() => Array.isArray(allergies) ? allergies : []);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllergies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/allergies', { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text().catch(() => 'Failed to load');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => null);
      // Accept both `{ allergies: [...] }` or `[...]`
      const items: Allergy[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.allergies)
        ? data.allergies
        : [];
      // Defensive filtering
      const safe = items.filter((a: any) => a && typeof a === 'object' && a.name);
      setList(safe);
    } catch (err: any) {
      console.warn('fetchAllergies error', err);
      setError(String(err?.message ?? err ?? 'Unknown'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // if initial list empty, fetch; otherwise keep seed but still refresh in background
    if (list.length === 0) {
      fetchAllergies();
    } else {
      // background refresh but don't block initial render
      fetchAllergies().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = useCallback(() => {
    // For now: simply open a printable view or call an export API
    // This is a no-op that could later POST to clinician export endpoint.
    // Keep consistent analytics call:
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'allergies_export', ts: Date.now() }),
    }).catch(() => {});
    // fallback UX: instruct user to use print page
    window.location.href = '/allergies/print';
  }, []);

  return (
    <AllergiesPanel
      allergies={list}
      loading={loading}
      onRefresh={fetchAllergies}
      onExport={handleExport}
    />
  );
}
