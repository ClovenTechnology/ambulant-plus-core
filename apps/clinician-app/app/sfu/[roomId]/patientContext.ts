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

export const DEMO_MEDS: PatientMedicationBrief[] = [
  {
    id: 'demo-metformin',
    name: 'Metformin 500 mg tablet',
    dose: '500 mg',
    frequency: '1 tablet twice daily with meals',
    route: 'Oral',
    status: 'Active',
    started: '2024-01-05',
    source: 'demo',
  },
  {
    id: 'demo-amlodipine',
    name: 'Amlodipine 5 mg tablet',
    dose: '5 mg',
    frequency: 'Once daily',
    route: 'Oral',
    status: 'Active',
    started: '2023-11-12',
    source: 'demo',
  },
];

export const DEMO_ALLERGIES: PatientAllergyBrief[] = [
  {
    id: 'demo-pen',
    substance: 'Penicillin',
    reaction: 'Rash / urticaria',
    severity: 'Moderate',
    criticality: 'High',
    status: 'Active',
  },
  {
    id: 'demo-nuts',
    substance: 'Peanuts',
    reaction: 'Lip swelling',
    severity: 'Mild',
    criticality: 'High',
    status: 'Active',
  },
];

export const SIMULATION_FALLBACK_PROFILE: PatientProfile = {
  id: 'simulation-patient',
  name: 'Simulation Patient',
  dob: null,
  gender: null,
  mrn: null,
  language: null,
  phone: null,
  email: null,
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

export function usePatientContext(
  _roomId: string,
  searchParams: ReadonlyURLSearchParams
): PatientContextValue {
  const patientId = searchParams.get('patientId') || searchParams.get('patient') || 'simulation-patient';
  const patientName = searchParams.get('patientName') || 'Simulation Patient';
  const encounterId = searchParams.get('encounterId') || '';

  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [patientProfileError, setPatientProfileError] = useState<string | null>(null);

  const [patientMeds, setPatientMeds] = useState<PatientMedicationBrief[] | null>(null);
  const [medsError, setMedsError] = useState<string | null>(null);

  const [patientAllergies, setPatientAllergies] = useState<PatientAllergyBrief[] | null>(null);
  const [allergiesError, setAllergiesError] = useState<string | null>(null);
  const [allergiesLoading, setAllergiesLoading] = useState(false);
  const [allergiesFromLive, setAllergiesFromLive] = useState(false);

  // Profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPatientProfileError(null);
        const pid = patientId;
        if (!pid) {
          if (!cancelled) {
            setPatientProfile(SIMULATION_FALLBACK_PROFILE);
            setPatientProfileError('Using simulation patient profile because no patientId was supplied.');
          }
          return;
        }
        const qs = new URLSearchParams({ patientId: pid });
        if (encounterId) qs.set('encounterId', encounterId);
        const url = `/api/patient/profile?${qs.toString()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = await res.json().catch(() => null);
        const raw: any =
          (js && (js.patient || js.profile || js.data)) ||
          js ||
          {};

        const prof: PatientProfile = {
          id: String(raw.id ?? raw.patientId ?? pid),
          name:
            raw.name ??
            raw.fullName ??
            raw.display ??
            patientName ??
            SIMULATION_FALLBACK_PROFILE.name,
          dob: raw.dob ?? raw.dateOfBirth ?? SIMULATION_FALLBACK_PROFILE.dob,
          gender: raw.gender ?? raw.sex ?? SIMULATION_FALLBACK_PROFILE.gender,
          mrn: raw.mrn ?? raw.medicalRecordNumber ?? SIMULATION_FALLBACK_PROFILE.mrn,
          language: raw.language ?? raw.preferredLanguage ?? SIMULATION_FALLBACK_PROFILE.language,
          phone: raw.phone ?? raw.mobile ?? SIMULATION_FALLBACK_PROFILE.phone,
          email: raw.email ?? raw.emailAddress ?? SIMULATION_FALLBACK_PROFILE.email,
        };

        if (!cancelled) setPatientProfile(prof);
      } catch {
        if (!cancelled) {
          setPatientProfile(SIMULATION_FALLBACK_PROFILE);
          setPatientProfileError('Using simulation patient profile because live profile details are unavailable.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId, patientName, encounterId]);

  // Medications
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMedsError(null);
        const pid = patientId;
        if (!pid) {
          if (!cancelled) {
            setPatientMeds(DEMO_MEDS);
            setMedsError('Using simulation medication data because live medication feed is unavailable.');
          }
          return;
        }
        const url = `/api/medications?patientId=${encodeURIComponent(pid)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any).items)
          ? (data as any).items
          : [];
        const mapped: PatientMedicationBrief[] = list.map((m: any, idx: number) => ({
          id: String(m.id ?? m.medicationId ?? `med-${idx}`),
          name: m.name ?? m.drug ?? m.title ?? 'Unnamed medication',
          dose: m.dose ?? m.doseText ?? null,
          frequency: m.frequency ?? m.sig ?? null,
          route: m.route ?? null,
          status: m.status ?? m.state ?? null,
          started: m.started ?? m.startDate ?? m.authoredOn ?? null,
          source: m.source ?? m.origin ?? null,
        }));
        if (!cancelled) setPatientMeds(mapped);
      } catch {
        if (!cancelled) {
          setPatientMeds(DEMO_MEDS);
          setMedsError('Using simulation medication data because live medication feed is unavailable.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  // Allergies (initial load)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setAllergiesError(null);
        setAllergiesLoading(true);
        const pid = patientId;
        if (!pid) {
          if (!cancelled) {
            setPatientAllergies(DEMO_ALLERGIES);
            setAllergiesError('Using simulation allergy data because live allergy feed is unavailable.');
            setAllergiesFromLive(false);
          }
          return;
        }
        const url = `/api/allergies?patientId=${encodeURIComponent(pid)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: any[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any).items)
          ? (data as any).items
          : [];
        const mapped: PatientAllergyBrief[] = list.map((a: any, idx: number) => ({
          id: String(a.id ?? a.allergyId ?? `alg-${idx}`),
          substance: a.substance ?? a.agent ?? a.code?.text ?? 'Unknown',
          reaction: a.reaction ?? a.manifestation ?? null,
          severity: a.severity ?? null,
          criticality: a.criticality ?? null,
          status: a.status ?? a.clinicalStatus ?? null,
          recordedAt: a.recordedAt ?? a.onset ?? null,
        }));
        if (!cancelled) {
          setPatientAllergies(mapped);
          setAllergiesFromLive(true);
        }
      } catch {
        if (!cancelled) {
          setPatientAllergies(DEMO_ALLERGIES);
          setAllergiesError('Using simulation allergy data because live allergy feed is unavailable.');
          setAllergiesFromLive(false);
        }
      } finally {
        if (!cancelled) setAllergiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const refreshAllergies = useCallback(async () => {
    setAllergiesLoading(true);
    try {
      setAllergiesError(null);
      const pid = patientId;
      if (!pid) {
        setPatientAllergies(DEMO_ALLERGIES);
        setAllergiesError('Using simulation allergy data because live allergy feed is unavailable.');
        setAllergiesFromLive(false);
        return;
      }
      const url = `/api/allergies?patientId=${encodeURIComponent(pid)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).items)
        ? (data as any).items
        : [];
      const mapped: PatientAllergyBrief[] = list.map((a: any, idx: number) => ({
        id: String(a.id ?? a.allergyId ?? `alg-${idx}`),
        substance: a.substance ?? a.agent ?? a.code?.text ?? 'Unknown',
        reaction: a.reaction ?? a.manifestation ?? null,
        severity: a.severity ?? null,
        criticality: a.criticality ?? null,
        status: a.status ?? a.clinicalStatus ?? null,
        recordedAt: a.recordedAt ?? a.onset ?? null,
      }));
      setPatientAllergies(mapped);
      setAllergiesFromLive(true);
    } catch {
      setPatientAllergies(DEMO_ALLERGIES);
      setAllergiesError('Using simulation allergy data because live allergy feed is unavailable.');
      setAllergiesFromLive(false);
    } finally {
      setAllergiesLoading(false);
    }
  }, [patientId]);

  const profile = patientProfile || SIMULATION_FALLBACK_PROFILE;

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
