// apps/patient-app/hooks/useMergedPills.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Pill } from '@/types';

interface UseMergedPillsResult {
  pills: Pill[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

type UnknownMedicationRecord = Record<string, unknown>;

const MANUAL_PILLS_STORAGE_KEY = 'ambulant.manualPills';

function createPillId(prefix = 'pill'): string {
  const cryptoId =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : '';

  return cryptoId || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normaliseStatus(value: unknown): Pill['status'] {
  if (value === 'Taken' || value === 'Missed' || value === 'Pending') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase();

    if (lower === 'taken' || lower === 'completed') return 'Taken';
    if (lower === 'missed') return 'Missed';
  }

  return 'Pending';
}

function normaliseManualPill(value: Partial<Pill>, index: number): Pill {
  return {
    id: value.id ?? createPillId(`manual-pill-${index}`),
    name: value.name?.trim() || 'Unknown medication',
    dose: value.dose ?? '',
    time: value.time ?? '',
    status: normaliseStatus(value.status),
    frequency: value.frequency,
    route: value.route,
    started: value.started,
    lastFilled: value.lastFilled,
  };
}

function normaliseMedication(value: UnknownMedicationRecord, index: number): Pill {
  const id = toStringValue(value.id) || createPillId(`erx-pill-${index}`);

  const name =
    toStringValue(value.name) ||
    toStringValue(value.medicationName) ||
    toStringValue(value.drugName) ||
    'Unknown medication';

  const dose =
    toStringValue(value.dose) ||
    toStringValue(value.dosage) ||
    toStringValue(value.strength);

  const frequency = toStringValue(value.frequency);
  const time = toStringValue(value.time) || frequency;

  return {
    id,
    name,
    dose,
    time,
    status: normaliseStatus(value.status),
    frequency,
    route: toStringValue(value.route) || undefined,
    started: toStringValue(value.started) || toStringValue(value.startedAt) || undefined,
    lastFilled: toStringValue(value.lastFilled) || toStringValue(value.lastFilledAt) || undefined,
  };
}

function loadManualPills(): Pill[] {
  if (typeof window === 'undefined') return [];

  const raw = window.localStorage.getItem(MANUAL_PILLS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) =>
      normaliseManualPill((item ?? {}) as Partial<Pill>, index)
    );
  } catch {
    return [];
  }
}

function normaliseMedicationResponse(payload: unknown): Pill[] {
  if (Array.isArray(payload)) {
    return payload.map((item, index) =>
      normaliseMedication((item ?? {}) as UnknownMedicationRecord, index)
    );
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { medications?: unknown }).medications)
  ) {
    return (payload as { medications: unknown[] }).medications.map((item, index) =>
      normaliseMedication((item ?? {}) as UnknownMedicationRecord, index)
    );
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: unknown[] }).data.map((item, index) =>
      normaliseMedication((item ?? {}) as UnknownMedicationRecord, index)
    );
  }

  return [];
}

function mergePills(erxPills: Pill[], manualPills: Pill[]): Pill[] {
  const mergedMap = new Map<string, Pill>();

  for (const pill of erxPills) {
    mergedMap.set(pill.id, pill);
  }

  for (const pill of manualPills) {
    mergedMap.set(pill.id, pill);
  }

  return Array.from(mergedMap.values());
}

export function useMergedPills(): UseMergedPillsResult {
  const [pills, setPills] = useState<Pill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPills = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/medications', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load medications');
      }

      const payload: unknown = await res.json().catch(() => []);
      const erxPills = normaliseMedicationResponse(payload);
      const manualPills = loadManualPills();

      setPills(mergePills(erxPills, manualPills));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load medications';

      console.error('[useMergedPills]', err);
      setError(message);

      // Keep manual pills visible even if the API gateway is temporarily unavailable.
      setPills(loadManualPills());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPills();
  }, [fetchPills]);

  return {
    pills,
    loading,
    error,
    refresh: fetchPills,
  };
}