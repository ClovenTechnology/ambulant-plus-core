// apps/clinician-app/app/sfu/[roomId]/ErxComposer.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui';

import {
  useAutocomplete,
  icdSearch,
  rxnormSearch,
  sigsForRxCui,
  labTestSearch,
} from '@/src/hooks/useAutocomplete';
import type { ICD10Hit, RxNormHit, LabTestHit } from '@/src/hooks/useAutocomplete';

import type { PatientAllergyBrief, PatientProfile } from './patientContext';

type ToastKind = 'info' | 'success' | 'warning' | 'error';
type OrderState = 'empty' | 'draft' | 'issued';
type OrderScope = 'medications' | 'labs';

export type SoapState = {
  // Canonical Clinical Note fields. The legacy s/o/a/p keys remain for bounded
  // compatibility with Insight and older draft caches; they are derived from
  // these fields rather than owning Orders or Conclusions.
  clinicalNote?: string;
  presentingComplaint?: string;
  hpi?: string;
  symptoms?: string;
  relevantHistory?: string;
  objectiveFindings?: string;
  clinicalReasoning?: string;
  riskAssessment?: string;
  s: string;
  o: string;
  a: string;
  p: string;
  icd10Code?: string;
};

type RxRow = {
  drug: string;
  strength: string;
  form: string;
  dose: string;
  route: string;
  freq: string;
  duration: string;
  qty: string;
  refills: number;
  notes?: string;
  rxcui?: string;
  nappi?: string;
  sigSuggestions?: string[];
};

type LabRow = {
  test: string;
  priority: '' | 'Routine' | 'Urgent' | 'Stat';
  specimen: string;
  icd: string;
  instructions?: string;
  catalogCode?: string;
  catalogSystem?: string;
};

export type ErxSummaryMed = {
  drug: string;
  strength?: string;
  form?: string;
  dose?: string;
  route?: string;
  freq?: string;
  duration?: string;
};
export type ErxSummaryLab = {
  test: string;
  priority?: string;
  specimen?: string;
  icd?: string;
  code?: string;
  codeSystem?: string;
};
export type ErxSummary = {
  meds: ErxSummaryMed[];
  labs: ErxSummaryLab[];
  // Optional at the public type boundary for backward-compatible SFU skins.
  // This composer still emits all four lifecycle fields on every summary update.
  medicationState?: OrderState;
  labState?: OrderState;
  medicationDraftCount?: number;
  labDraftCount?: number;
};

type ErxComposerProps = {
  dense: boolean;
  soap: SoapState;
  profile: PatientProfile;
  appt: {
    id: string;
    when: string;
    patientId: string;
    patientName: string;
    clinicianName: string;
    reason: string;
    status: string;
    roomId: string;
  };
  encounterId: string;
  patientId: string;
  clinicianId: string;
  patientAllergies: PatientAllergyBrief[] | null;
  allergiesFromLive: boolean;
  allergyContextAvailable?: boolean;
  simulation?: boolean;
  currentMedicationNames?: string[];
  // Legacy compatibility input: indexed ICD-10 lookup is now internal to the composer.
  icd10Suggestions?: string[];
  onToast: (body: string, kind?: ToastKind, title?: string) => void;
  onAudit: (action: string, extra?: Record<string, unknown>) => void;
  onSummaryChange?: (summary: ErxSummary) => void;
};

type ErxResult = {
  id: string;
  status: string;
  dispenseCode: string;
  error?: string;
  scope?: OrderScope;
};

const EMPTY_RX: RxRow = {
  drug: '', strength: '', form: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0,
};
const EMPTY_LAB: LabRow = { test: '', priority: '', specimen: '', icd: '', instructions: '' };

function parseSig(sig: string) {
  const parts = sig.trim().split(/\s+/);
  if (!parts.length) return { dose: '', route: '', freq: '', duration: '' };
  const dose = parts.slice(0, 2).join(' ');
  const route = parts[2] || '';
  const freq = parts[3] || '';
  const durIdx = parts.findIndex((p) => /^x?\d+/i.test(p));
  const duration = durIdx >= 0 ? parts.slice(durIdx).join(' ') : '';
  return { dose, route, freq, duration };
}

function inferStrengthAndForm(label: string) {
  const text = String(label || '').trim();
  const strength = text.match(/\b\d+(?:\.\d+)?\s*(?:mcg|micrograms?|mg|g|kg|units?|iu|mmol|mEq)(?:\s*\/\s*(?:mL|L|dose|actuation))?\b/i)?.[0] || '';
  const formPatterns = [
    'Extended Release Oral Tablet', 'Delayed Release Oral Tablet', 'Oral Disintegrating Tablet',
    'Sublingual Tablet', 'Buccal Tablet', 'Oral Tablet', 'Oral Capsule', 'Oral Solution',
    'Oral Suspension', 'Injectable Solution', 'Injection', 'Inhalation Solution', 'Inhalation Powder',
    'Metered Dose Inhaler', 'Transdermal Patch', 'Topical Cream', 'Topical Ointment', 'Topical Gel',
    'Eye Drops', 'Ophthalmic Solution', 'Ear Drops', 'Nasal Spray', 'Suppository', 'Vaginal Tablet',
    'Tablet', 'Capsule', 'Solution', 'Suspension', 'Cream', 'Ointment', 'Gel', 'Patch', 'Spray', 'Drops',
  ];
  const lower = text.toLowerCase();
  const form = formPatterns.find((candidate) => lower.includes(candidate.toLowerCase())) || '';
  return { strength, form };
}

function normalizeForMatch(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function isActiveAllergy(a: PatientAllergyBrief) {
  const s = normalizeForMatch(a.status);
  if (!s) return true;
  if (s.includes('entered in error')) return false;
  return !(s.includes('resolved') || s.includes('inactive'));
}

function isSevereAllergy(a: PatientAllergyBrief) {
  const s = normalizeForMatch(a.severity);
  return s.includes('severe') || s.includes('critical') || s.includes('high');
}

function validMedicationRows(rows: RxRow[]) {
  return rows.filter((row) => row.drug.trim());
}
function validLabRows(rows: LabRow[]) {
  return rows.filter((row) => row.test.trim());
}

function extractMaxScheduleFromRows(rows: RxRow[]) {
  let maxFound: number | null = null;
  for (const row of rows) {
    const text = `${row.drug || ''} ${row.notes || ''} ${row.freq || ''} ${row.duration || ''}`.toLowerCase();
    const match = text.match(/schedule\s*([1-8])/i);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) maxFound = maxFound == null ? value : Math.max(maxFound, value);
  }
  return maxFound;
}

function stateBadge(state: OrderState) {
  if (state === 'issued') return 'Issued to patient';
  if (state === 'draft') return 'Draft saved';
  return 'No authored order';
}

export default function ErxComposer({
  dense,
  soap,
  profile,
  appt,
  encounterId,
  patientId,
  clinicianId,
  patientAllergies,
  allergiesFromLive,
  allergyContextAvailable = false,
  simulation = false,
  currentMedicationNames = [],
  onToast,
  onAudit,
  onSummaryChange,
}: ErxComposerProps) {
  const [activeOrderTab, setActiveOrderTab] = useState<OrderScope>('medications');
  const [rxRows, setRxRows] = useState<RxRow[]>([{ ...EMPTY_RX }]);
  const [labRows, setLabRows] = useState<LabRow[]>([{ ...EMPTY_LAB }]);
  const [medicationState, setMedicationState] = useState<OrderState>('empty');
  const [labState, setLabState] = useState<OrderState>('empty');
  const [erxResult, setErxResult] = useState<ErxResult | null>(null);
  const [busyScope, setBusyScope] = useState<OrderScope | null>(null);
  const [previewScope, setPreviewScope] = useState<OrderScope | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(simulation || !encounterId);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const hydratingRef = useRef(true);
  const previousMedSignature = useRef('');
  const previousLabSignature = useRef('');

  const [operational, setOperational] = useState<null | {
    canPrescribe?: boolean;
    prescribingMode?: 'no' | 'conditional' | 'yes';
    maxRxSchedule?: number | null;
    blockers?: string[];
    riskFlags?: string[];
  }>(null);

  const medsToAuthor = useMemo(() => validMedicationRows(rxRows), [rxRows]);
  const labsToAuthor = useMemo(() => validLabRows(labRows), [labRows]);
  const medSignature = useMemo(() => JSON.stringify(medsToAuthor), [medsToAuthor]);
  const labSignature = useMemo(() => JSON.stringify(labsToAuthor), [labsToAuthor]);

  const severeAllergies = useMemo(
    () => (patientAllergies || []).filter((a) => isActiveAllergy(a) && isSevereAllergy(a)),
    [patientAllergies],
  );
  const recentAllergyReactions = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return (patientAllergies || []).filter((a: any) => {
      const raw = a.recordedAt || a.createdAt || a.updatedAt;
      if (!raw) return false;
      const t = Date.parse(raw);
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [patientAllergies]);
  const currentMedicationSet = useMemo(
    () => new Set(currentMedicationNames.map(normalizeForMatch).filter(Boolean)),
    [currentMedicationNames],
  );

  function currentMedicationMatch(drug: string) {
    const normalized = normalizeForMatch(drug);
    if (!normalized) return null;
    for (const current of currentMedicationSet) {
      if (normalized === current || normalized.includes(current) || current.includes(normalized)) return current;
    }
    return null;
  }

  function allergyConflictsForRows(rows: RxRow[]) {
    const allergies = (patientAllergies || []).filter(isActiveAllergy);
    return rows.flatMap((rx, medicationIndex) => {
      const drug = normalizeForMatch(rx.drug);
      if (!drug) return [];
      return allergies
        .filter((all) => {
          const substance = normalizeForMatch(all.substance);
          return substance.length >= 4 && (drug.includes(substance) || substance.includes(drug));
        })
        .map((all) => ({
          medicationIndex,
          drug: rx.drug,
          substance: all.substance,
          severity: all.severity ?? null,
          reaction: all.reaction ?? null,
          status: all.status ?? null,
        }));
    });
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch('/api/me', { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
        const js = await res.json().catch(() => null as any);
        if (!alive) return;
        setOperational(
          js?.clinician?.operational && typeof js.clinician.operational === 'object'
            ? js.clinician.operational
            : js?.clinician?.activation && typeof js.clinician.activation === 'object'
              ? js.clinician.activation
              : null,
        );
      } catch {
        if (alive) setOperational(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (simulation || !encounterId) {
      hydratingRef.current = false;
      setDraftHydrated(true);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/erx`, { cache: 'no-store' });
        const js = await res.json().catch(() => null as any);
        if (!alive) return;
        if (res.ok && js?.draft) {
          const meds = Array.isArray(js.draft.medications) ? js.draft.medications : [];
          const labs = Array.isArray(js.draft.labs) ? js.draft.labs : [];
          if (meds.length) {
            setRxRows(meds.map((row: any) => ({ ...EMPTY_RX, ...row, refills: Number(row?.refills || 0) })));
            setMedicationState('draft');
          }
          if (labs.length) {
            setLabRows(labs.map((row: any) => ({ ...EMPTY_LAB, ...row })));
            setLabState('draft');
          }
        }
      } catch {
        // The local UI remains usable; a visible save failure appears on the next write.
      } finally {
        if (alive) {
          hydratingRef.current = false;
          setDraftHydrated(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [encounterId, simulation]);

  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      meds: medsToAuthor.map((r) => ({
        drug: r.drug,
        strength: r.strength || undefined,
        form: r.form || undefined,
        dose: r.dose || undefined,
        route: r.route || undefined,
        freq: r.freq || undefined,
        duration: r.duration || undefined,
      })),
      labs: labsToAuthor.map((l) => ({
        test: l.test,
        priority: l.priority || undefined,
        specimen: l.specimen || undefined,
        icd: l.icd || undefined,
        code: l.catalogCode || undefined,
        codeSystem: l.catalogSystem || undefined,
      })),
      medicationState,
      labState,
      medicationDraftCount: medicationState === 'draft' ? medsToAuthor.length : 0,
      labDraftCount: labState === 'draft' ? labsToAuthor.length : 0,
    });
  }, [labState, labsToAuthor, medicationState, medsToAuthor, onSummaryChange]);

  function payloadFor(scope: OrderScope, action: 'save-draft' | 'finalize') {
    return {
      action,
      scope,
      encounterId,
      patientId,
      patientName: profile.name || appt.patientName,
      clinicianId,
      clinicianName: appt.clinicianName,
      reason: appt.reason,
      medications: scope === 'medications' ? medsToAuthor : [],
      labs: scope === 'labs' ? labsToAuthor : [],
      allergies: (patientAllergies || []).map((a) => ({
        substance: a.substance, severity: a.severity, reaction: a.reaction, status: a.status,
      })),
      note: soap.clinicalNote || soap.clinicalReasoning || soap.a || '',
    };
  }

  async function persistScope(
    scope: OrderScope,
    action: 'save-draft' | 'finalize',
    opts: { quiet?: boolean } = {},
  ) {
    const rows = scope === 'medications' ? medsToAuthor : labsToAuthor;
    if (!rows.length) {
      if (!opts.quiet) onToast(`Add at least one ${scope === 'medications' ? 'medication' : 'lab test'} first.`, 'warning', 'Nothing to save');
      return false;
    }

    if (action === 'finalize' && scope === 'medications') {
      if (operational?.canPrescribe === false) {
        onToast('You are not currently cleared to prescribe on Ambulant+.', 'error', 'Prescribing blocked');
        return false;
      }
      const incomplete = medsToAuthor.find((row) => !row.strength.trim() || !row.form.trim());
      if (incomplete) {
        onToast(`Strength and dosage form are required before issuing ${incomplete.drug}.`, 'error', 'Prescription incomplete');
        return false;
      }
      const requestedMaxSchedule = extractMaxScheduleFromRows(medsToAuthor);
      if (requestedMaxSchedule != null && typeof operational?.maxRxSchedule === 'number' && requestedMaxSchedule > operational.maxRxSchedule) {
        onToast(`This prescription exceeds your current prescribing authority (max schedule ${operational.maxRxSchedule}).`, 'error', 'Prescribing limit exceeded');
        return false;
      }
      if (!simulation && !allergyContextAvailable) {
        onToast('Prescription blocked because the authorised allergy record could not be verified.', 'error', 'Allergy context unavailable');
        return false;
      }
      const conflicts = allergyConflictsForRows(medsToAuthor);
      if (conflicts.length) {
        onToast(`Prescription blocked: ${conflicts[0].drug} conflicts with recorded allergy ${conflicts[0].substance}.`, 'error', 'Allergy conflict');
        onAudit('erx.issue.blocked', { reason: 'ALLERGY_CONFLICT', conflicts, allergySource: allergiesFromLive ? 'live' : 'manual' });
        return false;
      }
    }

    if (simulation) {
      if (scope === 'medications') setMedicationState(action === 'finalize' ? 'issued' : 'draft');
      else setLabState(action === 'finalize' ? 'issued' : 'draft');
      setAutosaveState('saved');
      if (action === 'finalize') {
        const simulatedId = `sim-${scope === 'medications' ? 'erx' : 'lab'}-${Date.now()}`;
        setErxResult({ id: simulatedId, status: 'SIMULATION — NOT FOR CLINICAL FULFILMENT', dispenseCode: 'NOT FOR DISPENSING', scope });
        if (!opts.quiet) onToast(
          `Simulated ${scope === 'medications' ? 'prescription' : 'lab order'} finalized. No production patient record, CarePort, MedReach, pharmacy or laboratory was updated.`,
          'success',
          'Simulation order',
        );
      }
      return true;
    }

    if (!encounterId) {
      if (!opts.quiet) onToast('No encounter is attached to this consultation.', 'error', 'Order unavailable');
      return false;
    }

    if (!opts.quiet) setBusyScope(scope);
    else setAutosaveState('saving');
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(encounterId)}/erx`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payloadFor(scope, action)),
      });
      const js = await res.json().catch(() => null as any);
      if (!res.ok || !js?.ok) throw new Error(js?.message || js?.error || `HTTP ${res.status}`);

      if (scope === 'medications') setMedicationState(action === 'finalize' ? 'issued' : 'draft');
      else setLabState(action === 'finalize' ? 'issued' : 'draft');
      setAutosaveState('saved');

      if (action === 'finalize') {
        const first = scope === 'medications' ? js?.medications?.[0] : js?.labs?.[0];
        setErxResult({
          id: String(first?.id || ''), status: String(js?.status || 'issued'),
          dispenseCode: String(first?.dispenseCode || 'Patient action required'), scope,
        });
        if (!opts.quiet) onToast(
          `${scope === 'medications' ? 'Prescription' : 'Lab order'} issued to the patient record. No ${scope === 'medications' ? 'CarePort' : 'MedReach'} marketplace request was sent; the patient chooses if and when to route it.`,
          'success',
          'Issued to patient',
        );
        onAudit(scope === 'medications' ? 'erx.issued_to_patient' : 'lab.issued_to_patient', {
          encounterId, count: rows.length, marketplaceDispatched: false, fulfilmentOwner: 'patient',
        });
      } else if (!opts.quiet) {
        onToast(`${scope === 'medications' ? 'Prescription' : 'Lab'} draft saved to the encounter.`, 'success', 'Draft saved');
      }
      return true;
    } catch (error: any) {
      setAutosaveState('error');
      if (!opts.quiet) onToast(error?.message || 'Order could not be saved.', 'error', 'Save failed');
      return false;
    } finally {
      if (!opts.quiet) setBusyScope(null);
    }
  }

  // Debounced server-backed recovery. Finalization remains a separate explicit act.
  useEffect(() => {
    if (!draftHydrated || hydratingRef.current) return;
    if (previousMedSignature.current === medSignature) return;
    previousMedSignature.current = medSignature;
    if (!medsToAuthor.length) {
      setMedicationState('empty');
      return;
    }
    setMedicationState((state) => state === 'issued' ? 'draft' : state === 'empty' ? 'draft' : state);
    const id = window.setTimeout(() => { void persistScope('medications', 'save-draft', { quiet: true }); }, 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftHydrated, medSignature]);

  useEffect(() => {
    if (!draftHydrated || hydratingRef.current) return;
    if (previousLabSignature.current === labSignature) return;
    previousLabSignature.current = labSignature;
    if (!labsToAuthor.length) {
      setLabState('empty');
      return;
    }
    setLabState((state) => state === 'issued' ? 'draft' : state === 'empty' ? 'draft' : state);
    const id = window.setTimeout(() => { void persistScope('labs', 'save-draft', { quiet: true }); }, 1200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftHydrated, labSignature]);

  const addRxRow = () => setRxRows((rows) => [...rows, { ...EMPTY_RX }]);
  const removeRxRow = (index: number) => setRxRows((rows) => rows.filter((_, i) => i !== index));
  const addLabRow = () => setLabRows((rows) => [...rows, { ...EMPTY_LAB }]);
  const removeLabRow = (index: number) => setLabRows((rows) => rows.filter((_, i) => i !== index));

  return (
    <Card title="Orders" dense={dense} gradient>
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <div className="font-semibold text-slate-900">{simulation ? 'Simulation order authoring only' : 'Clinician authorship only'}</div>
        <div className="mt-1 leading-relaxed">
          {simulation
            ? 'Simulation Orders remain local to this training session. Finalizing does not update a production patient record, CarePort, MedReach, a pharmacy or a laboratory.'
            : 'Finalizing an order issues it to the patient record. It does not send a marketplace request. The patient later decides whether to use CarePort or MedReach and chooses among available providers based on stock, price, ETA, proximity or preference.'}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button type="button" onClick={() => setActiveOrderTab('medications')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeOrderTab === 'medications' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}`}>
          eRx · {stateBadge(medicationState)}
        </button>
        <button type="button" onClick={() => setActiveOrderTab('labs')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeOrderTab === 'labs' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}`}>
          Labs · {stateBadge(labState)}
        </button>
        <span className={`ml-auto text-[11px] ${autosaveState === 'error' ? 'text-rose-700' : 'text-slate-500'}`}>
          {autosaveState === 'saving' ? 'Saving draft…' : autosaveState === 'saved' ? (simulation ? 'Simulation draft saved locally' : 'Server draft saved') : autosaveState === 'error' ? 'Draft save needs attention' : ''}
        </span>
      </div>

      {activeOrderTab === 'medications' ? (
        <div className="space-y-3">
          {severeAllergies.length > 0 ? (
            <div className="rounded border border-rose-300 bg-rose-50 px-2 py-2 text-[11px] text-rose-900">
              <div className="font-semibold">Severe allergy on record</div>
              <div className="mt-1">{severeAllergies.slice(0, 3).map((a) => `${a.substance}${a.reaction ? ` — ${a.reaction}` : ''}`).join(', ')}</div>
              {recentAllergyReactions.length ? <div className="mt-1">Recent allergy/reaction entries in last 30 days: {recentAllergyReactions.length}</div> : null}
            </div>
          ) : null}

          {rxRows.map((row, index) => {
            const currentMatch = currentMedicationMatch(row.drug);
            return (
              <div key={index} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <RxDrugInput row={row} onChange={(next) => setRxRows((rows) => rows.map((value, i) => i === index ? next : value))} />
                {currentMatch ? <div className="text-[11px] text-amber-700">Matches a current medication. Review whether this is an intended continuation or duplicate.</div> : null}
                <div className="grid gap-2 md:grid-cols-4">
                  <input className="border rounded px-2 py-1" placeholder="Strength (e.g. 500 mg)" value={row.strength} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, strength: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" placeholder="Form (e.g. tablet)" value={row.form} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, form: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" placeholder="Dose (e.g. 1 tablet)" value={row.dose} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, dose: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" placeholder="Route" value={row.route} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, route: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" placeholder="Frequency" value={row.freq} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, freq: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" placeholder="Duration" value={row.duration} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, duration: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" placeholder="Quantity" value={row.qty} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, qty: e.target.value } : value))} />
                  <input className="border rounded px-2 py-1" type="number" min={0} placeholder="Repeats" value={row.refills} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, refills: Math.max(0, Number(e.target.value) || 0) } : value))} />
                </div>
                {row.sigSuggestions?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.sigSuggestions.slice(0, 6).map((suggestion, suggestionIndex) => (
                      <button key={suggestionIndex} type="button" className="rounded-full border bg-slate-50 px-2 py-0.5 text-[11px]" onClick={() => {
                        const parsed = parseSig(suggestion);
                        setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, dose: value.dose || parsed.dose, route: value.route || parsed.route, freq: value.freq || parsed.freq || suggestion, duration: value.duration || parsed.duration } : value));
                      }}>{suggestion}</button>
                    ))}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input className="min-w-0 flex-1 border rounded px-2 py-1" placeholder="Directions / notes (optional)" value={row.notes || ''} onChange={(e) => setRxRows((rows) => rows.map((value, i) => i === index ? { ...value, notes: e.target.value } : value))} />
                  <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => removeRxRow(index)}>Remove</button>
                </div>
              </div>
            );
          })}
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={addRxRow}>Add medication</button>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <button type="button" className="rounded border bg-white px-3 py-1.5 text-xs font-semibold" disabled={busyScope !== null} onClick={() => void persistScope('medications', 'save-draft')}>Save draft</button>
            <button type="button" className="rounded border bg-white px-3 py-1.5 text-xs font-semibold" disabled={!medsToAuthor.length} onClick={() => setPreviewScope('medications')}>Preview prescription</button>
            <button type="button" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50" disabled={busyScope !== null || !medsToAuthor.length} onClick={() => void persistScope('medications', 'finalize')}>
              {busyScope === 'medications' ? 'Finalizing…' : simulation ? 'Finalize simulated eRx' : 'Finalize & issue to patient'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {labRows.map((row, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <LabTestInput row={row} onChange={(next) => setLabRows((rows) => rows.map((value, i) => i === index ? next : value))} />
              <div className="grid gap-2 md:grid-cols-3">
                <select className="border rounded px-2 py-1" value={row.priority} onChange={(e) => setLabRows((rows) => rows.map((value, i) => i === index ? { ...value, priority: e.target.value as LabRow['priority'] } : value))}>
                  <option value="">Priority</option><option value="Routine">Routine</option><option value="Urgent">Urgent</option><option value="Stat">Stat</option>
                </select>
                <input className="border rounded px-2 py-1" placeholder="Specimen" value={row.specimen} onChange={(e) => setLabRows((rows) => rows.map((value, i) => i === index ? { ...value, specimen: e.target.value } : value))} />
                <Icd10Input value={row.icd} onChange={(code, label) => setLabRows((rows) => rows.map((value, i) => i === index ? { ...value, icd: code || label } : value))} placeholder="ICD-10 indication (optional)" />
              </div>
              <div className="flex gap-2">
                <input className="min-w-0 flex-1 border rounded px-2 py-1" placeholder="Clinical indication / specimen instructions" value={row.instructions || ''} onChange={(e) => setLabRows((rows) => rows.map((value, i) => i === index ? { ...value, instructions: e.target.value } : value))} />
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => removeLabRow(index)}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="rounded border px-2 py-1 text-xs" onClick={addLabRow}>Add lab test</button>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <button type="button" className="rounded border bg-white px-3 py-1.5 text-xs font-semibold" disabled={busyScope !== null} onClick={() => void persistScope('labs', 'save-draft')}>Save draft</button>
            <button type="button" className="rounded border bg-white px-3 py-1.5 text-xs font-semibold" disabled={!labsToAuthor.length} onClick={() => setPreviewScope('labs')}>Review lab order</button>
            <button type="button" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50" disabled={busyScope !== null || !labsToAuthor.length} onClick={() => void persistScope('labs', 'finalize')}>
              {busyScope === 'labs' ? 'Finalizing…' : simulation ? 'Finalize simulated lab order' : 'Finalize & issue to patient'}
            </button>
          </div>
        </div>
      )}

      {erxResult ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="font-semibold">{erxResult.scope === 'labs' ? 'Lab order' : 'Prescription'}: {erxResult.status}</div>
          {erxResult.id ? <div className="mt-1">Reference: <span className="font-mono">{erxResult.id}</span></div> : null}
          <div className="mt-1">{simulation ? 'Simulation only · no production patient record or marketplace dispatch' : 'Fulfilment owner: patient · marketplace dispatch: none'}</div>
        </div>
      ) : null}

      {previewScope ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={previewScope === 'medications' ? 'Prescription preview' : 'Lab order review'}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">{previewScope === 'medications' ? 'Prescription preview' : 'Lab order review'}</div>
                <div className="text-xs text-slate-500">Patient: {profile.name || appt.patientName} · Clinician: {appt.clinicianName}</div>
              </div>
              <button type="button" className="rounded border px-3 py-1 text-sm" onClick={() => setPreviewScope(null)}>Close</button>
            </div>
            {simulation ? <div className="my-3 rounded border-2 border-rose-300 bg-rose-50 p-3 text-center text-xs font-bold text-rose-800">SIMULATION — NOT FOR DISPENSING / NOT FOR CLINICAL FULFILMENT</div> : null}
            <div className="mt-4 space-y-3">
              {previewScope === 'medications' ? medsToAuthor.map((row, index) => (
                <div key={index} className="rounded-xl border p-3 text-sm">
                  <div className="font-semibold">{row.drug} {row.strength} {row.form}</div>
                  <div className="mt-1 text-slate-700">Dose: {row.dose || '—'} · Route: {row.route || '—'} · Frequency: {row.freq || '—'}</div>
                  <div className="mt-1 text-slate-700">Duration: {row.duration || '—'} · Quantity: {row.qty || '—'} · Repeats: {row.refills}</div>
                  {row.notes ? <div className="mt-1 text-slate-600">Directions/notes: {row.notes}</div> : null}
                  {row.rxcui || row.nappi ? <div className="mt-1 text-[11px] text-slate-500">{row.rxcui ? `RxCUI:${row.rxcui}` : ''}{row.rxcui && row.nappi ? ' · ' : ''}{row.nappi ? `NAPPI:${row.nappi}` : ''}</div> : null}
                </div>
              )) : labsToAuthor.map((row, index) => (
                <div key={index} className="rounded-xl border p-3 text-sm">
                  <div className="font-semibold">{row.test}</div>
                  <div className="mt-1 text-slate-700">Priority: {row.priority || 'Routine'} · Specimen: {row.specimen || '—'}</div>
                  {row.icd ? <div className="mt-1 text-slate-700">Clinical indication / ICD-10: {row.icd}</div> : null}
                  {row.instructions ? <div className="mt-1 text-slate-600">Instructions: {row.instructions}</div> : null}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{simulation ? 'Simulation preview only. Finalizing remains inside this training session and does not issue to a production patient record or trigger CarePort/MedReach.' : "Finalizing issues this clinician-authored order to the patient's record only. CarePort/MedReach discovery is a later patient-owned action."}</div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/* ---------- Medicine catalogue combobox for eRx drug field ---------- */

type RxDrugInputProps = {
  row: RxRow;
  onChange: (row: RxRow) => void;
};

function RxDrugInput({ row, onChange }: RxDrugInputProps) {
  const auto = useAutocomplete<RxNormHit>(rxnormSearch);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const opts = auto.opts as RxNormHit[];
  const flat: RxNormHit[] = opts;
  const activeHit = active >= 0 && active < flat.length ? flat[active] : null;

  const select = (hit: RxNormHit) => {
    const label = hit.name || hit.title || '';
    const inferred = inferStrengthAndForm(label);
    const base: RxRow = {
      ...row,
      drug: label,
      rxcui: hit.rxcui || (hit as any).rxnorm,
      nappi: (hit as any).nappi || row.nappi,
      strength: row.strength || (hit as any).strength || inferred.strength || '',
      form: row.form || (hit as any).doseForm || (hit as any).dosageForm || inferred.form || '',
      dose: row.dose,
      route: row.route || (hit as any).route || row.route,
      notes:
        row.notes ||
        [
          (hit as any).nappi ? `NAPPI:${(hit as any).nappi}` : '',
          (hit.rxcui || (hit as any).rxnorm) ? `RxCUI:${hit.rxcui || (hit as any).rxnorm}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
    };
    onChange(base);
    auto.setQ(label);
    setOpen(false);
    setActive(-1);

    if (hit.rxcui) {
      sigsForRxCui(hit.rxcui)
        .then((sigs) => {
          if (Array.isArray(sigs) && sigs.length) {
            onChange({ ...base, sigSuggestions: sigs });
          }
        })
        .catch(() => {});
    }
  };

  const handleChange = (v: string) => {
    auto.setQ(v);
    setOpen(true);
    setActive(-1);
    onChange({ ...row, drug: v, rxcui: undefined, nappi: undefined, strength: '', form: '', sigSuggestions: [] });
  };

  return (
    <div className="relative">
      <input
        className="border rounded px-2 py-1 w-full"
        role="combobox"
        aria-expanded={open}
        aria-controls="medicine-listbox"
        aria-autocomplete="list"
        value={auto.q || row.drug}
        placeholder="Drug (start typing…)"
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (flat.length) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!flat.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => {
              const next = a + 1;
              return next >= flat.length ? flat.length - 1 : next;
            });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a <= 0 ? 0 : a - 1));
          } else if (e.key === 'Enter') {
            if (open && activeHit) {
              e.preventDefault();
              select(activeHit);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={(e) => {
          setTimeout(() => setOpen(false), 120);
          const v = e.currentTarget.value.trim();
          if (!v || !flat.length) return;
          const norm = v.toLowerCase();
          const picked =
            flat.find((o) => (o.name || '').toLowerCase() === norm) ||
            flat.find((o) =>
              (o.name || '').toLowerCase().startsWith(norm)
            );
          if (picked) select(picked);
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {open && flat.length > 0 && (
        <ul
          id="medicine-listbox"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded border bg-white shadow text-sm"
        >
          {flat.map((hit, idx) => {
            const group =
              hit.tty === 'IN' || hit.tty === 'MIN'
                ? 'Generic / Ingredient'
                : 'Clinical drug';

            const prev = idx > 0 ? flat[idx - 1] : null;
            const prevGroup =
              prev && (prev.tty === 'IN' || prev.tty === 'MIN')
                ? 'Generic / Ingredient'
                : 'Clinical drug';
            const showHeader = idx === 0 || prevGroup !== group;

            return (
              <li key={`${hit.rxcui}-${idx}`} className="px-0 py-0">
                {showHeader && (
                  <div className="px-2 pt-1 text-[11px] text-gray-500 uppercase">
                    {group}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  className={`w-full text-left px-2 py-1 cursor-pointer ${
                    idx === active ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => select(hit)}
                >
                  <div className="flex justify-between">
                    <span>{hit.name}</span>
                    {(hit as any).strength && (
                      <span className="ml-2 text-xs text-gray-500">
                        {(hit as any).strength}
                      </span>
                    )}
                  </div>
                  {((hit as any).doseForm || (hit as any).route) && (
                    <div className="text-[11px] text-gray-500">
                      {[(hit as any).doseForm, (hit as any).route]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                  {(hit as any).genericName &&
                    (hit as any).genericName !== hit.name && (
                      <div className="text-[11px] text-gray-400">
                        Generic: {(hit as any).genericName}
                      </div>
                    )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Laboratory catalogue combobox ---------- */

type LabTestInputProps = {
  row: LabRow;
  onChange: (row: LabRow) => void;
};

function LabTestInput({ row, onChange }: LabTestInputProps) {
  const auto = useAutocomplete<LabTestHit>(labTestSearch);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const options = auto.opts as LabTestHit[];

  const select = (hit: LabTestHit) => {
    const name = String(hit.name || hit.label || '').trim();
    const specimen = String(hit.specimen || '').trim();
    onChange({
      ...row,
      test: name,
      specimen: row.specimen || specimen,
      catalogCode: String(hit.code || hit.id || '').trim() || undefined,
      catalogSystem: String(hit.codeSystem || 'local_sa_lab_catalog').trim(),
    });
    auto.setQ(name);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <input
        className="border rounded px-2 py-1 w-full"
        role="combobox"
        aria-expanded={open}
        aria-controls="lab-test-listbox"
        aria-autocomplete="list"
        placeholder="Test name (e.g. FBC, U&E, HbA1c, CRP)"
        value={auto.q || row.test}
        onChange={(event) => {
          const value = event.target.value;
          auto.setQ(value);
          onChange({
            ...row,
            test: value,
            catalogCode: undefined,
            catalogSystem: undefined,
          });
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => {
          if (options.length) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!options.length) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((value) => Math.min(options.length - 1, value + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => Math.max(0, value - 1));
          } else if (event.key === 'Enter' && open && active >= 0) {
            event.preventDefault();
            select(options[active]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        autoComplete="off"
      />

      {row.catalogCode ? (
        <div className="mt-1 text-[11px] text-slate-500">
          Catalogue: <span className="font-mono">{row.catalogSystem}:{row.catalogCode}</span>
          {row.specimen ? ` · specimen ${row.specimen}` : ''}
        </div>
      ) : null}

      {open && options.length ? (
        <ul
          id="lab-test-listbox"
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded border bg-white shadow text-sm"
        >
          {options.map((hit, index) => (
            <li key={`${hit.code || hit.id || hit.name}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(hit)}
                className={`w-full px-2 py-2 text-left ${index === active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <div className="font-medium text-slate-900">{hit.name || hit.label}</div>
                <div className="text-[11px] text-slate-500">
                  {[hit.codeSystem && hit.code ? `${hit.codeSystem}:${hit.code}` : null, hit.category, hit.specimen]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- Small ICD-10 combobox (for Lab ICD field) ---------- */

type Icd10InputProps = {
  value: string;
  onChange: (code: string, label: string) => void;
  placeholder?: string;
};

function Icd10Input({ value, onChange, placeholder }: Icd10InputProps) {
  const auto = useAutocomplete<ICD10Hit>(icdSearch);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const opts = auto.opts.map((h) => ({
    code: h.code,
    label: `${h.code} — ${h.title}`,
  }));
  const display = value;

  return (
    <div className="relative">
      <input
        className="border rounded px-2 py-1 w-full"
        role="combobox"
        aria-expanded={open}
        aria-controls="icd10-lab-listbox"
        aria-autocomplete="list"
        value={auto.q || display}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          auto.setQ(v);
          setOpen(true);
          setActive(-1);
          onChange('', v);
        }}
        onFocus={() => {
          if (opts.length) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!opts.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => {
              const next = a + 1;
              return next >= opts.length ? opts.length - 1 : next;
            });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a <= 0 ? 0 : a - 1));
          } else if (e.key === 'Enter') {
            if (open && active >= 0 && active < opts.length) {
              e.preventDefault();
              const o = opts[active];
              auto.setQ(o.label);
              onChange(o.code, o.label);
              setOpen(false);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={(e) => {
          setTimeout(() => setOpen(false), 120);
          const v = e.currentTarget.value.trim();
          if (!v) return;
          const norm = v.toLowerCase();
          const found =
            opts.find((o) => o.code.toLowerCase() === norm) ||
            opts.find((o) => o.label.toLowerCase().startsWith(norm));
          if (found) {
            onChange(found.code, found.label);
          }
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      {open && opts.length > 0 && (
        <ul
          id="icd10-lab-listbox"
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow text-sm"
        >
          {opts.map((o, idx) => (
            <li
              key={o.code + idx}
              role="option"
              aria-selected={idx === active}
              className={`px-2 py-1 cursor-pointer ${
                idx === active ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onMouseDown={(ev) => ev.preventDefault()}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  auto.setQ(o.label);
                  onChange(o.code, o.label);
                  setOpen(false);
                }}
              >
                <span className="font-mono text-xs mr-1">{o.code}</span>
                <span>
                  {o.label.replace(/^([A-Z0-9.]+)\s+—\s*/, '')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}