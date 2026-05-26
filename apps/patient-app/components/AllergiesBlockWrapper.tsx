// apps/patient-app/components/AllergiesBlockWrapper.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import AllergiesPanel from './AllergiesPanel';
import type { Allergy } from '@/types';

interface AllergiesBlockWrapperProps {
  allergies?: Allergy[];
}

function normaliseAllergy(item: any, index: number): Allergy | null {
  if (!item || typeof item !== 'object') return null;

  const name = String(
    item.name ?? item.substance ?? item.substanceText ?? item.allergen ?? item.title ?? '',
  ).trim();

  if (!name) return null;

  return {
    ...item,
    id: String(item.id ?? `allergy-${index}`),
    name,
    status: String(item.status ?? item.clinicalStatus ?? 'Active'),
    severity: String(item.severity ?? 'Mild'),
    note: item.note ?? item.notes ?? item.reaction ?? undefined,
  } as Allergy;
}

function readAllergyItems(data: any): Allergy[] {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.allergies)
        ? data.allergies
        : Array.isArray(data?.data)
          ? data.data
          : [];

  return raw
    .map((item: any, index: number) => normaliseAllergy(item, index))
    .filter((item: Allergy | null): item is Allergy => Boolean(item));
}

export default function AllergiesBlockWrapper({ allergies = [] }: AllergiesBlockWrapperProps) {
  const [list, setList] = useState<Allergy[]>(() => readAllergyItems(allergies));
  const [loading, setLoading] = useState(false);

  const fetchAllergies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/allergies', { cache: 'no-store' });
      const data = await res.json().catch(() => null);

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Allergy refresh failed (${res.status})`);
      }

      setList(readAllergyItems(data));
    } catch (err) {
      console.warn('fetchAllergies error', err);
      setList((prev) => prev);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllergies();
  }, [fetchAllergies]);

  const handleExport = useCallback(() => {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'allergies_export', ts: Date.now() }),
    }).catch(() => {});

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
