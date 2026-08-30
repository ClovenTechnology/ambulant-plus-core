// apps/clinician-app/app/sfu/[roomId]/patientContext.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';

export type PatientMedicationBrief = {
  id: string;
  name: string;
  dose?: string | null;
  frequency?: string | null;
  route?: string | null;
  status?: string | null;
  started?: string | null;
  lastFilled?: string | null;
  source?: string | null;
};

export type PatientAllergyBrief = {
  id: string;
  substance: string;
  reaction?: string | null;
  severity?: string | null;
  criticality?: string | null;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  recordedAt?: string | null;
};

export type PatientConditionBrief = {
  id: string;
  name: string;
  status?: string | null;
  state?: string | null;
  diagnosedAt?: string | null;
  facility?: string | null;
  clinician?: string | null;
  onAmbulant?: boolean | null;
  notes?: string | null;
  source?: string | null;
  recordedBy?: string | null;
  updatedAt?: string | null;
};

export type PatientProfile = {
  id: string;
  name: string;
  dob?: string | null;
  gender?: string | null;
  mrn?: string | null;
  language?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type PatientClinicalContext = {
  status: 'READY';
  source: string;
  observedAt: string;
  encounter: Record<string, any>;
  patient: PatientProfile & { userId?: string | null; legacyAllergyText?: string | null };
  medications: PatientMedicationBrief[];
  allergies: PatientAllergyBrief[];
  conditions: PatientConditionBrief[];
  cases: Array<Record<string, any>>;
  encounters: Array<Record<string, any>>;
  labResults: Array<Record<string, any>>;
  operations: Array<Record<string, any>>;
  vaccinations: Array<Record<string, any>>;
};

export type PatientContextStatus = 'loading' | 'ready' | 'simulation' | 'unavailable';

export type PatientContextValue = {
  profile: PatientProfile;
  patientProfile: PatientProfile | null;
  patientProfileError: string | null;

  patientMeds: PatientMedicationBrief[] | null;
  medsError: string | null;

  patientAllergies: PatientAllergyBrief[] | null;
  allergiesError: string | null;
  allergiesLoading: boolean;
  allergiesFromLive: boolean;

  patientConditions: PatientConditionBrief[] | null;
  clinicalContext: PatientClinicalContext | null;
  contextStatus: PatientContextStatus;
  contextError: string | null;

  patientId: string;
  patientName: string;
  encounterId: string;

  refreshContext: () => Promise<void>;
  refreshAllergies: () => Promise<void>;
  setPatientAllergies: React.Dispatch<
    React.SetStateAction<PatientAllergyBrief[] | null>
  >;
};

function fallbackProfile(patientId: string, patientName: string): PatientProfile {
  return {
    id: patientId || '',
    name: patientName || 'Patient',
    dob: null,
    gender: null,
    mrn: null,
    language: null,
    phone: null,
    email: null,
  };
}

function safeError(value: unknown, fallback: string) {
  if (value && typeof value === 'object' && 'message' in value) {
    return String((value as { message?: unknown }).message || fallback);
  }
  return fallback;
}

function contextMessage(error: string) {
  return `Clinical context unavailable (${error}). Do not assume absent allergies, medications, conditions, or history.`;
}

export function usePatientContext(
  roomId: string,
  searchParams: ReadonlyURLSearchParams,
): PatientContextValue {
  const queryPatientId = searchParams.get('patientId') || searchParams.get('patient') || '';
  const queryPatientName = searchParams.get('patientName') || 'Patient';
  const encounterId = searchParams.get('encounterId') || '';
  const appointmentId =
    searchParams.get('appointmentId') ||
    searchParams.get('appointment') ||
    searchParams.get('appt') ||
    '';
  const simulation = searchParams.get('simulation') === '1' || roomId.startsWith('simulation-');

  const [clinicalContext, setClinicalContext] = useState<PatientClinicalContext | null>(null);
  const [contextStatus, setContextStatus] = useState<PatientContextStatus>(
    simulation ? 'simulation' : 'loading',
  );
  const [contextError, setContextError] = useState<string | null>(null);
  const [patientAllergies, setPatientAllergies] = useState<PatientAllergyBrief[] | null>(
    simulation ? [] : null,
  );
  const [allergiesLoading, setAllergiesLoading] = useState(false);

  const loadContext = useCallback(async () => {
    if (simulation) {
      setClinicalContext(null);
      setPatientAllergies([]);
      setContextStatus('simulation');
      setContextError(null);
      return;
    }

    if (!encounterId) {
      const message = 'encounter_id_missing';
      setClinicalContext(null);
      setPatientAllergies(null);
      setContextStatus('unavailable');
      setContextError(message);
      return;
    }

    setContextStatus((current) => (current === 'ready' ? current : 'loading'));
    setContextError(null);

    try {
      const qs = new URLSearchParams();
      if (appointmentId) qs.set('appointmentId', appointmentId);
      if (roomId) qs.set('roomId', roomId);

      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const response = await fetch(
        `/api/encounters/${encodeURIComponent(encounterId)}/clinical-context${suffix}`,
        { cache: 'no-store', credentials: 'same-origin' },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.context) {
        throw new Error(payload?.error || `HTTP_${response.status}`);
      }

      const next = payload.context as PatientClinicalContext;
      if (!next?.patient?.id) throw new Error('patient_profile_missing');

      setClinicalContext(next);
      setPatientAllergies(Array.isArray(next.allergies) ? next.allergies : []);
      setContextStatus('ready');
      setContextError(null);
    } catch (error) {
      const message = safeError(error, 'clinical_context_failed');
      setClinicalContext(null);
      setPatientAllergies(null);
      setContextStatus('unavailable');
      setContextError(message);
    }
  }, [appointmentId, encounterId, roomId, simulation]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!active) return;
      await loadContext();
    })();

    return () => {
      active = false;
    };
  }, [loadContext]);

  const refreshContext = useCallback(async () => {
    await loadContext();
  }, [loadContext]);

  const refreshAllergies = useCallback(async () => {
    setAllergiesLoading(true);
    try {
      await loadContext();
    } finally {
      setAllergiesLoading(false);
    }
  }, [loadContext]);

  const patientProfile = clinicalContext?.patient || null;
  const patientId = patientProfile?.id || queryPatientId;
  const patientName = patientProfile?.name || queryPatientName;
  const profile = patientProfile || fallbackProfile(patientId, patientName);

  const unavailableMessage = contextError ? contextMessage(contextError) : null;
  const patientMeds =
    contextStatus === 'ready' ? clinicalContext?.medications || [] : contextStatus === 'simulation' ? [] : null;
  const patientConditions =
    contextStatus === 'ready' ? clinicalContext?.conditions || [] : contextStatus === 'simulation' ? [] : null;

  return useMemo(
    () => ({
      profile,
      patientProfile,
      patientProfileError: unavailableMessage,
      patientMeds,
      medsError: unavailableMessage,
      patientAllergies,
      allergiesError: unavailableMessage,
      allergiesLoading,
      allergiesFromLive: contextStatus === 'ready',
      patientConditions,
      clinicalContext,
      contextStatus,
      contextError,
      patientId,
      patientName,
      encounterId,
      refreshContext,
      refreshAllergies,
      setPatientAllergies,
    }),
    [
      profile,
      patientProfile,
      unavailableMessage,
      patientMeds,
      patientAllergies,
      allergiesLoading,
      contextStatus,
      patientConditions,
      clinicalContext,
      contextError,
      patientId,
      patientName,
      encounterId,
      refreshContext,
      refreshAllergies,
    ],
  );
}
