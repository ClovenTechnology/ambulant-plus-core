// apps/patient-app/hooks/useMergedPills.ts
'use client';

import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Pill } from '@/types';

interface UseMergedPillsResult {
  pills: Pill[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// Example: manual pills could come from localStorage or /self-check API
function loadManualPills(): Pill[] {
  const raw = localStorage.getItem('ambulant.manualPills');
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as Partial<Pill>[];
    return arr.map(p => ({
      id: p.id ?? uuidv4(),
      name: p.name ?? 'Unknown',
      dose: p.dose ?? '',
      time: p.time ?? '',
      status: p.status ?? 'Pending',
    }));
  } catch {
    return [];
  }
}

export function useMergedPills(): UseMergedPillsResult {
  const [pills, setPills] = useState<Pill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPills = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch eRx pills
      const res = await fetch('/api/medications');
      if (!res.ok) throw new Error('Failed to load eRx medications');
      const erxMeds = await res.json() as any[];

      // Map eRx meds to Pill type
      const erxPills: Pill[] = erxMeds.map(m => ({
        id: m.id,
        name: m.name,
        dose: m.dose,
        time: m.frequency ?? '', // can map frequency -> time if needed
        status: m.status === 'Active' ? 'Pending' : 'Taken',
      }));

      // Load manual pills
      const manualPills = loadManualPills();

      // Merge and deduplicate by id
      const mergedMap = new Map<string, Pill>();
      [...erxPills, ...manualPills].forEach(p => mergedMap.set(p.id, p));

      setPills(Array.from(mergedMap.values()));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPills();
  }, []);

  return { pills, loading, error, refresh: fetchPills };
}
