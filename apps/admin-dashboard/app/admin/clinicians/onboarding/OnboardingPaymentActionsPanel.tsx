// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingPaymentActionsPanel.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingRow = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  onboarding?: {
    id?: string;
    stage?: string | null;
    depositPaid?: boolean | null;
    paymentPlan?: string | null;
    waiverActive?: boolean | null;
    nextPaymentAt?: string | null;
  } | null;
  trainingSlot?: {
    id?: string;
    startAt?: string | null;
    mode?: string | null;
    status?: string | null;
  } | null;
  payment?: {
    amountPaidCents?: number | null;
    outstandingCents?: number | null;
    initialRequirementMet?: boolean | null;
    fullyPaid?: boolean | null;
    paymentStatus?: string | null;
    waiverActive?: boolean | null;
    latestConfirmedPayment?: {
      id?: string | null;
      provider?: string | null;
      paymentReference?: string | null;
      authorisationCodeHint?: string | null;
      authorisationExpiresAt?: string | null;
    } | null;
  } | null;
  dispatch?: {
    id?: string;
    status?: string | null;
    courierName?: string | null;
    trackingCode?: string | null;
  } | null;
};

type ActiveAction = 'confirm-payment' | 'approve-waiver' | 'dispatch-temporary' | 'dispatch-permanent' | null;

function money(cents: number | null | undefined, currency = 'ZAR') {
  const n = Math.max(0, Math.round(Number(cents || 0))) / 100;
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function asCurrencyCents(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function safeArray(xs?: string[] | null) {
  return Array.isArray(xs) ? xs.map((x) => String(x || '').trim()).filter(Boolean) : [];
}

function statusTone(row: OnboardingRow) {
  if (row.payment?.fullyPaid) return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (row.payment?.initialRequirementMet || row.onboarding?.depositPaid) return 'border-sky-200 bg-sky-50 text-sky-900';
  if (row.payment?.waiverActive || row.onboarding?.waiverActive) return 'border-purple-200 bg-purple-50 text-purple-900';
  return 'border-amber-200 bg-amber-50 text-amber-900';
}

export default function OnboardingPaymentActionsPanel({
  rows,
  starterKitItems,
  currency = 'ZAR',
}: {
  rows: OnboardingRow[];
  starterKitItems?: string[];
  currency?: string;
}) {
  const router = useRouter();
  const kitItems = useMemo(() => safeArray(starterKitItems), [starterKitItems]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [activeRow, setActiveRow] = useState<OnboardingRow | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [lastCode, setLastCode] = useState<{ clinician: string; code: string; warning?: string } | null>(null);

  const [amount, setAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [originBank, setOriginBank] = useState('');
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const [waiverReason, setWaiverReason] = useState('');
  const [accountantComment, setAccountantComment] = useState('');
  const [nextPaymentAt, setNextPaymentAt] = useState('');
  const [termsConfirmed, setTermsConfirmed] = useState(false);

  const [courierName, setCourierName] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notifyClinician, setNotifyClinician] = useState(true);

  const openAction = (row: OnboardingRow, action: ActiveAction) => {
    setNotice(null);
    setLastCode(null);
    setActiveRow(row);
    setActiveAction(action);

    setAmount('');
    setPaymentReference('');
    setPayerName(row.displayName || '');
    setOriginBank('');
    setProofOfPaymentUrl('');
    setAdminNotes('');

    setWaiverReason('');
    setAccountantComment('');
    setNextPaymentAt('');
    setTermsConfirmed(false);

    setCourierName('');
    setTrackingCode('');
    setTrackingUrl('');
    setNotifyClinician(true);
  };

  const closeModal = () => {
    setActiveRow(null);
    setActiveAction(null);
  };

  async function postJson(url: string, body: any) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const js = await res.json().catch(() => null);

    if (!res.ok || js?.ok === false) {
      throw new Error(js?.message || js?.error || `HTTP ${res.status}`);
    }

    return js;
  }

  async function confirmPayment() {
    if (!activeRow) return;
    if (!activeRow.trainingSlot?.id) {
      setNotice({ tone: 'err', text: 'Schedule training before confirming payment.' });
      return;
    }
    if (!paymentReference.trim()) {
      setNotice({ tone: 'err', text: 'Payment reference is required.' });
      return;
    }
    if (!payerName.trim()) {
      setNotice({ tone: 'err', text: 'Payer name is required.' });
      return;
    }

    setBusyId(activeRow.clinicianId);
    try {
      const js = await postJson('/api/admin/clinicians/onboarding/confirm-payment', {
        clinicianId: activeRow.clinicianId,
        onboardingId: activeRow.onboarding?.id,
        slotId: activeRow.trainingSlot.id,
        amountCents: amount.trim() ? asCurrencyCents(amount) : undefined,
        paymentReference: paymentReference.trim(),
        payerName: payerName.trim(),
        originBank: originBank.trim() || null,
        proofOfPaymentUrl: proofOfPaymentUrl.trim() || null,
        notes: adminNotes.trim() || null,
        provider: 'manual',
      });

      setNotice({ tone: 'ok', text: 'Payment confirmed. You can now generate an authorisation code.' });
      setLastCode(null);
      closeModal();

      if (js?.payment?.id) {
        await generateAuthorisation(activeRow, js.payment.id);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Payment confirmation failed.' });
    } finally {
      setBusyId(null);
    }
  }

  async function approveWaiver() {
    if (!activeRow) return;
    if (!waiverReason.trim()) {
      setNotice({ tone: 'err', text: 'Waiver/pay-later reason is required.' });
      return;
    }
    if (!termsConfirmed) {
      setNotice({ tone: 'err', text: 'Admin must confirm the waiver/pay-later terms.' });
      return;
    }

    setBusyId(activeRow.clinicianId);
    try {
      const js = await postJson('/api/admin/clinicians/onboarding/approve-waiver', {
        clinicianId: activeRow.clinicianId,
        onboardingId: activeRow.onboarding?.id,
        slotId: activeRow.trainingSlot?.id || undefined,
        waiverReason: waiverReason.trim(),
        adminComment: adminNotes.trim() || null,
        accountantComment: accountantComment.trim() || null,
        nextPaymentAt: nextPaymentAt || null,
        tncAcceptedByAdmin: true,
        expiresInDays: 30,
      });

      setNotice({ tone: 'ok', text: 'Waiver/pay-later approved. Authorisation code generated below.' });
      closeModal();

      if (js?.payment?.id) {
        await generateAuthorisation(activeRow, js.payment.id);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Waiver approval failed.' });
    } finally {
      setBusyId(null);
    }
  }

  async function generateAuthorisation(row: OnboardingRow, paymentId?: string | null) {
    setBusyId(row.clinicianId);
    try {
      const js = await postJson('/api/admin/clinicians/onboarding/generate-authorisation', {
        clinicianId: row.clinicianId,
        paymentId: paymentId || row.payment?.latestConfirmedPayment?.id || undefined,
        expiresInDays: 30,
      });

      setLastCode({
        clinician: row.displayName || row.clinicianId,
        code: String(js.authorisationCode || ''),
        warning: js.warning || 'Show this code once to the clinician.',
      });
      setNotice({ tone: 'ok', text: 'Authorisation code generated. Copy it now.' });
      router.refresh();
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Authorisation generation failed.' });
    } finally {
      setBusyId(null);
    }
  }

  async function createDispatch(dispatchKind: 'temporary_training_kit' | 'starter_kit') {
    if (!activeRow) return;
    if (!kitItems.length) {
      setNotice({ tone: 'err', text: 'C-Med StarterKit contents are not configured. Save kit items in onboarding settings first.' });
      return;
    }
    if (!courierName.trim()) {
      setNotice({ tone: 'err', text: 'Courier name is required.' });
      return;
    }

    setBusyId(activeRow.clinicianId);
    try {
      await postJson('/api/admin/clinicians/onboarding/create-dispatch', {
        clinicianId: activeRow.clinicianId,
        onboardingId: activeRow.onboarding?.id,
        courierName: courierName.trim(),
        trackingCode: trackingCode.trim() || null,
        trackingUrl: trackingUrl.trim() || null,
        kitItems,
        dispatchKind,
        notifyClinician,
      });

      setNotice({
        tone: 'ok',
        text:
          dispatchKind === 'temporary_training_kit'
            ? 'Temporary training kit dispatch created.'
            : 'Permanent C-Med StarterKit dispatch created.',
      });
      closeModal();
      router.refresh();
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Dispatch creation failed.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Enterprise onboarding actions</h2>
        <p className="mt-1 text-xs text-gray-600">
          Confirm manual payments, approve waiver/pay-later, issue authorisation codes, and control temporary versus permanent C-Med StarterKit release.
        </p>
      </div>

      {notice ? (
        <div
          className={[
            'mx-4 mt-3 rounded border p-3 text-xs',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {notice.text}
        </div>
      ) : null}

      {lastCode ? (
        <div className="mx-4 mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950">
          <div className="font-black">Authorisation code for {lastCode.clinician}</div>
          <div className="mt-2 inline-flex rounded-lg bg-white px-3 py-2 font-mono text-sm font-black tracking-wide">
            {lastCode.code}
          </div>
          <div className="mt-2 text-indigo-800">{lastCode.warning}</div>
        </div>
      ) : null}

      {!kitItems.length ? (
        <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          C-Med StarterKit contents are not configured. Dispatch actions are disabled until Admin saves kit contents in onboarding settings.
        </div>
      ) : null}

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {rows.map((row) => {
          const busy = busyId === row.clinicianId;
          const trainingScheduled = !!row.trainingSlot?.id;
          const hasConfirmedPayment = !!row.payment?.latestConfirmedPayment?.id;
          const depositMet = row.payment?.initialRequirementMet === true || row.onboarding?.depositPaid === true;
          const waiverActive = row.payment?.waiverActive === true || row.onboarding?.waiverActive === true;
          const canPermanentDispatch = depositMet || row.payment?.fullyPaid === true;

          return (
            <article key={row.clinicianId} className="rounded-xl border bg-slate-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-black text-slate-950">{row.displayName}</div>
                  <div className="text-xs text-slate-500">{row.email || 'No email'} · {row.clinicianId}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusTone(row)}`}>
                      {row.payment?.paymentStatus || 'unpaid'}
                    </span>
                    {row.onboarding?.paymentPlan ? (
                      <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                        {row.onboarding.paymentPlan}
                      </span>
                    ) : null}
                    {row.dispatch?.status ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        Dispatch: {row.dispatch.status}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="grid min-w-[190px] gap-1 rounded-lg border bg-white p-2 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Paid</span>
                    <span className="font-bold text-slate-900">{money(row.payment?.amountPaidCents, currency)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Outstanding</span>
                    <span className="font-bold text-slate-900">{money(row.payment?.outstandingCents, currency)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Training</span>
                    <span className="font-bold text-slate-900">{trainingScheduled ? 'Scheduled' : 'Not scheduled'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !trainingScheduled}
                  onClick={() => openAction(row, 'confirm-payment')}
                  className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Confirm payment
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openAction(row, 'approve-waiver')}
                  className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-100 disabled:opacity-50"
                >
                  Approve waiver/pay later
                </button>

                <button
                  type="button"
                  disabled={busy || !hasConfirmedPayment}
                  onClick={() => generateAuthorisation(row)}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                >
                  Issue authorisation
                </button>

                <button
                  type="button"
                  disabled={busy || !kitItems.length}
                  onClick={() => openAction(row, 'dispatch-temporary')}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  Temporary training kit
                </button>

                <button
                  type="button"
                  disabled={busy || !kitItems.length || !canPermanentDispatch}
                  onClick={() => openAction(row, 'dispatch-permanent')}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                  title={canPermanentDispatch ? 'Release permanent C-Med StarterKit' : 'Requires deposit or full payment'}
                >
                  Permanent C-Med StarterKit
                </button>
              </div>

              {waiverActive && !depositMet ? (
                <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-2 text-[11px] text-purple-900">
                  Waiver/pay-later active: temporary training devices may be issued, but permanent C-Med StarterKit remains blocked until deposit/full payment.
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeRow && activeAction ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <div className="text-sm font-black text-gray-900">
                  {activeAction === 'confirm-payment'
                    ? 'Confirm EFT/manual payment'
                    : activeAction === 'approve-waiver'
                      ? 'Approve waiver / train now, pay later'
                      : activeAction === 'dispatch-temporary'
                        ? 'Create temporary training kit dispatch'
                        : 'Create permanent C-Med StarterKit dispatch'}
                </div>
                <div className="text-xs text-gray-500">{activeRow.displayName}</div>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
                Close
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {activeAction === 'confirm-payment' ? (
                <>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Amount paid</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Example: 7950" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Payment reference</span>
                    <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Payer name</span>
                    <input value={payerName} onChange={(e) => setPayerName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Origin bank / accountant note</span>
                    <input value={originBank} onChange={(e) => setOriginBank(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Proof-of-payment URL</span>
                    <input value={proofOfPaymentUrl} onChange={(e) => setProofOfPaymentUrl(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                </>
              ) : null}

              {activeAction === 'approve-waiver' ? (
                <>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Waiver / pay-later reason</span>
                    <textarea value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Accountant/admin comment</span>
                    <textarea value={accountantComment} onChange={(e) => setAccountantComment(e.target.value)} rows={2} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Next payment/review date</span>
                    <input type="date" value={nextPaymentAt} onChange={(e) => setNextPaymentAt(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="flex gap-2 rounded-lg border bg-amber-50 p-3 text-xs text-amber-900">
                    <input type="checkbox" checked={termsConfirmed} onChange={(e) => setTermsConfirmed(e.target.checked)} />
                    <span>Admin confirms waiver T&C: temporary training devices only; permanent C-Med StarterKit release requires deposit or full payment.</span>
                  </label>
                </>
              ) : null}

              {activeAction === 'dispatch-temporary' || activeAction === 'dispatch-permanent' ? (
                <>
                  <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="font-black text-slate-900">C-Med StarterKit items from Admin settings</div>
                    <ul className="mt-2 list-disc pl-5">
                      {kitItems.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Courier name</span>
                    <input value={courierName} onChange={(e) => setCourierName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Tracking code</span>
                    <input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder="Optional while preparing kit" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">Tracking URL</span>
                    <input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="Optional" className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </label>
                  <label className="flex gap-2 rounded-lg border bg-white p-3 text-xs text-slate-700">
                    <input type="checkbox" checked={notifyClinician} onChange={(e) => setNotifyClinician(e.target.checked)} />
                    <span>Notify clinician if tracking details are available.</span>
                  </label>
                </>
              ) : null}

              <label className="block space-y-1 text-xs">
                <span className="font-semibold">Admin notes</span>
                <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} rows={2} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button type="button" onClick={closeModal} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50">
                Cancel
              </button>
              {activeAction === 'confirm-payment' ? (
                <button type="button" disabled={busyId === activeRow.clinicianId} onClick={confirmPayment} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  Confirm & issue code
                </button>
              ) : activeAction === 'approve-waiver' ? (
                <button type="button" disabled={busyId === activeRow.clinicianId} onClick={approveWaiver} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                  Approve waiver & issue code
                </button>
              ) : activeAction === 'dispatch-temporary' ? (
                <button type="button" disabled={busyId === activeRow.clinicianId} onClick={() => createDispatch('temporary_training_kit')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                  Create temporary dispatch
                </button>
              ) : (
                <button type="button" disabled={busyId === activeRow.clinicianId} onClick={() => createDispatch('starter_kit')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  Create permanent dispatch
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
