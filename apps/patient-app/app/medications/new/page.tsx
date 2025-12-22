// apps/patient-app/app/medications/new/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '../../../components/toast';

type Drug = { name: string; strengths: string[] };
type Mode = 'choose' | 'manual' | 'sync';
type ManualKind = 'otc' | 'external_erx';
type MedicationStatus = 'Active' | 'Completed' | 'On Hold';

const DRUGS: Drug[] = [
  { name: 'Amoxicillin', strengths: ['250 mg', '500 mg'] },
  { name: 'Paracetamol', strengths: ['500 mg', '1 g'] },
  { name: 'Ibuprofen', strengths: ['200 mg', '400 mg'] },
  { name: 'Atorvastatin', strengths: ['10 mg', '20 mg', '40 mg'] },
  { name: 'Metformin', strengths: ['500 mg', '850 mg', '1 g'] },
];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  const raw = await res.text().catch(() => '');
  const data = raw ? safeJsonParse(raw) : null;

  return { res, data };
}

function PillBtn(props: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={cx(
        'inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-extrabold transition',
        props.active
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        props.disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {props.children}
    </button>
  );
}

export default function NewMedicationPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('choose');
  const [manualKind, setManualKind] = useState<ManualKind>('otc');

  // Search/select (used in manual flows)
  const [query, setQuery] = useState('');
  const [drug, setDrug] = useState<Drug | null>(null);
  const [strength, setStrength] = useState('');

  // Shared fields
  const [sig, setSig] = useState('');
  const [status, setStatus] = useState<MedicationStatus>('Active');
  const [started, setStarted] = useState(''); // yyyy-mm-dd
  const [durationDays, setDurationDays] = useState('');
  const [notes, setNotes] = useState('');

  // OTC extras
  const [brand, setBrand] = useState('');
  const [reason, setReason] = useState('');

  // External eRx extras
  const [rxNumber, setRxNumber] = useState('');
  const [pharmacy, setPharmacy] = useState('');
  const [showClinician, setShowClinician] = useState(true);
  const [clinName, setClinName] = useState('');
  const [clinPractice, setClinPractice] = useState('');
  const [clinRegNo, setClinRegNo] = useState('');
  const [clinPhone, setClinPhone] = useState('');
  const [clinEmail, setClinEmail] = useState('');

  // Sync from Ambulant+ eRx
  const [encounterId, setEncounterId] = useState('');

  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DRUGS;
    return DRUGS.filter((d) => d.name.toLowerCase().includes(q));
  }, [query]);

  const drugName = useMemo(() => {
    return (drug?.name ?? query.trim()).trim();
  }, [drug, query]);

  const needsSig = manualKind === 'external_erx';

  function resetDrugPick(nextQuery?: string) {
    setDrug(null);
    setStrength('');
    if (typeof nextQuery === 'string') setQuery(nextQuery);
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!drugName) {
      toast('Medication name is required', { type: 'error' });
      return;
    }
    if (needsSig && !sig.trim()) {
      toast('Directions (SIG) are required for external prescriptions', { type: 'error' });
      return;
    }

    setBusy(true);
    try {
      // We store:
      // - dose -> strength
      // - frequency -> sig (patient-friendly, still works with your print table)
      // - started -> ISO if provided
      // - source -> manual_otc | manual_erx_external
      // - meta -> richer info (brand, reason, rx, clinician details, notes)
      const payload: any = {
        name: drugName,
        dose: strength?.trim() || null,
        frequency: sig?.trim() || null,
        route: null,
        started: started ? new Date(started).toISOString() : null,
        durationDays: durationDays ? Number(durationDays) : null,
        status,
        source: manualKind === 'otc' ? 'manual_otc' : 'manual_erx_external',
        meta: {
          notes: notes.trim() || null,
          ...(manualKind === 'otc'
            ? {
                otc: true,
                brand: brand.trim() || null,
                reason: reason.trim() || null,
              }
            : {
                outsideAmbulant: true,
                rxNumber: rxNumber.trim() || null,
                pharmacy: pharmacy.trim() || null,
                clinician:
                  showClinician &&
                  (clinName.trim() ||
                    clinPractice.trim() ||
                    clinRegNo.trim() ||
                    clinPhone.trim() ||
                    clinEmail.trim())
                    ? {
                        name: clinName.trim() || null,
                        practice: clinPractice.trim() || null,
                        regNo: clinRegNo.trim() || null,
                        phone: clinPhone.trim() || null,
                        email: clinEmail.trim() || null,
                      }
                    : null,
              }),
        },
      };

      const { res, data } = await postJson('/api/medications', payload);

      // Accept both:
      // 1) { ok: true }
      // 2) any 2xx response with object
      if (!res.ok || (data && typeof data === 'object' && (data as any).ok === false)) {
        const msg =
          (data && typeof data === 'object' && ((data as any).error || (data as any).message)) ||
          'Could not save medication';
        toast(String(msg), { type: 'error' });
        return;
      }

      toast('Medication saved', { type: 'success' });
      router.push('/medications');
      router.refresh();
    } catch {
      toast('Network error saving medication', { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function syncFromErx(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      const body = { encounterId: encounterId.trim() || null };

      // Try common endpoints (safe best-effort)
      const endpoints = ['/api/medications/sync-erx', '/api/medications/sync'];
      let lastErr = 'Sync endpoint not found';

      for (const url of endpoints) {
        const { res, data } = await postJson(url, body);

        if (res.ok && !(data && typeof data === 'object' && (data as any).ok === false)) {
          toast('Synced eRx medications', { type: 'success' });
          router.push('/medications');
          router.refresh();
          return;
        }

        const msg =
          (data && typeof data === 'object' && ((data as any).error || (data as any).message)) ||
          (res.ok ? 'Sync failed' : `Sync failed (${res.status})`);

        lastErr = String(msg);

        // If not 404, stop trying others
        if (res.status && res.status !== 404) break;
      }

      toast(
        `${lastErr}. If your repo already has a different sync route, wire this button to it.`,
        { type: 'error' },
      );
    } catch {
      toast('Network error syncing eRx', { type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-6">
        <div className="text-xs font-bold text-slate-600">Medications</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Add medication</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add an OTC item, record an external prescription (outside Ambulant+), or sync from Ambulant+ eRx.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/medications"
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm"
          >
            Back to list
          </Link>
          <Link
            href="/medications/print"
            className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm"
          >
            Print summary
          </Link>
        </div>
      </div>

      {mode === 'choose' ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setMode('manual');
              setManualKind('otc');
            }}
            className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm shadow-black/[0.03] text-left hover:bg-slate-50 transition"
          >
            <div className="text-sm font-black text-slate-900">Manual entry</div>
            <div className="text-xs text-slate-600">
              Split into <span className="font-bold">OTC</span> and{' '}
              <span className="font-bold">External eRx</span> (outside Ambulant+).
            </div>
            <div className="pt-1 flex gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
                OTC
              </span>
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">
                External eRx
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('sync')}
            className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm shadow-black/[0.03] text-left hover:bg-slate-50 transition"
          >
            <div className="text-sm font-black text-slate-900">Sync from Ambulant+ eRx</div>
            <div className="text-xs text-slate-600">
              Pull prescribed meds from your Ambulant+ encounter(s).
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-800">
                Recommended
              </span>
            </div>
          </button>
        </section>
      ) : null}

      {mode === 'manual' ? (
        <>
          {/* manual kind toggle */}
          <section className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm shadow-black/[0.03]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-black text-slate-900">Manual entry</div>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm"
                disabled={busy}
              >
                Back
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <PillBtn
                active={manualKind === 'otc'}
                onClick={() => setManualKind('otc')}
                disabled={busy}
              >
                OTC (over-the-counter)
              </PillBtn>
              <PillBtn
                active={manualKind === 'external_erx'}
                onClick={() => setManualKind('external_erx')}
                disabled={busy}
              >
                eRx outside Ambulant+
              </PillBtn>
            </div>

            <div className="text-xs text-slate-600">
              {manualKind === 'otc'
                ? 'OTC items are patient-reported; clinicians can reconcile later.'
                : 'External eRx: record a prescription you got outside Ambulant+ (optional clinician details).'}
            </div>
          </section>

          {/* drug search/select */}
          <section className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-sm shadow-black/[0.03]">
            <label className="block text-sm font-bold text-slate-800">Search medication</label>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDrug(null);
                setStrength('');
              }}
              placeholder="Type to search (e.g., Paracetamol)…"
              className={cx(
                'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400',
              )}
              disabled={busy}
            />

            {query ? (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="p-3 text-sm text-slate-600">
                    No matches — you can still free-type.
                  </div>
                ) : (
                  filtered.slice(0, 8).map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => {
                        setDrug(d);
                        setQuery(d.name);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm font-semibold text-slate-800"
                      disabled={busy}
                    >
                      {d.name}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="text-xs text-slate-500">
              Tip: if you don’t see it, type the full medication name and proceed.
            </div>
          </section>

          {/* manual form */}
          <form
            onSubmit={saveManual}
            className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm shadow-black/[0.03]"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800">Medication name *</label>
                <input
                  value={query}
                  onChange={(e) => {
                    resetDrugPick(e.target.value);
                  }}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  disabled={busy}
                />
                {drug ? <div className="text-xs text-slate-500 mt-1">Selected from list</div> : null}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800">Strength / dose</label>
                {drug ? (
                  <select
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    disabled={busy}
                  >
                    <option value="">— choose —</option>
                    {drug.strengths.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g., 500 mg"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    disabled={busy}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800">
                Directions (SIG){needsSig ? ' *' : ''}
              </label>
              <input
                value={sig}
                onChange={(e) => setSig(e.target.value)}
                placeholder="e.g., 1 tablet twice daily with meals"
                className={cx(
                  'mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400',
                )}
                disabled={busy}
              />
              {needsSig ? (
                <div className="text-xs text-slate-500 mt-1">Required for external eRx entries.</div>
              ) : (
                <div className="text-xs text-slate-500 mt-1">Optional for OTC entries.</div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MedicationStatus)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  disabled={busy}
                >
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800">Start date</label>
                <input
                  type="date"
                  value={started}
                  onChange={(e) => setStarted(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  disabled={busy}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800">Duration (days)</label>
                <input
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  placeholder="e.g., 7"
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  disabled={busy}
                />
              </div>
            </div>

            {manualKind === 'otc' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-sm font-black text-slate-900">OTC details (optional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-800">Brand / product</label>
                    <input
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g., Panado"
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800">Reason</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g., Headache"
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      disabled={busy}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <div className="text-sm font-black text-slate-900">
                  External prescription details (optional)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-800">Rx number</label>
                    <input
                      value={rxNumber}
                      onChange={(e) => setRxNumber(e.target.value)}
                      placeholder="Script / Rx number"
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      disabled={busy}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800">Pharmacy</label>
                    <input
                      value={pharmacy}
                      onChange={(e) => setPharmacy(e.target.value)}
                      placeholder="Where it was dispensed"
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      disabled={busy}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={showClinician}
                    onChange={(e) => setShowClinician(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                    disabled={busy}
                  />
                  Add prescribing clinician details (optional)
                </label>

                {showClinician ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-800">Clinician name</label>
                      <input
                        value={clinName}
                        onChange={(e) => setClinName(e.target.value)}
                        placeholder="Full name"
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800">Practice / facility</label>
                      <input
                        value={clinPractice}
                        onChange={(e) => setClinPractice(e.target.value)}
                        placeholder="Clinic / hospital"
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800">Reg no. (HPCSA / etc)</label>
                      <input
                        value={clinRegNo}
                        onChange={(e) => setClinRegNo(e.target.value)}
                        placeholder="Registration number"
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        disabled={busy}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800">Phone</label>
                      <input
                        value={clinPhone}
                        onChange={(e) => setClinPhone(e.target.value)}
                        placeholder="+27…"
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        disabled={busy}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-bold text-slate-800">Email</label>
                      <input
                        value={clinEmail}
                        onChange={(e) => setClinEmail(e.target.value)}
                        placeholder="clinician@practice.com"
                        className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        disabled={busy}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-800">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any warnings, indication, or context…"
                className={cx(
                  'mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400',
                )}
                disabled={busy}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={busy}
                className={cx(
                  'px-5 py-3 rounded-2xl bg-emerald-600 text-white font-extrabold text-sm',
                  'hover:bg-emerald-700 transition disabled:opacity-50',
                )}
              >
                {busy ? 'Saving…' : 'Save medication'}
              </button>

              <button
                type="button"
                onClick={() => history.back()}
                disabled={busy}
                className="px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="text-xs text-slate-500">
              This adds to your medication list. Use “Sync from Ambulant+ eRx” for prescriptions created inside Ambulant+.
            </div>
          </form>
        </>
      ) : null}

      {mode === 'sync' ? (
        <form
          onSubmit={syncFromErx}
          className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm shadow-black/[0.03]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-black text-slate-900">Sync from Ambulant+ eRx</div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="px-4 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm"
              disabled={busy}
            >
              Back
            </button>
          </div>

          <div className="text-sm text-slate-600">
            If you have an encounter ID, paste it below. Otherwise you can try syncing without it (if your API supports it).
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800">Encounter ID (optional)</label>
              <input
                value={encounterId}
                onChange={(e) => setEncounterId(e.target.value)}
                placeholder="Paste encounter/session id"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                disabled={busy}
              />
              <div className="text-xs text-slate-500 mt-1">
                You can copy this from an encounter details page (if available).
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-black text-slate-900">What gets synced?</div>
              <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                Medications prescribed via Ambulant+ eRx are imported into your list, including encounter context (where supported).
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className={cx(
                'px-5 py-3 rounded-2xl bg-slate-950 text-white font-extrabold text-sm',
                'hover:bg-slate-900 transition disabled:opacity-50',
              )}
            >
              {busy ? 'Syncing…' : 'Sync now'}
            </button>

            <button
              type="button"
              onClick={() => setMode('manual')}
              disabled={busy}
              className="px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm disabled:opacity-50"
            >
              Manual entry instead
            </button>
          </div>

          <div className="text-xs text-slate-500">
            If your sync route is different, tell me the existing endpoint and I’ll wire this button to it.
          </div>
        </form>
      ) : null}
    </main>
  );
}
