// apps/clinician-app/app/encounters/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';

const CLIN = (
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://clinician.ambulantplus.co.za' : 'http://localhost:3001')
).replace(/\/$/, '');

type Appt = {
  id: string;
  patientName: string;
  clinicianName: string;
  timeISO: string;
  roomId: string;
  status: string;
  notes?: string;
  diagnosis?: string;
  disposition?: string;
};

type PaymentMethod = 'self-pay-card' | 'medical-aid' | 'voucher-promo' | 'unknown';

type ClaimAutoSubmitOutcome =
  | 'not_applicable'
  | 'action_required'
  | 'draft_created'
  | 'ready_for_submission'
  | 'submitted';

type ClaimAutoSubmitResult = {
  ok?: boolean;
  outcome?: ClaimAutoSubmitOutcome;
  missingFields?: string[];
  claimNumber?: string | null;
  claimId?: string | null;
  error?: string;
  reason?: string;
  audit?: {
    externalSubmissionPerformed?: boolean;
  };
};

function formatClaimOutcomeMessage(result?: ClaimAutoSubmitResult | null): string {
  if (!result) return 'Claim package check completed.';

  const missing = Array.isArray(result.missingFields) && result.missingFields.length
    ? `: ${result.missingFields.join(', ')}`
    : '.';

  switch (result.outcome) {
    case 'not_applicable':
      return 'No medical-aid claim is required for this payer.';
    case 'action_required':
      return `Medical-aid claim draft created; action required${missing}`;
    case 'draft_created':
      return 'Medical-aid claim draft created for review.';
    case 'ready_for_submission':
      return result.claimNumber
        ? `Medical-aid claim package ${result.claimNumber} is ready for submission review.`
        : 'Medical-aid claim package is ready for submission review.';
    case 'submitted':
      return result.audit?.externalSubmissionPerformed
        ? 'Claim submitted to the payer.'
        : 'Claim package marked submitted internally; no external payer submission was confirmed.';
    default:
      return 'Claim package check completed.';
  }
}


type ClaimPayment = {
  method: PaymentMethod;
  displayLabel?: string | null;
  voucherCode?: string | null;
  voucherAmountCents?: number | null;
};

type ClaimSummary = {
  id: string;
  createdAt: string;
  encounterId: string;
  patientId?: string | null;
  patientName?: string | null;
  payment: ClaimPayment;
};

export default function FinalizeEncounter({ params }: { params: { id: string } }) {
  const { id } = params;

  const [a, setA] = useState<Appt | null>(null);
  const [notes, setNotes] = useState('');
  const [dx, setDx] = useState('');
  const [disp, setDisp] = useState<'home' | 'followup' | 'refer' | 'admit'>('home');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Claim + voucher badge
  const [claim, setClaim] = useState<ClaimSummary | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [claimOutcome, setClaimOutcome] = useState<string | null>(null);
  const [showVoucherCode, setShowVoucherCode] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(
        `${CLIN}/api/appointments/${encodeURIComponent(id)}`,
        { cache: 'no-store' },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setA(data);
      setNotes(data?.notes || '');
      setDx(data?.diagnosis || '');
      setDisp((data?.disposition as any) || 'home');
    } catch (e: any) {
      setErr(`Failed to load appointment: ${e?.message || 'error'}`);
    }
  };

  const loadClaim = async () => {
    setClaimLoading(true);
    setClaimErr(null);
    setClaimOutcome(null);
    try {
      const r = await fetch(
        `${CLIN}/api/claims?encounterId=${encodeURIComponent(id)}`,
        { cache: 'no-store' },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const items: ClaimSummary[] = Array.isArray(d.items)
        ? d.items
        : Array.isArray(d.claims)
        ? d.claims
        : [];
      // Prefer exact encounterId match; fallback to first item if any.
      const match =
        items.find((c) => String(c.encounterId) === String(id)) ||
        items[0] ||
        null;
      setClaim(match || null);
    } catch (e: any) {
      setClaimErr(e?.message || 'Unable to load claim for this encounter');
      setClaim(null);
    } finally {
      setClaimLoading(false);
    }
  };

  // Prepare medical-aid claim package after completion when applicable
  const autoSubmitClaim = async () => {
    // We rely on the clinician-app API route: /api/claims/auto-submit
    try {
      setClaimLoading(true);
      setClaimErr(null);
      setClaimOutcome(null);
      const payload: any = {
        encounterId: id,
        patientName: a?.patientName,
        diagnosisText: dx || undefined,
      };

      // Map disposition into a "mode" for the claim record
      // (purely descriptive; backend treats this as a hint)
      if (disp === 'followup') payload.mode = 'followup-confirm';
      else if (disp === 'refer') payload.mode = 'referral';
      else payload.mode = 'end';

      const r = await fetch('/api/claims/auto-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await r.json().catch(() => null)) as ClaimAutoSubmitResult | null;

      if (!r.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${r.status}`);
      }

      const message = formatClaimOutcomeMessage(data);
      setClaimOutcome(message);
      return data;
    } catch (e: any) {
      const msg = e?.message || 'auto-submit failed';
      setClaimErr(`Claim package check failed: ${msg}`);
      throw e;
    } finally {
      setClaimLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!a) return;
    setBusy(true);
    setErr(null);
    setClaimErr(null);
    try {
      const r = await fetch(
        `${CLIN}/api/appointments/${encodeURIComponent(id)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            notes,
            diagnosis: dx,
            disposition: disp,
            status: 'completed',
          }),
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      // Refresh appointment locally
      await load();

      // Prepare a claim package for this encounter and then reload claim summary if available
      try {
        const claimResult = await autoSubmitClaim();
        await loadClaim().catch(() => undefined);
        alert(`Encounter saved and completed. ${formatClaimOutcomeMessage(claimResult)}`);
      } catch {
        // Appointment save succeeded, but claim failed – surface nicely
        alert('Encounter saved and completed, but claim package preparation needs attention. See banner for details.');
      }
    } catch (e: any) {
      setErr(`Save failed: ${e?.message || 'error'}`);
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <main className="p-6">Loading…</main>;

  const methodLabel =
    claim?.payment?.method === 'medical-aid'
      ? 'Medical Aid / Insurance'
      : claim?.payment?.method === 'self-pay-card'
      ? 'Self-pay (Card)'
      : claim?.payment?.method === 'voucher-promo'
      ? 'Voucher / Promo'
      : claim
      ? 'Payment: Unknown'
      : null;

  return (
    <main className="p-6 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            Finalize Encounter — {a.patientName}
          </h1>
          <div className="text-sm text-gray-600">
            Room: {a.roomId} • {new Date(a.timeISO).toLocaleString()}
          </div>
          {err && (
            <div className="mt-1 text-xs text-rose-600">
              {err}
            </div>
          )}
          {claimErr && (
            <div className="mt-1 text-xs text-amber-700">
              {claimErr}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Tiny payment / voucher badge area */}
          {claim && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              {methodLabel && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                  {methodLabel}
                </span>
              )}

              {claim.payment.displayLabel && (
                <span className="max-w-[260px] truncate text-[10px] text-gray-500">
                  {claim.payment.displayLabel}
                </span>
              )}

              {claim.payment.method === 'voucher-promo' && (
                <>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    Voucher used ✅
                  </span>

                  {claim.payment.voucherCode && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setShowVoucherCode((v) => !v)
                        }
                        className="text-[11px] underline text-emerald-700"
                      >
                        {showVoucherCode ? 'Hide code' : 'Reveal code'}
                      </button>
                      {showVoucherCode && (
                        <span className="font-mono text-[11px] rounded bg-gray-900 px-2 py-0.5 text-white">
                          {claim.payment.voucherCode}
                        </span>
                      )}
                    </>
                  )}

                  {typeof claim.payment.voucherAmountCents === 'number' && (
                    <span className="text-[10px] text-gray-600">
                      Value: R {(claim.payment.voucherAmountCents / 100).toFixed(2)}
                    </span>
                  )}
                </>
              )}

              {/* Deep link to claims dashboard for this encounter */}
              <a
                href={`/claims?encounterId=${encodeURIComponent(id)}`}
                className="text-[11px] underline text-indigo-700"
              >
                View claims timeline
              </a>

              {claimLoading && (
                <span className="text-[10px] text-gray-500">
                  Syncing claim…
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <a
              href={`/orders/new?encounterId=${encodeURIComponent(id)}`}
              className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700"
            >
              Write eRx
            </a>
            <a
              href={`/orders/new?encounterId=${encodeURIComponent(
                id,
              )}&tab=lab`}
              className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
            >
              Order Lab
            </a>
            <a
              href="/encounters"
              className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
            >
              Back
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="text-sm">
          <div className="mb-1 text-xs text-gray-600">
            SOAP Notes
          </div>
          <textarea
            className="w-full rounded border p-2"
            rows={6}
            placeholder="SOAP Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-xs text-gray-600">
            Diagnosis
          </div>
          <input
            className="w-full rounded border p-2"
            placeholder="Diagnosis"
            value={dx}
            onChange={(e) => setDx(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <div className="mb-1 text-xs text-gray-600">
            Disposition
          </div>
          <select
            className="w-full rounded border p-2"
            value={disp}
            onChange={(e) =>
              setDisp(
                e.target.value as 'home' | 'followup' | 'refer' | 'admit',
              )
            }
          >
            <option value="home">Discharge home</option>
            <option value="followup">Follow up</option>
            <option value="refer">Refer</option>
            <option value="admit">Admit</option>
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
          >
            Save &amp; Complete (claim package check)
          </button>
          <button
            onClick={() => {
              setNotes(a.notes || '');
              setDx(a.diagnosis || '');
              setDisp((a.disposition as any) || 'home');
            }}
            className="rounded border bg-white px-3 py-1"
          >
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}
