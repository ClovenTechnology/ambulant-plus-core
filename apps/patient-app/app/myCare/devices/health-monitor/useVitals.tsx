'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { emitVital as emitVitalApi, type VitalsType } from '@/src/lib/vitals';

export type VitalsEmitInput = {
  type: VitalsType;
  payload: any;
  deviceId?: string;
  recorded_at?: string;
  meta?: Record<string, any>;
  dedupeKey?: string;
};

export type PatientProfile = {
  patientId: string;
  userId?: string | null;
  name: string;
  age?: number | null;
  gender?: string | null;
  avatarUrl?: string | null;
  chronicConditions?: string[] | null;
  primaryConditionsText?: string | null;
};

type AuthMeResponse = {
  ok?: boolean;
  user?: {
    id?: string | null;
    actorType?: string | null;
    actorRefId?: string | null;
    sid?: string | null;
    orgId?: string | null;
  } | null;
};

export type VitalsSummary = {
  lastSyncHuman?: string;

  hrNow?: number;
  spo2Now?: number;
  bpNow?: { s: number; d: number } | null;
  tempNow?: number;
  gluNow?: number | null;
  gluUnit?: 'mg/dL' | 'mmol/L' | null;

  hrTs?: string | null;
  spo2Ts?: string | null;
  bpTs?: string | null;
  tempTs?: string | null;
  gluTs?: string | null;

  hr24?: number[];
  spo224?: number[];
  bp24?: number[];
  temp24?: number[];
  glu24?: number[];
};

export type VitalsContextType = {
  patientId: string | null;
  roomId: string | null;
  profile: PatientProfile | null;
  vitalsSummary: VitalsSummary | null;
  loadingProfile: boolean;
  refreshOverview: () => Promise<void>;
  emitVital: (opts: VitalsEmitInput) => Promise<void>;
};

export const VitalsContext = createContext<VitalsContextType | null>(null);

async function getJSON<T>(
  url: string,
  {
    timeoutMs = 5000,
    fallback,
  }: { timeoutMs?: number; fallback: T },
): Promise<T> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: ac.signal,
      credentials: 'include',
    });

    if (!res.ok) return fallback;

    const data = (await res.json()) as T;
    return data ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(to);
  }
}

function normalizePatientProfile(value: any): PatientProfile | null {
  if (!value || value.ok === false) return null;

  const candidate =
    value.profile && typeof value.profile === 'object'
      ? value.profile
      : value.patient && typeof value.patient === 'object'
        ? value.patient
        : value;

  const patientId = String(
    candidate.patientId ||
      candidate.actorRefId ||
      candidate.id ||
      '',
  ).trim();

  if (!patientId) return null;

  return {
    patientId,
    userId: candidate.userId ? String(candidate.userId) : null,
    name: String(candidate.name || candidate.fullName || candidate.displayName || 'Patient'),
    age: typeof candidate.age === 'number' ? candidate.age : null,
    gender: candidate.gender ?? null,
    avatarUrl: candidate.avatarUrl ?? null,
    chronicConditions: Array.isArray(candidate.chronicConditions)
      ? candidate.chronicConditions
      : [],
    primaryConditionsText: candidate.primaryConditionsText ?? null,
  };
}

function normalizeAuthMeAsPatient(value: AuthMeResponse | null): PatientProfile | null {
  if (!value?.ok || !value.user) return null;

  const actorType = String(value.user.actorType || '').toLowerCase();
  const userId = value.user.id ? String(value.user.id) : '';

  const patientId =
    actorType === 'patient' && value.user.actorRefId
      ? String(value.user.actorRefId)
      : '';

  if (!patientId) return null;

  return {
    patientId,
    userId: userId || null,
    name: 'Patient',
    age: null,
    gender: null,
    avatarUrl: null,
    chronicConditions: [],
    primaryConditionsText: null,
  };
}

function getStoredPatientProfile(): PatientProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const patientId = String(
      localStorage.getItem('ambulant.patientId') ||
        localStorage.getItem('ambulant_patient_id') ||
        '',
    ).trim();

    if (!patientId) return null;

    const userId =
      localStorage.getItem('ambulant.userId') ||
      localStorage.getItem('ambulant_uid') ||
      null;

    const name =
      localStorage.getItem('ambulant.patientName') ||
      localStorage.getItem('ambulant_patient_name') ||
      'Patient';

    return {
      patientId,
      userId,
      name,
      age: null,
      gender: null,
      avatarUrl: null,
      chronicConditions: [],
      primaryConditionsText: null,
    };
  } catch {
    return null;
  }
}

async function resolveSignedInPatient(): Promise<PatientProfile | null> {
  const profile = await getJSON<any>('/api/profile', { fallback: null });
  const normalizedProfile = normalizePatientProfile(profile);

  if (normalizedProfile) {
    return normalizedProfile;
  }

  const authMe = await getJSON<AuthMeResponse | null>('/api/auth/me', {
    fallback: null,
  });

  const authPatient = normalizeAuthMeAsPatient(authMe);

  if (authPatient) {
    return authPatient;
  }

  return getStoredPatientProfile();
}

export function useVitals() {
  const ctx = useContext(VitalsContext);
  if (!ctx) {
    throw new Error('useVitals must be used inside VitalsProvider');
  }
  return ctx;
}

export function useVitalsProvider() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [vitalsSummary, setVitalsSummary] = useState<VitalsSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  const lastSeenRef = useRef<Record<string, number>>({});

  const refreshOverview = useCallback(async () => {
    setLoadingProfile(true);

    try {
      const signedIn = await resolveSignedInPatient();
      setProfile(signedIn);

      if (!signedIn?.patientId) {
        setVitalsSummary(null);
        return;
      }

      const summary = await getJSON<VitalsSummary | null>(
        `/api/vitals/summary?patientId=${encodeURIComponent(signedIn.patientId)}`,
        { fallback: null },
      );

      setVitalsSummary(summary);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const emitVital = useCallback(
    async (opts: VitalsEmitInput) => {
      if (!profile?.patientId) {
        throw new Error('Cannot emit vital before signed-in patient is resolved.');
      }

      const patientId = profile.patientId;
      const roomId = `room-${patientId}`;
      const recorded_at = opts.recorded_at ?? new Date().toISOString();
      const deviceId = opts.deviceId ?? 'duecare.health-monitor';
      const payload = opts.payload ?? {};
      const meta = { ...(opts.meta ?? {}), roomId };
      const type = opts.type;

      if (opts.dedupeKey) {
        const key = `${opts.dedupeKey}:${type}`;
        const now = Date.now();
        const last = lastSeenRef.current[key] ?? 0;

        if (now - last < 2500) return;
        lastSeenRef.current[key] = now;
      }

      const result = await emitVitalApi({
        patientId,
        type,
        deviceId,
        recorded_at,
        payload,
        meta,
      });

      if (result?.ok !== false) {
        await refreshOverview();
      }
    },
    [profile?.patientId, refreshOverview],
  );

  const value = useMemo<VitalsContextType>(() => {
    const patientId = profile?.patientId ?? null;

    return {
      patientId,
      roomId: patientId ? `room-${patientId}` : null,
      profile,
      vitalsSummary,
      loadingProfile,
      refreshOverview,
      emitVital,
    };
  }, [profile, vitalsSummary, loadingProfile, refreshOverview, emitVital]);

  return value;
}

export function VitalsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: VitalsContextType;
}) {
  return <VitalsContext.Provider value={value}>{children}</VitalsContext.Provider>;
}
