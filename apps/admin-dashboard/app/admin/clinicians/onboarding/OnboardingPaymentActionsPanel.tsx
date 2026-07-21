// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingPaymentActionsPanel.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingEntitlementSummary = {
  pathwayKey?: string | null;
  pathwayLabel?: string | null;
  approvedPayLater?: boolean | null;
  depositQualified?: boolean | null;
  trainingAccess?: boolean | null;
  practiceActivation?: boolean | null;
  starterKitRelease?: 'none' | 'deposit' | 'full' | string | null;
  authorisedStarterKitItems?: string[] | null;
  releasedStarterKitItems?: string[] | null;
  missingStarterKitItems?: string[] | null;
  starterKitReleaseSatisfied?: boolean | null;
  platformIndemnityEligible?: boolean | null;
  balanceRecoveryApplies?: boolean | null;
  outstandingCents?: number | null;
  conditions?: string[] | null;
  privileges?: {
    trainingAccess?: boolean | null;
    practiceActivation?: boolean | null;
    starterKitRelease?: 'none' | 'deposit' | 'full' | string | null;
    platformIndemnityEligible?: boolean | null;
    balanceRecoveryApplies?: boolean | null;
  } | null;
};

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
  entitlements?: OnboardingEntitlementSummary | null;

  dispatch?: {
    id?: string;
    status?: string | null;
    courierName?: string | null;
    trackingCode?: string | null;
  } | null;
  payLaterRequest?: {
    id: string;
    pathwayKey?: string | null;
    status?: string | null;
    requestReason?: string | null;
    requestedAt?: string | null;
    reviewedAt?: string | null;
    reviewNotes?: string | null;
    requestedByUserId?: string | null;
    reviewedByUserId?: string | null;
    approvalPaymentId?: string | null;
    active?: boolean | null;
    approved?: boolean | null;
    rejected?: boolean | null;
  } | null;
};

type ActiveAction =
  | 'confirm-payment'
  | 'review-pay-later'
  | 'approve-waiver'
  | 'issue-authorisation'
  | 'dispatch-permanent'
  | null;

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

function statusTone(row: OnboardingRow) {
  const pathway =
    row.entitlements?.pathwayKey;

  if (pathway === 'FULL_PAYMENT') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }

  if (pathway === 'QUALIFYING_DEPOSIT') {
    return 'border-sky-200 bg-sky-50 text-sky-900';
  }

  if (pathway === 'START_NOW_PAY_LATER') {
    return 'border-purple-200 bg-purple-50 text-purple-900';
  }

  return 'border-amber-200 bg-amber-50 text-amber-900';
}

function dateTimeLabel(value?: string | null) {
  if (!value) return 'Not recorded';

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function payLaterStatusLabel(value?: string | null) {
  const status = String(value || '')
    .trim()
    .toLowerCase();

  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'withdrawn') return 'Withdrawn';
  if (status === 'cancelled') return 'Cancelled';

  return 'Pending review';
}

function payLaterStatusTone(value?: string | null) {
  const status = String(value || '')
    .trim()
    .toLowerCase();

  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  }

  if (status === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-950';
  }

  if (
    status === 'withdrawn' ||
    status === 'cancelled'
  ) {
    return 'border-slate-200 bg-slate-100 text-slate-800';
  }

  return 'border-amber-200 bg-amber-50 text-amber-950';
}

function hasActiveAuthorisation(
  row: OnboardingRow,
) {
  const payment =
    row.payment?.latestConfirmedPayment;

  if (
    !payment?.authorisationCodeHint ||
    !payment.authorisationExpiresAt
  ) {
    return false;
  }

  const expiresAt =
    new Date(
      payment.authorisationExpiresAt,
    );

  return (
    Number.isFinite(
      expiresAt.getTime(),
    ) &&
    expiresAt.getTime() >
      Date.now()
  );
}

function reviewErrorMessage(value: unknown) {
  const code = String(value || '').trim();

  const messages: Record<string, string> = {
    pay_later_request_not_found:
      'The Pay Later request could not be found. Refresh the board and try again.',

    pay_later_request_already_reviewed_with_different_decision:
      'This request has already been reviewed with a different decision.',

    pay_later_request_review_conflict:
      'Another Admin review changed this request. Refresh the board before taking another action.',

    pay_later_approval_blocked_by_qualifying_payment:
      'Pay Later approval is no longer available because a qualifying payment has already been recorded.',

    pay_later_terms_must_be_confirmed_by_admin:
      'Confirm the Pay Later device and permanent-kit restrictions before approval.',

    pay_later_request_storage_unavailable:
      'The Pay Later review service is awaiting its database migration.',
  };

  return (
    messages[code] ||
    code ||
    'The Pay Later review could not be completed.'
  );
}

export default function OnboardingPaymentActionsPanel({
  rows,
  currency = 'ZAR',
}: {
  rows: OnboardingRow[];
  currency?: string;
}) {
  const router = useRouter();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [activeRow, setActiveRow] = useState<OnboardingRow | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [lastCode, setLastCode] = useState<{
    clinician: string;
    code: string;
    expiresAt?: string | null;
    warning?: string;
  } | null>(null);

  const [
    codeCopied,
    setCodeCopied,
  ] = useState(false);

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
  const [payLaterReviewNotes, setPayLaterReviewNotes] = useState('');

  const [
    authorisationReplacementReason,
    setAuthorisationReplacementReason,
  ] = useState('');

  const [
    authorisationReplacementConfirmed,
    setAuthorisationReplacementConfirmed,
  ] = useState(false);

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
    setPayLaterReviewNotes('');
    setAuthorisationReplacementReason('');
    setAuthorisationReplacementConfirmed(false);
    setCodeCopied(false);

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

      setNotice({ tone: 'ok', text: 'Payment confirmed. Issuing the one-time authorisation code now.' });
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

  async function reviewPayLater(
    decision: 'approved' | 'rejected',
  ) {
    if (!activeRow) return;

    const request =
      activeRow.payLaterRequest;

    const status = String(
      request?.status || '',
    )
      .trim()
      .toLowerCase();

    if (
      !request?.id ||
      status !== 'pending'
    ) {
      setNotice({
        tone: 'err',
        text:
          'This Pay Later request is no longer pending. Refresh the board before reviewing it.',
      });

      return;
    }

    if (
      decision === 'approved' &&
      !termsConfirmed
    ) {
      setNotice({
        tone: 'err',
        text:
          'Confirm the Pay Later device and permanent-kit restrictions before approval.',
      });

      return;
    }

    setBusyId(
      activeRow.clinicianId,
    );

    try {
      const js =
        await postJson(
          '/api/admin/clinicians/onboarding/pay-later/review',
          {
            requestId:
              request.id,

            decision,

            reviewNotes:
              payLaterReviewNotes.trim() ||
              null,

            tncAcceptedByAdmin:
              decision === 'approved',

            nextPaymentAt:
              decision === 'approved'
                ? nextPaymentAt ||
                  null
                : null,

            expiresInDays: 30,
          },
        );

      setNotice({
        tone: 'ok',

        text:
          js?.message ||
          (
            decision === 'approved'
              ? 'The clinician Pay Later request has been approved.'
              : 'The clinician Pay Later request has been rejected.'
          ),
      });

      closeModal();

      if (
        decision === 'approved' &&
        js?.payment?.id
      ) {
        await generateAuthorisation(
          activeRow,
          js.payment.id,
        );
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setNotice({
        tone: 'err',

        text:
          reviewErrorMessage(
            err?.message ||
              'pay_later_review_failed',
          ),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function generateAuthorisation(
    row: OnboardingRow,
    paymentId?: string | null,
    options?: {
      replaceExisting?: boolean;
      replacementReason?: string;
    },
  ) {
    setBusyId(
      row.clinicianId,
    );

    try {
      const js =
        await postJson(
          '/api/admin/clinicians/onboarding/generate-authorisation',
          {
            clinicianId:
              row.clinicianId,

            paymentId:
              paymentId ||
              row.payment
                ?.latestConfirmedPayment
                ?.id ||
              undefined,

            expiresInDays: 30,

            replaceExisting:
              options
                ?.replaceExisting ===
              true,

            replacementReason:
              options
                ?.replacementReason
                ?.trim() ||
              null,
          },
        );

      setLastCode({
        clinician:
          row.displayName ||
          row.clinicianId,

        code:
          String(
            js.authorisationCode ||
              '',
          ),

        expiresAt:
          js?.payment
            ?.authorisationExpiresAt ||
          null,

        warning:
          js.warning ||
          'This one-time code cannot be retrieved again. Copy it before leaving this page.',
      });

      setCodeCopied(false);

      setNotice({
        tone: 'ok',

        text:
          options?.replaceExisting
            ? 'The previous code was replaced. Copy the new one-time code now.'
            : 'Authorisation code issued. Copy the one-time code now.',
      });

      closeModal();
      router.refresh();
    } catch (err: any) {
      setNotice({
        tone: 'err',

        text:
          err?.message ||
          'Authorisation generation failed.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function copyAuthorisationCode() {
    if (!lastCode?.code) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(
          lastCode.code,
        );

      setCodeCopied(true);

      setNotice({
        tone: 'ok',

        text:
          'Authorisation code copied to the clipboard.',
      });
    } catch {
      setNotice({
        tone: 'err',

        text:
          'Clipboard access was blocked. Select and copy the code manually.',
      });
    }
  }

  async function createDispatch() {
    if (!activeRow) return;

    const entitlements =
      activeRow.entitlements;

    const authorisedItems =
      entitlements
        ?.authorisedStarterKitItems ||
      [];

    const missingItems =
      entitlements
        ?.missingStarterKitItems ||
      [];

    if (
      entitlements
        ?.starterKitRelease ===
        'none' ||
      authorisedItems.length === 0
    ) {
      setNotice({
        tone: 'err',
        text:
          'The effective Admin-configured pathway does not authorise a permanent C-Med release.',
      });
      return;
    }

    if (
      missingItems.length === 0 &&
      entitlements
        ?.starterKitReleaseSatisfied ===
        true
    ) {
      setNotice({
        tone: 'ok',
        text:
          'All currently authorised C-Med items have already been released.',
      });
      closeModal();
      return;
    }

    if (!courierName.trim()) {
      setNotice({
        tone: 'err',
        text:
          'Courier name is required.',
      });
      return;
    }

    setBusyId(
      activeRow.clinicianId,
    );

    try {
      const response =
        await postJson(
          '/api/admin/clinicians/onboarding/create-dispatch',
          {
            clinicianId:
              activeRow.clinicianId,
            onboardingId:
              activeRow.onboarding?.id,
            courierName:
              courierName.trim(),
            trackingCode:
              trackingCode.trim() ||
              null,
            trackingUrl:
              trackingUrl.trim() ||
              null,
            notifyClinician,
          },
        );

      setNotice({
        tone: 'ok',
        text:
          response?.alreadySatisfied
            ? 'The existing server-authorised C-Med release is already complete.'
            : 'The server-authorised C-Med dispatch delta was prepared.',
      });

      closeModal();
      router.refresh();
    }
    catch (error: any) {
      setNotice({
        tone: 'err',
        text:
          error?.message ||
          'Dispatch creation failed.',
      });
    }
    finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Enterprise onboarding actions</h2>
        <p className="mt-1 text-xs text-gray-600">
          Review Pay Later requests, confirm payments, issue or replace one-time authorisation codes, and prepare only the C-Med items authorised by the effective Admin-configured pathway.
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
        <div className="mx-4 mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-950">
          <div className="font-black">
            One-time authorisation code for{' '}
            {lastCode.clinician}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="select-all rounded-lg border border-indigo-100 bg-white px-3 py-2 font-mono text-base font-black tracking-wide">
              {lastCode.code}
            </code>

            <button
              type="button"
              onClick={
                copyAuthorisationCode
              }
              className="rounded-lg bg-indigo-700 px-3 py-2 font-semibold text-white hover:bg-indigo-800"
            >
              {codeCopied
                ? 'Copied'
                : 'Copy code'}
            </button>
          </div>

          {lastCode.expiresAt ? (
            <div className="mt-2 font-semibold text-indigo-900">
              Expires{' '}
              {dateTimeLabel(
                lastCode.expiresAt,
              )}
            </div>
          ) : null}

          <div className="mt-2 text-indigo-800">
            {lastCode.warning}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {rows.map((row) => {
          const busy = busyId === row.clinicianId;
          const trainingScheduled = !!row.trainingSlot?.id;
          const hasConfirmedPayment = !!row.payment?.latestConfirmedPayment?.id;

          const activeAuthorisation =
            hasActiveAuthorisation(
              row,
            );
          const entitlements =
            row.entitlements;

          const waiverActive =
            entitlements?.pathwayKey ===
            'START_NOW_PAY_LATER';

          const authorisedItems =
            entitlements
              ?.authorisedStarterKitItems ||
            [];

          const missingItems =
            entitlements
              ?.missingStarterKitItems ||
            [];

          const releaseSatisfied =
            entitlements
              ?.starterKitReleaseSatisfied ===
            true;

          const canPermanentDispatch =
            entitlements
              ?.starterKitRelease !==
              'none' &&
            authorisedItems.length > 0 &&
            missingItems.length > 0;
          const payLaterStatus = String(
            row.payLaterRequest?.status || '',
          )
            .trim()
            .toLowerCase();
          const payLaterPending =
            payLaterStatus === 'pending';

          return (
            <article key={row.clinicianId} className="rounded-xl border bg-slate-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-black text-slate-950">{row.displayName}</div>
                  <div className="text-xs text-slate-500">{row.email || 'No email'} Â· {row.clinicianId}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusTone(row)}`}>
                      {row.payment?.paymentStatus || 'unpaid'}
                    </span>
                    {row.onboarding?.paymentPlan ? (
                      <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                        {row.onboarding.paymentPlan}
                      </span>
                    ) : null}
                    {row.payLaterRequest ? (
                      <span
                        className={
                          'rounded-full border px-2 py-0.5 text-[11px] font-bold ' +
                          payLaterStatusTone(
                            row.payLaterRequest.status,
                          )
                        }
                      >
                        Pay Later:{' '}
                        {payLaterStatusLabel(
                          row.payLaterRequest.status,
                        )}
                      </span>
                    ) : null}
                    {entitlements?.pathwayLabel ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-900">
                        Pathway: {entitlements.pathwayLabel}
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        No effective pathway
                      </span>
                    )}

                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700">
                      Kit release: {entitlements?.starterKitRelease || 'none'}
                    </span>

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

              {row.payLaterRequest ? (
                <div
                  className={
                    'mt-3 rounded-xl border p-3 text-xs ' +
                    payLaterStatusTone(
                      row.payLaterRequest.status,
                    )
                  }
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-black">
                        Clinician Pay Later request Â·{' '}
                        {payLaterStatusLabel(
                          row.payLaterRequest.status,
                        )}
                      </div>

                      <div className="mt-1">
                        Submitted:{' '}
                        {dateTimeLabel(
                          row.payLaterRequest.requestedAt,
                        )}
                      </div>
                    </div>

                    {row.payLaterRequest.approvalPaymentId ? (
                      <div className="rounded-lg border border-current/20 bg-white/70 px-2 py-1 font-mono text-[10px]">
                        Approval record:{' '}
                        {row.payLaterRequest.approvalPaymentId}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 rounded-lg border border-current/15 bg-white/70 p-2 leading-relaxed">
                    <span className="font-semibold">
                      Clinician reason:
                    </span>{' '}

                    {row.payLaterRequest.requestReason ||
                      'No supporting reason was supplied.'}
                  </div>

                  {row.payLaterRequest.reviewedAt ? (
                    <div className="mt-2">
                      Reviewed:{' '}
                      {dateTimeLabel(
                        row.payLaterRequest.reviewedAt,
                      )}

                      {row.payLaterRequest.reviewedByUserId
                        ? ' Â· ' +
                          row.payLaterRequest.reviewedByUserId
                        : ''}
                    </div>
                  ) : null}

                  {row.payLaterRequest.reviewNotes ? (
                    <div className="mt-2 rounded-lg border border-current/15 bg-white/70 p-2 leading-relaxed">
                      <span className="font-semibold">
                        Admin review note:
                      </span>{' '}

                      {row.payLaterRequest.reviewNotes}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !trainingScheduled}
                  onClick={() => openAction(row, 'confirm-payment')}
                  className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  Confirm payment
                </button>

                {payLaterPending ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      openAction(
                        row,
                        'review-pay-later',
                      )
                    }
                    className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-50"
                  >
                    Review Pay Later request
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={
                    busy ||
                    payLaterPending
                  }
                  onClick={() =>
                    openAction(
                      row,
                      'approve-waiver',
                    )
                  }
                  title={
                    payLaterPending
                      ? 'Use Review Pay Later request for this clinician-submitted request.'
                      : 'Create a manual Admin waiver without a clinician-submitted request.'
                  }
                  className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-900 hover:bg-purple-100 disabled:opacity-50"
                >
                  Manual waiver (separate)
                </button>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !hasConfirmedPayment
                  }
                  onClick={() =>
                    openAction(
                      row,
                      'issue-authorisation',
                    )
                  }
                  title={
                    activeAuthorisation
                      ? 'A valid code already exists. Replacing it requires a reason and confirmation.'
                      : 'Issue a one-time payment authorisation code.'
                  }
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                >
                  {activeAuthorisation
                    ? 'Replace authorisation'
                    : 'Issue authorisation'}
                </button>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !canPermanentDispatch ||
                    releaseSatisfied
                  }
                  onClick={() =>
                    openAction(
                      row,
                      'dispatch-permanent',
                    )
                  }
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                  title={
                    releaseSatisfied
                      ? 'All currently authorised items have already been released.'
                      : canPermanentDispatch
                        ? 'Prepare only the server-authorised outstanding C-Med items.'
                        : 'The effective pathway does not authorise a permanent kit release.'
                  }
                >
                  {releaseSatisfied
                    ? 'Authorised kit released'
                    : canPermanentDispatch
                      ? (
                          'Prepare ' +
                          missingItems.length +
                          ' authorised item' +
                          (missingItems.length === 1 ? '' : 's')
                        )
                      : 'Kit release not authorised'}
                </button>
              </div>

              {entitlements ? (
                <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-950">
                  <div className="font-black">
                    Server-resolved pathway privileges
                  </div>

                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    <span>
                      Training access:{' '}
                      <strong>
                        {entitlements.trainingAccess ? 'Granted' : 'Not granted'}
                      </strong>
                    </span>
                    <span>
                      Practice activation:{' '}
                      <strong>
                        {entitlements.practiceActivation ? 'Granted' : 'Not granted'}
                      </strong>
                    </span>
                    <span>
                      Kit release:{' '}
                      <strong>
                        {entitlements.starterKitRelease || 'none'}
                      </strong>
                    </span>
                    <span>
                      Outstanding kit items:{' '}
                      <strong>
                        {missingItems.length}
                      </strong>
                    </span>
                  </div>

                  {waiverActive ? (
                    <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-2 text-purple-950">
                      Pay Later is the effective pathway. Its exact training, practice, indemnity and kit privileges are those published by Admin.
                    </div>
                  ) : null}
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
                    : activeAction === 'review-pay-later'
                      ? 'Review clinician Pay Later request'
                      : activeAction === 'approve-waiver'
                        ? 'Manual Admin waiver / train now, pay later'
                        : activeAction === 'issue-authorisation'
                          ? hasActiveAuthorisation(activeRow)
                            ? 'Replace active authorisation code'
                            : 'Issue payment authorisation code'
                        : 'Prepare server-authorised C-Med release'}
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

              {activeAction === 'review-pay-later' ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    <div className="font-black">
                      {payLaterStatusLabel(
                        activeRow.payLaterRequest?.status,
                      )}
                    </div>

                    <div className="mt-1">
                      Submitted:{' '}
                      {dateTimeLabel(
                        activeRow.payLaterRequest?.requestedAt,
                      )}
                    </div>

                    <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 p-2 leading-relaxed">
                      <span className="font-semibold">
                        Clinician reason:
                      </span>{' '}

                      {activeRow.payLaterRequest?.requestReason ||
                        'No supporting reason was supplied.'}
                    </div>
                  </div>

                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">
                      Admin review note
                    </span>

                    <textarea
                      value={payLaterReviewNotes}
                      onChange={(event) =>
                        setPayLaterReviewNotes(
                          event.target.value,
                        )
                      }
                      rows={3}
                      maxLength={2000}
                      placeholder="Optional for approval. Recommended when rejecting the request."
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold">
                      Next payment/review date
                    </span>

                    <input
                      type="date"
                      value={nextPaymentAt}
                      onChange={(event) =>
                        setNextPaymentAt(
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />

                    <span className="text-[11px] text-slate-500">
                      Used only when the request is approved.
                    </span>
                  </label>

                  <label className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    <input
                      type="checkbox"
                      checked={termsConfirmed}
                      onChange={(event) =>
                        setTermsConfirmed(
                          event.target.checked,
                        )
                      }
                    />

                    <span>
                      Admin confirms that approval permits the Pay Later training pathway and temporary training-device arrangements only. It does not mark the qualifying deposit as paid or release the permanent C-Med StarterKit.
                    </span>
                  </label>

                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                    Rejecting the request grants no training access, creates no payment and creates no dispatch.
                  </div>
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

              {activeAction === 'issue-authorisation' ? (
                hasActiveAuthorisation(
                  activeRow,
                ) ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                      <div className="font-black">
                        A valid code is already active
                      </div>

                      <div className="mt-1">
                        Code ending in{' '}
                        <span className="font-mono font-black">
                          {activeRow.payment?.latestConfirmedPayment?.authorisationCodeHint}
                        </span>
                        {' Â· '}expires{' '}
                        {dateTimeLabel(
                          activeRow.payment?.latestConfirmedPayment?.authorisationExpiresAt,
                        )}.
                      </div>

                      <div className="mt-2">
                        Replacing it immediately invalidates the previous code.
                      </div>
                    </div>

                    <label className="block space-y-1 text-xs">
                      <span className="font-semibold">
                        Replacement reason
                      </span>

                      <textarea
                        value={
                          authorisationReplacementReason
                        }
                        onChange={(event) =>
                          setAuthorisationReplacementReason(
                            event.target.value,
                          )
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="Explain why the active code must be replaced."
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950">
                      <input
                        type="checkbox"
                        checked={
                          authorisationReplacementConfirmed
                        }
                        onChange={(event) =>
                          setAuthorisationReplacementConfirmed(
                            event.target.checked,
                          )
                        }
                      />

                      <span>
                        I understand that the existing code will stop working immediately.
                      </span>
                    </label>
                  </>
                ) : (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950">
                    Issue a single-use code valid for 30 days. The plaintext code is shown once and only its secure hash is retained.
                  </div>
                )
              ) : null}

              {activeAction === 'dispatch-permanent' ? (
                <>
                  <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="font-black text-slate-900">Server-authorised C-Med dispatch delta</div>
                    <ul className="mt-2 list-disc pl-5">
                      {(activeRow.entitlements?.missingStarterKitItems || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
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

              {activeAction !== 'review-pay-later' && activeAction !== 'issue-authorisation' ? (
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">
                    Admin notes
                  </span>

                  <textarea
                    value={adminNotes}
                    onChange={(event) =>
                      setAdminNotes(
                        event.target.value,
                      )
                    }
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button type="button" onClick={closeModal} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50">
                Cancel
              </button>
              {activeAction === 'confirm-payment' ? (
                <button type="button" disabled={busyId === activeRow.clinicianId} onClick={confirmPayment} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  Confirm & issue code
                </button>
              ) : activeAction === 'review-pay-later' ? (
                <>
                  <button
                    type="button"
                    disabled={
                      busyId ===
                      activeRow.clinicianId
                    }
                    onClick={() =>
                      reviewPayLater(
                        'rejected',
                      )
                    }
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Reject Pay Later
                  </button>

                  <button
                    type="button"
                    disabled={
                      busyId ===
                        activeRow.clinicianId ||
                      !termsConfirmed
                    }
                    onClick={() =>
                      reviewPayLater(
                        'approved',
                      )
                    }
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve & issue code
                  </button>
                </>
              ) : activeAction === 'approve-waiver' ? (
                <button type="button" disabled={busyId === activeRow.clinicianId} onClick={approveWaiver} className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                  Approve waiver & issue code
                </button>
              ) : activeAction === 'issue-authorisation' ? (
                <button
                  type="button"
                  disabled={
                    busyId ===
                      activeRow.clinicianId ||
                    (
                      hasActiveAuthorisation(
                        activeRow,
                      ) &&
                      (
                        !authorisationReplacementReason.trim() ||
                        !authorisationReplacementConfirmed
                      )
                    )
                  }
                  onClick={() =>
                    generateAuthorisation(
                      activeRow,
                      activeRow.payment?.latestConfirmedPayment?.id,
                      {
                        replaceExisting:
                          hasActiveAuthorisation(
                            activeRow,
                          ),

                        replacementReason:
                          authorisationReplacementReason,
                      },
                    )
                  }
                  className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                >
                  {hasActiveAuthorisation(
                    activeRow,
                  )
                    ? 'Replace & show new code'
                    : 'Issue & show code'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={
                    busyId ===
                    activeRow.clinicianId
                  }
                  onClick={
                    createDispatch
                  }
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Prepare authorised dispatch
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
