// apps/clinician-app/app/sfu/[roomId]/patientContext.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReadonlyURLSearchParams } from 'next/navigation';

export type PatientMedicationBrief = {
  id: string;
  name: string;
  dose?: string | null;
  frequency?: string | null;
  route?: string | null;
  status?: string | null;
  started?: string | null;
  source?: string | null;
};

export type PatientAllergyBrief = {
  id: string;
  substance: string;
  reaction?: string | null;
  severity?: string | null;
  criticality?: string | null;
  status?: string | null;
  recordedAt?: string | null;
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

  patientId: string;
  patientName: string;
  encounterId: string;

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

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function medicationList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.medications)) return data.medications;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function allergyList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.allergies)) return data.allergies;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function usePatientContext(
  _roomId: string,
  searchParams: ReadonlyURLSearchParams,
): PatientContextValue {
  const patientId = searchParams.get('patientId') || searchParams.get('patient') || '';
  const patientName = searchParams.get('patientName') || 'Patient';
  const encounterId = searchParams.get('encounterId') || '';

  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [patientProfileError, setPatientProfileError] = useState<string | null>(null);

  const [patientMeds, setPatientMeds] = useState<PatientMedicationBrief[] | null>(null);
  const [medsError, setMedsError] = useState<string | null>(null);

  const [patientAllergies, setPatientAllergies] = useState<PatientAllergyBrief[] | null>(null);
  const [allergiesError, setAllergiesError] = useState<string | null>(null);
  const [allergiesLoading, setAllergiesLoading] = useState(false);
  const [allergiesFromLive, setAllergiesFromLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setPatientProfileError(null);

        if (!patientId) {
          if (!cancelled) {
            setPatientProfile(fallbackProfile('', patientName));
            setPatientProfileError('Missing patientId; live patient profile was not requested.');
          }
          return;
        }

        const qs = new URLSearchParams({ patientId });
        if (encounterId) qs.set('encounterId', encounterId);

        const res = await fetch('/api/patient/profile?' + qs.toString(), {
          cache: 'no-store',
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        const js = await res.json().catch(() => null);
        const raw: any = (js && (js.patient || js.profile || js.data)) || js || {};

        const prof: PatientProfile = {
          id: String(raw.id ?? raw.patientId ?? patientId),
          name: raw.name ?? raw.fullName ?? raw.display ?? patientName ?? 'Patient',
          dob: raw.dob ?? raw.dateOfBirth ?? null,
          gender: raw.gender ?? raw.sex ?? null,
          mrn: raw.mrn ?? raw.medicalRecordNumber ?? null,
          language: raw.language ?? raw.preferredLanguage ?? null,
          phone: raw.phone ?? raw.mobile ?? null,
          email: raw.email ?? raw.emailAddress ?? null,
        };

        if (!cancelled) setPatientProfile(prof);
      } catch (err) {
        if (!cancelled) {
          setPatientProfile(fallbackProfile(patientId, patientName));
          setPatientProfileError('Live patient profile unavailable: ' + errorMessage(err, 'profile_failed'));
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [patientId, patientName, encounterId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMeds() {
      try {
        setMedsError(null);

        if (!patientId) {
          if (!cancelled) {
            setPatientMeds([]);
            setMedsError('Missing patientId; live medication feed was not requested.');
          }
          return;
        }

        const res = await fetch('/api/medications?patientId=' + encodeURIComponent(patientId), {
          cache: 'no-store',
        });

        if (!res.ok) throw new Error('HTTP ' + res.status);

        const data = await res.json();
        const mapped: PatientMedicationBrief[] = medicationList(data).map((m: any, idx: number) => ({
          id: String(m.id ?? m.medicationId ?? 'med-' + idx),
          name: m.name ?? m.drug ?? m.title ?? 'Unnamed medication',
          dose: m.dose ?? m.doseText ?? null,
          frequency: m.frequency ?? m.sig ?? null,
          route: m.route ?? null,
          status: m.status ?? m.state ?? null,
          started: m.started ?? m.startDate ?? m.authoredOn ?? null,
          source: m.source ?? m.origin ?? null,
        }));

        if (!cancelled) setPatientMeds(mapped);
      } catch (err) {
        if (!cancelled) {
          setPatientMeds([]);
          setMedsError('Live medication feed unavailable: ' + errorMessage(err, 'medications_failed'));
        }
      }
    }

    void loadMeds();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const refreshAllergies = useCallback(async () => {
    setAllergiesLoading(true);

    try {
      setAllergiesError(null);

      if (!patientId) {
        setPatientAllergies([]);
        setAllergiesError('Missing patientId; live allergy feed was not requested.');
        setAllergiesFromLive(false);
        return;
      }

      const res = await fetch('/api/allergies?patientId=' + encodeURIComponent(patientId), {
        cache: 'no-store',
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const mapped: PatientAllergyBrief[] = allergyList(data).map((a: any, idx: number) => ({
        id: String(a.id ?? a.allergyId ?? 'alg-' + idx),
        substance: a.substance ?? a.agent ?? a.code?.text ?? 'Unknown',
        reaction: a.reaction ?? a.manifestation ?? null,
        severity: a.severity ?? null,
        criticality: a.criticality ?? null,
        status: a.status ?? a.clinicalStatus ?? null,
        recordedAt: a.recordedAt ?? a.onset ?? null,
      }));

      setPatientAllergies(mapped);
      setAllergiesFromLive(true);
    } catch (err) {
      setPatientAllergies([]);
      setAllergiesError('Live allergy feed unavailable: ' + errorMessage(err, 'allergies_failed'));
      setAllergiesFromLive(false);
    } finally {
      setAllergiesLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void refreshAllergies();
  }, [refreshAllergies]);

  const profile = patientProfile || fallbackProfile(patientId, patientName);

  return {
    profile,
    patientProfile,
    patientProfileError,
    patientMeds,
    medsError,
    patientAllergies,
    allergiesError,
    allergiesLoading,
    allergiesFromLive,
    patientId,
    patientName,
    encounterId,
    refreshAllergies,
    setPatientAllergies,
  };
}
