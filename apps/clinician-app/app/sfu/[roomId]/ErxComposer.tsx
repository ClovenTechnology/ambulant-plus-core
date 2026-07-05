// apps/clinician-app/app/sfu/[roomId]/ErxComposer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { BuildSendToPayerInput } from '@/lib/sendToPayer';

type ToastKind = 'info' | 'success' | 'warning' | 'error';

export type SoapState = {
  s: string;
  o: string;
  a: string;
  p: string;
  icd10Code?: string;
};

type RxRow = {
  drug: string;
  dose: string;
  route: string;
  freq: string;
  duration: string;
  qty: string;
  refills: number;
  notes?: string;
  rxcui?: string;
  sigSuggestions?: string[];
};

type LabRow = {
  test: string;
  priority: '' | 'Routine' | 'Urgent' | 'Stat';
  specimen: string;
  icd: string;
  instructions?: string;
};

export type ErxSummaryMed = {
  drug: string;
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
};
export type ErxSummary = {
  meds: ErxSummaryMed[];
  labs: ErxSummaryLab[];
};

// Tiny parser for sig strings like "500 mg PO TID x7d"
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

const LOCAL_ICD10_SUGGESTIONS: string[] = [
  'J20.9 — Acute bronchitis, unspecified',
  'R50.9 — Fever, unspecified',
  'R05.9 — Cough, unspecified',
  'I10 — Essential (primary) hypertension',
  'E11.9 — Type 2 diabetes mellitus without complications',
];

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
  icd10Suggestions?: string[];
  onToast: (body: string, kind?: ToastKind, title?: string) => void;
  onAudit: (action: string, extra?: Record<string, unknown>) => void;
  onSummaryChange?: (summary: ErxSummary) => void;
};

type ErxResult = { id: string; status: string; dispenseCode: string; error?: string };

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
  icd10Suggestions,
  onToast,
  onAudit,
  onSummaryChange,
}: ErxComposerProps) {
  const [rxRows, setRxRows] = useState<RxRow[]>([
    { drug: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0 },
  ]);
  const [labRows, setLabRows] = useState<LabRow[]>([
    { test: '', priority: '', specimen: '', icd: '', instructions: '' },
  ]);

  const [erxResult, setErxResult] = useState<ErxResult | null>(null);
  const [erxSubmitting, setErxSubmitting] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const [operational, setOperational] = useState<null | {
    canPrescribe?: boolean;
    prescribingMode?: 'no' | 'conditional' | 'yes';
    maxRxSchedule?: number | null;
    blockers?: string[];
    riskFlags?: string[];
  }>(null);

  const erxLabs: LabRow[] = useMemo(
    () => labRows.filter((l) => (l.test || '').trim().length > 0),
    [labRows]
  );

  function normalizeForMatch(value: unknown) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function isActiveAllergy(a: PatientAllergyBrief) {
    const s = normalizeForMatch(a.status);
    if (!s) return true;
    if (s.includes('entered in error')) return false;
    if (s.includes('resolved') || s.includes('inactive')) return false;
    return true;
  }

  function isSevereAllergy(a: PatientAllergyBrief) {
    const s = normalizeForMatch(a.severity);
    return s.includes('severe') || s.includes('critical') || s.includes('high');
  }

  const allergyConflictsForRows = (rows: RxRow[]) => {
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
  };

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


  useEffect(() => {
    let alive = true;

    async function loadOperational() {
      try {
        const res = await fetch('/api/me', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });

        const js = await res.json().catch(() => null as any);
        if (!alive) return;

        const nextOperational =
          js?.clinician?.operational && typeof js.clinician.operational === 'object'
            ? js.clinician.operational
            : js?.clinician?.activation && typeof js.clinician.activation === 'object'
              ? js.clinician.activation
              : null;

        setOperational(nextOperational);
      } catch {
        if (!alive) return;
        setOperational(null);
      }
    }

    void loadOperational();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!onSummaryChange) return;
    const meds = rxRows
      .filter((r) => (r.drug || '').trim())
      .map<ErxSummaryMed>((r) => ({
        drug: r.drug,
        dose: r.dose || undefined,
        route: r.route || undefined,
        freq: r.freq || undefined,
        duration: r.duration || undefined,
      }));
    const labs = erxLabs.map<ErxSummaryLab>((l) => ({
      test: l.test,
      priority: l.priority || undefined,
      specimen: l.specimen || undefined,
      icd: l.icd || undefined,
    }));
    onSummaryChange({ meds, labs });
  }, [rxRows, erxLabs, onSummaryChange]);

  const addRxRow = () =>
    setRxRows((r) => [
      ...r,
      { drug: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0 },
    ]);
  const removeRxRow = (i: number) =>
    setRxRows((r) => r.filter((_, j) => j !== i));

  const addLabRow = () =>
    setLabRows((r) => [
      ...r,
      { test: '', priority: '', specimen: '', icd: '', instructions: '' },
    ]);
  const removeLabRow = (i: number) =>
    setLabRows((r) => r.filter((_, j) => j !== i));

  function extractMaxScheduleFromRows(rows: RxRow[]) {
    let maxFound: number | null = null;
    for (const row of rows) {
      const text = `${row.drug || ''} ${row.notes || ''} ${row.freq || ''} ${row.duration || ''}`.toLowerCase();
      const m = text.match(/schedule\s*([1-8])/i);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) {
          maxFound = maxFound == null ? n : Math.max(maxFound, n);
        }
      }
    }
    return maxFound;
  }

  const sendErx = async () => {
    const medsToSend = rxRows.filter((r) => r.drug && r.drug.trim().length > 0);
    const labsToSend = labRows.filter((l) => l.test && l.test.trim().length > 0);

    if (operational?.canPrescribe === false) {
      onToast(
        'You are not currently cleared to prescribe on Ambulant+.',
        'error',
        'Prescribing blocked'
      );
      onAudit('erx.send.blocked', {
        reason: 'canPrescribe_false',
        blockers: operational?.blockers ?? [],
        riskFlags: operational?.riskFlags ?? [],
      });
      return;
    }

    const requestedMaxSchedule = extractMaxScheduleFromRows(medsToSend);
    if (
      requestedMaxSchedule != null &&
      typeof operational?.maxRxSchedule === 'number' &&
      requestedMaxSchedule > operational.maxRxSchedule
    ) {
      onToast(
        `This prescription exceeds your current prescribing authority (max schedule ${operational.maxRxSchedule}).`,
        'error',
        'Prescribing limit exceeded'
      );
      onAudit('erx.send.blocked', {
        reason: 'max_schedule_exceeded',
        requestedMaxSchedule,
        maxRxSchedule: operational.maxRxSchedule,
      });
      return;
    }

    if (!encounterId) {
      onToast('Cannot send eRx: encounterId is missing in the URL.', 'error', 'eRx error');
      return;
    }

    if (medsToSend.length === 0 && labsToSend.length === 0) {
      onToast(
        'Add at least one medication or lab request before sending eRx.',
        'warning',
        'Nothing to send'
      );
      return;
    }

    const allergyConflicts = allergyConflictsForRows(medsToSend);
    const hasCollision = allergyConflicts.length > 0;

    if (hasCollision) {
      onToast(
        `Prescription blocked: ${allergyConflicts[0].drug} conflicts with recorded allergy ${allergyConflicts[0].substance}.`,
        'error',
        'Allergy conflict'
      );

      onAudit('erx.send.blocked', {
        reason: 'ALLERGY_CONFLICT',
        conflicts: allergyConflicts,
        allergySource: allergiesFromLive ? 'live' : 'manual',
      });

      return;
    }

    setErxSubmitting(true);
    try {
      const payload = {
        encounterId,
        patientId,
        patientName: profile.name || appt.patientName,
        clinicianId,
        clinicianName: appt.clinicianName,
        reason: appt.reason,
        medications: medsToSend,
        labs: labsToSend,
        allergies: (patientAllergies || []).map((a) => ({
          substance: a.substance,
          severity: a.severity,
          reaction: a.reaction,
          status: a.status,
        })),
        note: soap.p || '',
        authorization: {
          canPrescribe: operational?.canPrescribe ?? null,
          prescribingMode: operational?.prescribingMode ?? null,
          maxRxSchedule: operational?.maxRxSchedule ?? null,
          blockers: operational?.blockers ?? [],
          riskFlags: operational?.riskFlags ?? [],
        },
      };

      const res = await fetch(
        `/api/encounters/${encodeURIComponent(encounterId)}/erx`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const js = await res.json().catch(() => null as any);

      if (!res.ok) {
        const msg =
          (js as any)?.message || (js as any)?.error || `HTTP ${res.status}`;
        setErxResult({
          id: String((js as any)?.id ?? (js as any)?.erxId ?? ''),
          status: 'Error',
          dispenseCode: String(
            (js as any)?.dispenseCode ?? (js as any)?.code ?? ''
          ),
          error: msg,
        });
        onToast(`Failed to send eRx: ${msg}`, 'error', 'eRx error');
        onAudit('erx.send.error', {
          rxCount: medsToSend.length,
          labCount: labsToSend.length,
          allergyCollision: hasCollision,
          allergySource: allergiesFromLive ? 'live' : 'manual',
          statusCode: res.status,
          message: msg,
        });
        return;
      }

      const erx: ErxResult = {
        id: String((js as any)?.id ?? (js as any)?.erxId ?? ''),
        status: (js as any)?.status || 'Created',
        dispenseCode: String(
          (js as any)?.dispenseCode ?? (js as any)?.code ?? 'Pending'
        ),
      };
      setErxResult(erx);

      onToast('eRx submitted for this encounter.', 'success', 'eRx sent');
      onAudit('erx.send', {
        rxCount: medsToSend.length,
        labCount: labsToSend.length,
        allergyCollision: hasCollision,
        allergySource: allergiesFromLive ? 'live' : 'manual',
        erxId: erx.id,
        status: erx.status,
        authorization: {
          canPrescribe: operational?.canPrescribe ?? null,
          prescribingMode: operational?.prescribingMode ?? null,
          maxRxSchedule: operational?.maxRxSchedule ?? null,
        },
      });
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      setErxResult({
        id: '',
        status: 'Error',
        dispenseCode: '',
        error: msg,
      });
      onToast('Failed to send eRx.', 'error', 'eRx error');
      onAudit('erx.send.error', {
        rxCount: rxRows.length,
        labCount: labRows.length,
        allergyCollision: hasCollision,
        allergySource: allergiesFromLive ? 'live' : 'manual',
        message: msg,
      });
    } finally {
      setErxSubmitting(false);
    }
  };

  const sendClaimToPayer = async () => {
    const medsToSend = rxRows.filter((r) => r.drug && r.drug.trim().length > 0);
    const labsToSend = erxLabs;

    if (!encounterId) {
      onToast('Cannot send claim: encounterId is missing in the URL.', 'error', 'Claim error');
      return;
    }

    if (medsToSend.length === 0 && labsToSend.length === 0) {
      onToast(
        'Nothing billable yet. Add at least one medication or lab test before sending a claim.',
        'warning',
        'No billable items'
      );
      return;
    }

    const payload: BuildSendToPayerInput = {
      encounterId,
      patient: {
        id: profile.id,
        name: profile.name,
        dob: profile.dob ?? null,
        gender: profile.gender ?? null,
      },
      clinician: {
        id: clinicianId,
        name: appt.clinicianName,
      },
      diagnoses: {
        code: soap.icd10Code || undefined,
        text: soap.a || appt.reason || 'Unspecified diagnosis',
      },
      meds: medsToSend.map((r) => ({
        drug: r.drug,
        dose: r.dose,
        route: r.route,
        freq: r.freq,
        duration: r.duration,
        qty: r.qty,
        refills: r.refills,
        icd10: undefined,
        unitPriceZar: null,
      })),
      labs: labsToSend.map((l) => ({
        test: l.test,
        priority: l.priority,
        specimen: l.specimen,
        icd: l.icd,
        instructions: l.instructions,
        unitPriceZar: null,
      })),
      startedAt: appt.when,
      endedAt: new Date().toISOString(),
      notes: soap.p || null,
    };

    setClaimSubmitting(true);
    try {
      const res = await fetch('/api/gateway/send-to-payer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const js: any = await res.json().catch(() => null);

      if (!res.ok || !js?.ok) {
        const msg = js?.error || js?.message || `HTTP ${res.status}`;
        onToast(
          `Failed to send claim to payer: ${msg}`,
          'error',
          'Claim error'
        );
        onAudit('claim.send.error', {
          encounterId,
          rxCount: medsToSend.length,
          labCount: labsToSend.length,
          statusCode: res.status,
          gatewayResponse: js,
        });
        return;
      }

      onToast('Claim submitted to payer.', 'success', 'Claim sent');
      onAudit('claim.send', {
        encounterId,
        rxCount: medsToSend.length,
        labCount: labsToSend.length,
        forwarded: js.forwarded ?? true,
      });
    } catch (err: any) {
      onToast('Failed to send claim to payer.', 'error', 'Claim error');
      onAudit('claim.send.error', {
        encounterId,
        message: err?.message || String(err),
      });
    } finally {
      setClaimSubmitting(false);
    }
  };

  const effectiveIcdSuggestions = icd10Suggestions?.length
    ? icd10Suggestions
    : LOCAL_ICD10_SUGGESTIONS;

  const labTestAuto = useAutocomplete<LabTestHit>(labTestSearch);

  return (
    <Card
      title="eRx Composer"
      dense={dense}
      gradient
      toolbar={
        <div className="flex gap-2">
          <button
            className="text-xs px-2 py-1 border rounded disabled:opacity-60"
            onClick={sendErx}
            disabled={erxSubmitting || operational?.canPrescribe === false}
          >
            {erxSubmitting ? 'Sending…' : 'Send eRx'}
          </button>
          <button
            className="text-xs px-2 py-1 border rounded disabled:opacity-60"
            onClick={sendClaimToPayer}
            disabled={claimSubmitting}
          >
            {claimSubmitting ? 'Sending claim…' : 'Send Claim'}
          </button>
        </div>
      }
    >
      {severeAllergies.length > 0 ? (
        <div className="mb-2 rounded border border-rose-300 bg-rose-50 px-2 py-2 text-[11px] text-rose-900">
          <div className="font-semibold">Severe allergy on record</div>
          <div className="mt-1">
            {severeAllergies
              .slice(0, 3)
              .map((a) => `${a.substance}${a.reaction ? ` — ${a.reaction}` : ''}`)
              .join(', ')}
            {severeAllergies.length > 3 ? ` +${severeAllergies.length - 3} more` : ''}
          </div>
        </div>
      ) : null}

      {patientAllergies && patientAllergies.length > 0 ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-900">
          <div className="font-semibold">Recorded allergies</div>
          <div className="mt-1">
            {patientAllergies
              .filter(isActiveAllergy)
              .slice(0, 5)
              .map((a) => {
                const sev = a.severity ? ` (${a.severity})` : '';
                const rxn = a.reaction ? ` — ${a.reaction}` : '';
                return `${a.substance}${sev}${rxn}`;
              })
              .join(', ') || 'No active allergies recorded'}
          </div>
          {recentAllergyReactions.length > 0 ? (
            <div className="mt-1 text-amber-800">
              Recent reactions in last 30 days: {recentAllergyReactions.length}
            </div>
          ) : null}
        </div>
      ) : null}

      {operational?.canPrescribe === false ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          Prescribing is currently disabled for this clinician profile.
        </div>
      ) : null}


      <div className="text-xs text-gray-500 mb-2">
        Add one or more drugs and optional lab tests. This screen authors the encounter record only. Marketplace initiation and payment selection must happen in the patient app.
      </div>

      <datalist id="icd10-suggest">
        {effectiveIcdSuggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Medications */}
      {rxRows.map((r, i) => (
        <div key={i} className="mt-2 space-y-2 border rounded p-2 bg:white bg-white">
          <RxDrugInput
            row={r}
            onChange={(row) =>
              setRxRows((all) => all.map((y, j) => (j === i ? row : y)))
            }
          />

          <div className="grid md:grid-cols-6 gap-2">
            <input
              className="border rounded px-2 py-1"
              placeholder="Dose"
              value={r.dose}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) => (j === i ? { ...y, dose: e.target.value } : y))
                )
              }
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Route"
              value={r.route}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) => (j === i ? { ...y, route: e.target.value } : y))
                )
              }
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Frequency"
              value={r.freq}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) => (j === i ? { ...y, freq: e.target.value } : y))
                )
              }
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Duration"
              value={r.duration}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) =>
                    j === i ? { ...y, duration: e.target.value } : y
                  )
                )
              }
            />
            <input
              className="border rounded px-2 py-1"
              placeholder="Qty"
              value={r.qty}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y))
                )
              }
            />
            <input
              className="border rounded px-2 py-1"
              type="number"
              placeholder="Refills"
              value={r.refills}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) =>
                    j === i
                      ? { ...y, refills: Number(e.target.value) || 0 }
                      : y
                  )
                )
              }
            />
          </div>

          {r.sigSuggestions && r.sigSuggestions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.sigSuggestions.slice(0, 6).map((sugg, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100"
                  onClick={() => {
                    const parsed = parseSig(sugg);
                    setRxRows((rows) =>
                      rows.map((row, j) =>
                        j === i
                          ? {
                              ...row,
                              dose: row.dose || parsed.dose || row.dose,
                              route: row.route || parsed.route || row.route,
                              freq: row.freq || parsed.freq || sugg,
                              duration:
                                row.duration || parsed.duration || row.duration,
                            }
                          : row
                      )
                    );
                  }}
                >
                  {sugg}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-12 gap-2 items-center">
            <input
              className="border rounded px-2 py-1 col-span-10"
              placeholder="Notes (optional)"
              value={r.notes || ''}
              onChange={(e) =>
                setRxRows((x) =>
                  x.map((y, j) =>
                    j === i ? { ...y, notes: e.target.value } : y
                  )
                )
              }
            />
            <div className="col-span-2 flex justify-end">
              <button
                className="px-2 py-1 border rounded text-xs"
                onClick={() => removeRxRow(i)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="pt-2 flex flex-wrap gap-2 items-center">
        <button className="px-2 py-1 border rounded text-xs" onClick={addRxRow}>
          Add drug
        </button>
        <div className="text-[11px] text-gray-500">
          After encounter authoring, the patient must open CarePort or MedReach from the patient app to choose fulfillment mode, sponsor use, and payment method.
        </div>
      </div>

      {/* Laboratory */}
      <div className="text-sm font-semibold mt-4">Laboratory</div>
      <div className="text-xs text-gray-500 mb-1">
        Test name on its own line; then Priority, Specimen, ICD-10 on one row; optional instructions below.
      </div>

      <datalist id="lab-test-catalog-suggest">
        {(labTestAuto.opts as LabTestHit[]).map((hit) => (
          <option
            key={hit.code || hit.id || hit.name}
            value={hit.name}
            label={[hit.category, hit.specimen].filter(Boolean).join(' · ')}
          />
        ))}
      </datalist>

      {labRows.map((r, i) => (
        <div key={i} className="mt-2 space-y-2 border rounded p-2 bg-white">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Test name (e.g. FBC, U&E, HbA1c, CRP)"
            list="lab-test-catalog-suggest"
            value={r.test}
            onChange={(e) => {
              const value = e.target.value;
              labTestAuto.setQ(value);
              setLabRows((x) =>
                x.map((y, j) => (j === i ? { ...y, test: value } : y))
              );
            }}
          />
          <div className="grid md:grid-cols-4 gap-2 items-center">
            <select
              className="border rounded px-2 py-1"
              value={r.priority}
              onChange={(e) =>
                setLabRows((x) =>
                  x.map((y, j) =>
                    j === i
                      ? {
                          ...y,
                          priority: e.target.value as LabRow['priority'],
                        }
                      : y
                  )
                )
              }
            >
              <option value="">Priority</option>
              <option value="Routine">Routine</option>
              <option value="Urgent">Urgent</option>
              <option value="Stat">Stat</option>
            </select>
            <input
              className="border rounded px-2 py-1"
              placeholder="Specimen (e.g., blood, urine)"
              value={r.specimen}
              onChange={(e) =>
                setLabRows((x) =>
                  x.map((y, j) =>
                    j === i ? { ...y, specimen: e.target.value } : y
                  )
                )
              }
            />
            <Icd10Input
              value={r.icd}
              onChange={(code, label) =>
                setLabRows((x) =>
                  x.map((y, j) =>
                    j === i ? { ...y, icd: code || label } : y
                  )
                )
              }
              placeholder="ICD-10 (optional)"
            />
            <div className="flex justify-end">
              <button
                className="px-2 py-1 border rounded text-xs"
                onClick={() => removeLabRow(i)}
              >
                Remove
              </button>
            </div>
          </div>
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Instructions / clinical info (optional)"
            value={r.instructions || ''}
            onChange={(e) =>
              setLabRows((x) =>
                x.map((y, j) =>
                  j === i ? { ...y, instructions: e.target.value } : y
                )
              )
            }
          />
        </div>
      ))}

      <div className="pt-2 flex flex-wrap gap-2">
        <button className="px-2 py-1 border rounded text-xs" onClick={addLabRow}>
          Add test
        </button>
      </div>

      {erxResult && (
        <div className="mt-3 border rounded p-3 bg-white text-sm">
          {erxResult.error ? (
            <div className="text-red-600">
              <div className="font-semibold mb-1">eRx Error</div>
              <div>{erxResult.error}</div>
              {erxResult.id && (
                <div className="mt-1 text-xs text-gray-600">
                  eRx ID (from server):{' '}
                  <span className="font-mono">{erxResult.id}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                eRx ID: <b>{erxResult.id}</b>
              </div>
              <div>
                Status: <b>{erxResult.status}</b>
              </div>
              <div>
                Dispense Code: <b>{erxResult.dispenseCode}</b>
              </div>
            </>
          )}
        </div>
      )}
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
    const base: RxRow = {
      ...row,
      drug: label,
      rxcui: hit.rxcui,
      dose: row.dose || (hit as any).strength || row.dose,
      route: row.route || (hit as any).route || row.route,
      notes: row.notes || (hit.rxcui ? `RxCUI:${hit.rxcui}` : row.notes),
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
    onChange({ ...row, drug: v, rxcui: undefined, sigSuggestions: [] });
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