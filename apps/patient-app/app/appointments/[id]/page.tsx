// apps/patient-app/app/appointments/[id]/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const GATEWAY = process.env.NEXT_PUBLIC_APIGW_BASE ?? (process.env.NODE_ENV === 'production' ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010');

type Appt = {
  id: string;
  clinicianId?: string;
  clinicianName?: string;
  startsAt: string;
  endsAt: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  reason?: string;
  location?: string;
  roomId?: string;
  prep?: string;
  patientId?: string;
  subjectPatientId?: string | null;
  hostUserId?: string | null;
  familyRelationshipId?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentProvider?: string | null;
  paymentRef?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  meta?: Record<string, any> | null;
  patientJoinUrl?: string | null;
  clinicianJoinUrl?: string | null;
  patientParticipantId?: string | null;
  clinicianParticipantId?: string | null;
  clinicianSpecialty?: string | null;
  clinicianAvatarUrl?: string | null;
  clinicianLocation?: string | null;
  patientName?: string | null;
  patientAvatarUrl?: string | null;
  booking?: {
    intentId?: string | null;
    status?: string | null;
    fundingMethod?: string | null;
    holdExpiresAt?: string | null;
    holdActive?: boolean;
    slotLeaseStatus?: string | null;
    patientPayableMinor?: number;
    sponsorAmountMinor?: number;
    currency?: string | null;
    coverageDecision?: string | null;
    coverageAuthorizationId?: string | null;
    coverageAuthorizationStatus?: string | null;
    canResumePayment?: boolean;
    requiresSponsorReview?: boolean;
    requiresExplicitFundingChange?: boolean;
  } | null;
};

type Rating = {
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string | null;
  createdAt?: string | null;
};

type MemberReimbursementClaim = {
  id: string;
  claimNumber: string;
  status: string;
  reason?: string | null;
  currency?: string | null;
  requestedAmountMinor: number;
  approvedAmountMinor: number;
  paidAmountMinor: number;
  memberResponsibilityMinor?: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  remittanceRef?: string | null;
};

function moneyMinor(value: unknown, currency = 'ZAR') {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(n / 100);
}

function bookingFundingLabel(value: unknown) {
  const method = String(value || '').toUpperCase();
  if (method === 'MEDICAL_AID') return 'Medical Aid / Sponsor';
  if (method === 'VOUCHER') return 'Voucher';
  return 'Card / Self-pay';
}

function holdCountdown(expiresAt?: string | null, nowMs = Date.now()) {
  const end = Date.parse(String(expiresAt || ''));
  if (!Number.isFinite(end)) return null;
  const remaining = Math.max(0, end - nowMs);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function asObj(v: unknown): Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {};
}

function paymentMethodOf(appt: Appt) {
  const meta = asObj(appt.meta);
  const ri = asObj(meta.reimbursementIntent);
  return String(
    appt.paymentMethod ||
      meta.paymentMethod ||
      ri.originalPaymentMethod ||
      '',
  ).toLowerCase();
}

function isCardPaidAppointment(appt: Appt) {
  const method = paymentMethodOf(appt);
  const status = String(appt.paymentStatus || '').toLowerCase();

  const looksCard =
    method.includes('card') ||
    method.includes('self') ||
    method.includes('paystack') ||
    String(appt.paymentProvider || '').toLowerCase().includes('paystack');

  const verified =
    Boolean(appt.paymentRef) ||
    ['paid', 'captured', 'success', 'completed', 'settled'].includes(status) ||
    isCompleted(appt.status);

  return isCompleted(appt.status) && looksCard && verified;
}

function reimbursementTone(status?: string) {
  const s = String(status || '').toUpperCase();

  if (s === 'PAID') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  if (s === 'APPROVED' || s === 'PARTIALLY_APPROVED' || s === 'READY_FOR_PAYMENT') {
    return 'bg-sky-50 border-sky-200 text-sky-800';
  }
  if (s === 'REQUEST_INFO' || s === 'UNDER_REVIEW' || s === 'SUBMITTED') {
    return 'bg-amber-50 border-amber-200 text-amber-800';
  }
  if (s === 'DENIED' || s === 'CANCELLED') {
    return 'bg-rose-50 border-rose-200 text-rose-800';
  }

  return 'bg-gray-50 border-gray-200 text-gray-700';
}

const DEFAULT_ORG_ID =
  process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default';

type AuthMe = {
  ok?: boolean;
  uid?: string | null;
  userId?: string | null;
  actorType?: string | null;
  actorRefId?: string | null;
  orgId?: string | null;
  user?: {
    id?: string | null;
    actorType?: string | null;
    actorRefId?: string | null;
    orgId?: string | null;
  } | null;
};

function getIdentityHeaders(me?: AuthMe | null): HeadersInit {
  const uid =
    me?.uid ||
    me?.userId ||
    me?.user?.id ||
    '';

  const orgId =
    me?.orgId ||
    me?.user?.orgId ||
    DEFAULT_ORG_ID;

  return {
    'x-role': 'patient',
    ...(uid ? { 'x-uid': String(uid) } : {}),
    ...(orgId ? { 'x-org-id': String(orgId) } : {}),
  };
}

function isCompleted(status: string) {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'done' || s === 'closed';
}

function normalizeStatus(status: unknown) {
  return String(status || '').trim().toLowerCase();
}

function appointmentPaymentStatus(appt: Appt) {
  const meta = asObj(appt.meta);

  return normalizeStatus(
    appt.paymentStatus ||
      meta.paymentStatus ||
      meta.payment_status ||
      '',
  );
}

function appointmentPaymentIsPending(appt: Appt) {
  const status = normalizeStatus(appt.status);
  const paymentStatus = appointmentPaymentStatus(appt);

  return (
    status === 'pending_payment' ||
    status === 'pending' ||
    ['pending', 'initiated', 'init', 'processing', 'authorization'].includes(paymentStatus)
  );
}

function appointmentPaymentIsFailed(appt: Appt) {
  const status = normalizeStatus(appt.status);
  const paymentStatus = appointmentPaymentStatus(appt);

  return (
    ['failed', 'cancelled_payment_timeout', 'payment_expired', 'payment_init_failed'].includes(status) ||
    ['failed', 'abandoned', 'cancelled', 'canceled', 'expired'].includes(paymentStatus)
  );
}

function appointmentJoinBlockReason(appt: Appt) {
  const status = normalizeStatus(appt.status);
  if (['completed', 'done', 'closed'].includes(status)) return 'This appointment has already been completed.';
  if (['cancelled', 'canceled'].includes(status)) return 'This appointment has been cancelled.';

  if (!appt.patientJoinUrl && !appt.roomId) return 'Televisit room is not ready yet.';
  if (appointmentPaymentIsPending(appt)) return 'Complete payment before joining the televisit.';
  if (appointmentPaymentIsFailed(appt)) return 'Payment failed or expired. Please rebook or retry checkout.';

  return 'This appointment is not ready for televisit entry yet.';
}

function lobbyHrefForAppointment(appt: Appt) {
  if (!appt.roomId && appt.patientJoinUrl) return appt.patientJoinUrl;
  if (!appt.roomId) return '#';

  const qs = new URLSearchParams();
  qs.set('appointmentId', appt.id);
  qs.set('roomId', appt.roomId);
  if (appt.patientId) qs.set('patientId', appt.patientId);
  if (appt.subjectPatientId) qs.set('subjectPatientId', appt.subjectPatientId);
  if (appt.reason) qs.set('reason', appt.reason);

  return `/lobby?${qs.toString()}`;
}

function starsText(score: number) {
  const s = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(s) + '☆'.repeat(5 - s);
}

async function fetchAuthMe(): Promise<AuthMe | null> {
  try {
    const r = await fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'include',
    });

    if (!r.ok) return null;

    const raw = (await r.json()) as AuthMe;
    const user = raw?.user || null;

    return {
      ...raw,
      uid: raw.uid || raw.userId || user?.id || null,
      userId: raw.userId || user?.id || null,
      actorType: raw.actorType || user?.actorType || null,
      actorRefId: raw.actorRefId || user?.actorRefId || null,
      orgId: raw.orgId || user?.orgId || DEFAULT_ORG_ID,
      user,
    };
  } catch {
    return null;
  }
}

async function fetchAppointmentById(apptId: string, me?: AuthMe | null): Promise<Appt | null> {
  try {
    const direct = await fetch(`/api/appointments/${encodeURIComponent(apptId)}`, {
      cache: 'no-store',
      credentials: 'include',
      headers: getIdentityHeaders(me),
    });
    if (!direct.ok) return null;

    const j = await direct.json().catch(() => ({} as any));
    const a = j?.appointment ?? j?.data?.appointment ?? j?.data ?? j;
    if (a?.id) return a as Appt;
    return null;
  } catch {
    return null;
  }
}

async function fetchAppointmentRating(apptId: string, me?: AuthMe | null): Promise<Rating | null> {
  try {
    const res = await fetch(`${GATEWAY}/api/appointments/${encodeURIComponent(apptId)}/rating`, {
      cache: 'no-store',
      headers: getIdentityHeaders(me),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;

    const j = await res.json().catch(() => ({} as any));
    const r = j?.rating ?? j?.data?.rating ?? j?.data ?? j;

    const scoreRaw = r?.score ?? r?.stars ?? r?.rating;
    const scoreNum = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);
    if (!Number.isFinite(scoreNum) || scoreNum < 1 || scoreNum > 5) return null;

    return {
      score: scoreNum as any,
      comment: r?.comment ?? r?.text ?? null,
      createdAt: r?.createdAt ?? r?.created_at ?? null,
    };
  } catch {
    return null;
  }
}

async function submitAppointmentRating(apptId: string, payload: Rating, me?: AuthMe | null): Promise<Rating | null> {
  try {
    const res = await fetch(`${GATEWAY}/api/appointments/${encodeURIComponent(apptId)}/rating`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getIdentityHeaders(me),
      },
      body: JSON.stringify({
        score: payload.score,
        comment: payload.comment ?? null,
        createdAt: payload.createdAt ?? new Date().toISOString(),
      }),
    });

    const j = await res.json().catch(() => ({} as any));
    if (!res.ok) return null;

    const r = j?.rating ?? j?.data?.rating ?? j?.data ?? j;
    const scoreRaw = r?.score ?? r?.stars ?? payload.score;
    const scoreNum = typeof scoreRaw === 'number' ? scoreRaw : Number(scoreRaw);

    return {
      score: (Number.isFinite(scoreNum) ? scoreNum : payload.score) as any,
      comment: r?.comment ?? payload.comment ?? null,
      createdAt: r?.createdAt ?? payload.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const id = params.id;
  const subjectPatientId = searchParams?.get('subjectPatientId')?.trim() || '';
  const relationshipId = searchParams?.get('relationshipId')?.trim() || '';

  const [me, setMe] = useState<AuthMe | null>(null);
  const [appt, setAppt] = useState<Appt | null | 'notfound'>(null);
  const [rating, setRating] = useState<Rating | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  const [reimbursementClaims, setReimbursementClaims] = useState<MemberReimbursementClaim[]>([]);
  const [reimbursementLoading, setReimbursementLoading] = useState(false);
  const [reimbursementBusy, setReimbursementBusy] = useState(false);
  const [reimbursementMessage, setReimbursementMessage] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);

  const autoOpened = useRef(false);
  const shouldPromptRating = searchParams?.get('rate') === '1';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!cancelled) setLoading(true);

        const auth = await fetchAuthMe();
        if (!cancelled) setMe(auth);

        const [a, r] = await Promise.all([
          fetchAppointmentById(id, auth),
          fetchAppointmentRating(id, auth),
        ]);

        if (cancelled) return;

        if (!a) {
          setAppt('notfound');
          setRating(null);
          return;
        }

        setAppt(a);
        setRating(r);

        if (r?.score) {
          setRatingScore(r.score);
          setRatingComment(r.comment ?? '');
        }
      } catch {
        if (!cancelled) {
          setAppt('notfound');
          setRating(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    void loadReimbursementClaims();
  }, [id]);

  useEffect(() => {
    if (!appt || appt === 'notfound' || !appt.booking?.holdExpiresAt) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [appt]);

  const canJoin = useMemo(() => {
    if (!appt || appt === 'notfound') return false;
    const s = normalizeStatus(appt.status);

    return (
      (s === 'scheduled' || s === 'confirmed' || s === 'checked_in' || s === 'in_consult') &&
      Boolean(appt.patientJoinUrl || appt.roomId) &&
      !appointmentPaymentIsPending(appt) &&
      !appointmentPaymentIsFailed(appt)
    );
  }, [appt]);

  const canRate = useMemo(() => {
    if (!appt || appt === 'notfound') return false;
    return isCompleted(appt.status);
  }, [appt]);

  const hasRating = Boolean(rating?.score);

  useEffect(() => {
    if (!shouldPromptRating) return;
    if (!appt || appt === 'notfound') return;
    if (!canRate) return;
    if (hasRating) return;
    if (autoOpened.current) return;

    autoOpened.current = true;
    setRatingOpen(true);
  }, [shouldPromptRating, appt, canRate, hasRating]);

  async function refreshAppointment() {
    const next = await fetchAppointmentById(id, me);
    if (next) setAppt(next);
    return next;
  }

  async function patientCheckoutEmail() {
    try {
      const response = await fetch('/api/profile', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) return '';
      const profile = data?.profile || data?.patient || data;
      return String(
        profile?.email ||
          profile?.contactEmail ||
          profile?.patientEmail ||
          '',
      ).trim();
    } catch {
      return '';
    }
  }

  async function continuePayment() {
    if (!appt || appt === 'notfound' || paymentBusy) return;
    const booking = appt.booking;
    const legacyCardPending =
      !booking &&
      appointmentPaymentIsPending(appt) &&
      ['card', 'self-pay-card', 'self_pay_card', 'self-pay'].includes(
        String(appt.paymentMethod || '').trim().toLowerCase(),
      );
    const legacyStartsAtMs = Date.parse(String(appt.startsAt || ''));

    if (
      legacyCardPending &&
      Number.isFinite(legacyStartsAtMs) &&
      legacyStartsAtMs <= Date.now()
    ) {
      setPaymentMessage(
        'This appointment time has passed. Payment cannot be resumed; choose a new live clinician slot instead.',
      );
      return;
    }

    if (!booking?.canResumePayment && !legacyCardPending) {
      setPaymentMessage(
        booking?.requiresSponsorReview
          ? 'Medical Aid / sponsor authorisation is still being reviewed.'
          : 'This booking does not currently have a resumable payment action.',
      );
      await refreshAppointment();
      return;
    }

    setPaymentBusy(true);
    setPaymentMessage('');
    try {
      const email = await patientCheckoutEmail();
      if (!email) {
        throw new Error('A patient email is required for secure card checkout. Please update your profile and try again.');
      }

      const key =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': key,
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          action: 'initialize',
          appointmentId: appt.id,
          paymentMethod: 'CARD',
          email,
          callbackUrl: `${window.location.origin}/payments/return?appointmentId=${encodeURIComponent(appt.id)}`,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `Payment could not be resumed (HTTP ${response.status}).`);
      }

      const redirectUrl = String(data?.redirectUrl || data?.redirect_url || '').trim();
      if (!redirectUrl) {
        await refreshAppointment();
        throw new Error('Secure payment was prepared but no payment redirect was returned. Please try again.');
      }

      window.location.href = redirectUrl;
    } catch (error: any) {
      setPaymentMessage(error?.message || 'Could not resume payment. Please try again.');
      await refreshAppointment();
    } finally {
      setPaymentBusy(false);
    }
  }

  async function cancelPendingBooking() {
    if (!appt || appt === 'notfound' || paymentBusy) return;
    if (!window.confirm('Cancel this pending booking and release the reserved appointment time?')) return;

    setPaymentBusy(true);
    setPaymentMessage('');
    try {
      const key =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': key,
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          action: 'cancel_booking',
          appointmentId: appt.id,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not cancel this pending booking.');
      }
      setPaymentMessage('Booking cancelled and the appointment time has been released.');
      await refreshAppointment();
    } catch (error: any) {
      setPaymentMessage(error?.message || 'Could not cancel this pending booking.');
    } finally {
      setPaymentBusy(false);
    }
  }

  async function switchFundingToCard() {
    if (!appt || appt === 'notfound' || paymentBusy) return;
    setPaymentBusy(true);
    setPaymentMessage('');
    try {
      const key =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-idempotency-key': key,
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          action: 'switch_funding_to_card',
          appointmentId: appt.id,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Could not switch this booking to Card / Self-pay.');
      }
      setPaymentMessage('Funding changed to Card / Self-pay. You can now continue to secure payment.');
      await refreshAppointment();
    } catch (error: any) {
      setPaymentMessage(error?.message || 'Could not change the funding method.');
    } finally {
      setPaymentBusy(false);
    }
  }

  if (loading) {
    return (
      <main data-p-ui="patient-appointment-detail-page" className="min-w-0 overflow-x-clip p-6">
        <div className="rounded-xl border p-4 bg-white">Loading appointment…</div>
      </main>
    );
  }

  if (appt === 'notfound' || appt === null) {
    return (
      <main data-p-ui="patient-appointment-detail-page" className="min-w-0 overflow-x-clip p-6">
        <div className="rounded-xl border p-4 bg-white">Appointment not found.</div>
        <div className="mt-3">
          <Link
            href={subjectPatientId ? `/appointments?subjectPatientId=${encodeURIComponent(subjectPatientId)}${relationshipId ? `&relationshipId=${encodeURIComponent(relationshipId)}` : ''}` : '/appointments'}
            className="text-sm text-blue-700 underline"
          >
            ← Back to appointments
          </Link>
        </div>
      </main>
    );
  }

  const start = new Date(appt.startsAt);
  const end = new Date(appt.endsAt);

  async function loadReimbursementClaims() {
    setReimbursementLoading(true);
    try {
      const res = await fetch(
        `/api/member-reimbursement-claims?appointmentId=${encodeURIComponent(id)}`,
        {
          cache: 'no-store',
        },
      );

      const data = await res.json().catch(() => ({} as any));
      setReimbursementClaims(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setReimbursementClaims([]);
    } finally {
      setReimbursementLoading(false);
    }
  }

  async function submitReimbursementClaim() {
    if (!appt || appt === 'notfound') return;

    setReimbursementBusy(true);
    setReimbursementMessage('');

    try {
      const res = await fetch('/api/member-reimbursement-claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appt.id,
          patientId: appt.subjectPatientId || appt.patientId || undefined,
          requestedAmountMinor: appt.priceCents || undefined,
          currency: appt.currency || 'ZAR',
          reason: 'PATIENT_CARD_PAYMENT_REIMBURSEMENT',
          notes: 'Patient submitted claim-back request from completed card-paid appointment.',
        }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || data?.error || 'Could not submit reimbursement claim.');
      }

      setReimbursementMessage(
        data?.duplicate
          ? 'A reimbursement claim already exists for this appointment.'
          : 'Reimbursement claim submitted.',
      );

      await loadReimbursementClaims();
    } catch (e: any) {
      setReimbursementMessage(e?.message || 'Could not submit reimbursement claim.');
    } finally {
      setReimbursementBusy(false);
    }
  }

  async function uploadReimbursementEvidence(claimId: string) {
    if (!evidenceFile) {
      setReimbursementMessage('Please choose a file first.');
      return;
    }

    setEvidenceBusy(true);
    setReimbursementMessage('');

    try {
      const fd = new FormData();
      fd.set('file', evidenceFile);

      const res = await fetch(
        `/api/member-reimbursement-claims/${encodeURIComponent(claimId)}/evidence`,
        {
          method: 'POST',
          body: fd,
        },
      );

      const payload = await res.json().catch(() => null);

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Evidence upload failed.');
      }

      setEvidenceFile(null);
      setReimbursementMessage('Evidence uploaded. Your claim is back under review.');
      await loadReimbursementClaims();
    } catch (e: any) {
      setReimbursementMessage(e?.message || 'Evidence upload failed.');
    } finally {
      setEvidenceBusy(false);
    }
  }

  const submitRating = async () => {
    if (!canRate) return;
    const s = Number(ratingScore);
    if (!Number.isFinite(s) || s < 1 || s > 5) return;

    setSavingRating(true);
    const payload: Rating = {
      score: s as any,
      comment: ratingComment.trim() ? ratingComment.trim() : null,
      createdAt: new Date().toISOString(),
    };

    const saved = await submitAppointmentRating(appt.id, payload, me);
    if (saved) {
      setRating(saved);
      setRatingScore(saved.score);
      setRatingComment(saved.comment ?? '');
      setRatingOpen(false);

      const qs = new URLSearchParams();
      if (subjectPatientId) qs.set('subjectPatientId', subjectPatientId);
      if (relationshipId) qs.set('relationshipId', relationshipId);
      router.replace(`/appointments/${encodeURIComponent(appt.id)}${qs.toString() ? `?${qs.toString()}` : ''}`);
    } else {
      alert('Failed to submit rating. Please try again.');
    }
    setSavingRating(false);
  };

  const backHref = subjectPatientId
    ? `/appointments?subjectPatientId=${encodeURIComponent(subjectPatientId)}${relationshipId ? `&relationshipId=${encodeURIComponent(relationshipId)}` : ''}`
    : '/appointments';

  const joinHref = lobbyHrefForAppointment(appt);
  const joinReason = appointmentJoinBlockReason(appt);

  const booking = appt.booking || null;
  const bookingStatus = String(booking?.status || '').trim().toUpperCase();
  const bookingCurrency = String(booking?.currency || appt.currency || 'ZAR').trim().toUpperCase() || 'ZAR';
  const holdExpiresAtMs = Date.parse(String(booking?.holdExpiresAt || ''));
  const holdStillActive = Boolean(
    booking?.holdActive &&
      Number.isFinite(holdExpiresAtMs) &&
      holdExpiresAtMs > clockNow,
  );
  const holdRemaining = booking?.holdExpiresAt
    ? holdCountdown(booking.holdExpiresAt, clockNow)
    : null;
  const bookingTerminal = ['CONFIRMED', 'CANCELLED', 'EXPIRED'].includes(bookingStatus);
  const bookingNeedsAction = Boolean(
    booking &&
      !bookingTerminal &&
      (appointmentPaymentIsPending(appt) ||
        appointmentPaymentIsFailed(appt) ||
        booking?.requiresSponsorReview ||
        booking?.requiresExplicitFundingChange ||
        booking?.canResumePayment),
  );
  const legacyCardPending = Boolean(
    !booking &&
      appointmentPaymentIsPending(appt) &&
      ['card', 'self-pay-card', 'self_pay_card', 'self-pay'].includes(
        String(appt.paymentMethod || '').trim().toLowerCase(),
      ),
  );
  const appointmentStartMs = start.getTime();
  const legacyPaymentWindowClosed = Boolean(
    legacyCardPending &&
      Number.isFinite(appointmentStartMs) &&
      appointmentStartMs <= clockNow,
  );
  const showBookingRecovery = bookingNeedsAction || legacyCardPending;
  const canCancelPending = Boolean(booking && holdStillActive && !bookingTerminal);
  const canContinuePayment = Boolean(
    (booking?.canResumePayment && holdStillActive) ||
      (legacyCardPending && !legacyPaymentWindowClosed),
  );
  const fundingQuery =
    String(booking?.fundingMethod || appt.paymentMethod || '').toUpperCase() === 'MEDICAL_AID'
      ? 'medical_aid'
      : String(booking?.fundingMethod || appt.paymentMethod || '').toUpperCase() === 'VOUCHER'
        ? 'voucher'
        : 'card';
  const rebookHref = appt.clinicianId
    ? `/clinicians/${encodeURIComponent(appt.clinicianId)}/calendar?type=standard&country=ZA&funding=${fundingQuery}`
    : '/clinicians?class=doctor';

  return (
    <main data-p-ui="patient-appointment-detail-page" className="min-w-0 overflow-x-clip p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Appointment</h1>

      {subjectPatientId && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 text-sm text-amber-900">
          Acting for subject patient <span className="font-medium">{subjectPatientId}</span>
        </div>
      )}

      <div className="text-sm grid md:grid-cols-2 gap-2 border rounded p-4 bg-white">
        <div>
          <span className="opacity-60">When:</span> {start.toLocaleString()} –{' '}
          {end.toLocaleTimeString()}
        </div>
        <div>
          <span className="opacity-60">Clinician:</span>{' '}
          {appt.clinicianName ?? 'Clinician'}
        </div>
        <div>
          <span className="opacity-60">Reason:</span> {appt.reason ?? 'Consultation'}
        </div>
        <div>
          <span className="opacity-60">Status:</span>{' '}
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
            {appt.status}
          </span>
        </div>

        {appt.location && (
          <div className="md:col-span-2">
            <span className="opacity-60">Location:</span> {appt.location}
          </div>
        )}

        {appt.prep && (
          <div className="md:col-span-2">
            <span className="opacity-60">Preparation:</span> {appt.prep}
          </div>
        )}
      </div>

      {showBookingRecovery ? (
        <section
          id="booking-payment"
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm"
          aria-live="polite"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-base font-semibold text-amber-950">
                {booking?.requiresSponsorReview
                  ? 'Medical Aid / sponsor authorisation in progress'
                  : booking?.requiresExplicitFundingChange
                    ? 'Funding decision required'
                    : legacyPaymentWindowClosed
                      ? 'Payment window closed'
                      : appointmentPaymentIsFailed(appt)
                        ? 'Payment needs attention'
                        : 'Booking awaiting payment'}
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-amber-900">
                {booking?.requiresSponsorReview
                  ? 'Your appointment time is reserved while the selected Medical Aid / sponsor authorisation is reviewed. No card charge will be started during sponsor review.'
                  : booking?.requiresExplicitFundingChange
                    ? 'The selected Medical Aid / sponsor route was not approved. Ambulant+ will not silently switch you to self-pay; choose Card / Self-pay only if you want to continue on that basis.'
                    : legacyPaymentWindowClosed
                      ? 'This earlier Card / Self-pay appointment is already past its scheduled start time. Payment cannot be resumed for it; choose a new live clinician slot.'
                      : booking
                        ? 'This is the same booking and reserved clinician slot. Continue payment to complete it; a payment retry does not create a second appointment.'
                        : 'This earlier Card / Self-pay booking is still awaiting payment. Continue checkout to complete the existing appointment.'}
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
              {booking ? bookingFundingLabel(booking.fundingMethod) : 'Card / Self-pay'}
            </span>
          </div>

          {booking ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-amber-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Reserved until</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {booking.holdExpiresAt
                    ? new Date(booking.holdExpiresAt).toLocaleString()
                    : 'Reservation time unavailable'}
                </div>
                <div className={`mt-1 text-xs font-medium ${holdStillActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {holdStillActive && holdRemaining
                    ? `${holdRemaining} remaining`
                    : 'Reservation expired'}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Funding</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {bookingFundingLabel(booking.fundingMethod)}
                </div>
                {booking.coverageAuthorizationStatus ? (
                  <div className="mt-1 text-xs text-slate-600">
                    Authorisation: {String(booking.coverageAuthorizationStatus).replace(/_/g, ' ')}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-amber-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Patient amount</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {moneyMinor(booking.patientPayableMinor || 0, bookingCurrency)}
                </div>
                <div className="mt-1 text-xs text-slate-600">Due from patient</div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Sponsor / voucher</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {moneyMinor(booking.sponsorAmountMinor || 0, bookingCurrency)}
                </div>
                <div className="mt-1 text-xs text-slate-600">Current contribution</div>
              </div>
            </div>
          ) : null}

          {booking && !holdStillActive && !bookingTerminal ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
              The checkout reservation has expired. The clinician slot is released by the booking authority and cannot be revived by a late payment. Choose a new live slot to continue.
            </div>
          ) : null}

          {booking && holdStillActive ? (
            <div className="mt-4 text-xs leading-5 text-amber-900">
              If this reservation expires before payment or authorisation completes, Ambulant+ terminates the pending booking, invalidates active payment attempts and releases the clinician slot for booking again.
            </div>
          ) : null}

          {paymentMessage ? (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
              {paymentMessage}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {canContinuePayment ? (
              <button
                type="button"
                onClick={() => void continuePayment()}
                disabled={paymentBusy}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paymentBusy ? 'Preparing secure payment…' : 'Continue to payment'}
              </button>
            ) : null}

            {booking?.requiresExplicitFundingChange && holdStillActive ? (
              <button
                type="button"
                onClick={() => void switchFundingToCard()}
                disabled={paymentBusy}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Switch to Card / Self-pay
              </button>
            ) : null}

            {canCancelPending ? (
              <button
                type="button"
                onClick={() => void cancelPendingBooking()}
                disabled={paymentBusy}
                className="rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel booking
              </button>
            ) : null}

            {(booking && !holdStillActive) || legacyPaymentWindowClosed ? (
              <Link
                href={rebookHref}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Choose a new live slot
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="border rounded p-4 bg-white space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">Visit rating</div>

          {canRate && !hasRating && (
            <button
              className="text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              onClick={() => setRatingOpen(true)}
            >
              ★ Rate visit
            </button>
          )}
        </div>

        {!canRate && (
          <div className="text-xs text-gray-500">
            Rating becomes available once the visit is <span className="font-medium">Completed</span>.
          </div>
        )}

        {canRate && rating === undefined && (
          <div className="text-xs text-gray-400">Checking rating…</div>
        )}

        {canRate && rating === null && (
          <div className="text-xs text-gray-600">
            You haven’t rated this visit yet.
          </div>
        )}

        {hasRating && rating && (
          <div className="text-sm">
            <div className="inline-flex items-center gap-2">
              <span className="text-amber-600">{starsText(rating.score)}</span>
              <span className="text-xs text-gray-500">
                {rating.createdAt ? new Date(rating.createdAt).toLocaleString() : ''}
              </span>
            </div>
            {rating.comment ? (
              <div className="mt-2 text-xs text-gray-700 border rounded p-2 bg-gray-50">
                {rating.comment}
              </div>
            ) : (
              <div className="mt-2 text-xs text-gray-500">No comment.</div>
            )}
          </div>
        )}
      </section>

      <section className="border rounded p-4 bg-white space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium">Medical Aid claim-back</div>
            <div className="mt-1 text-xs text-gray-500">
              For card/self-paid visits that may qualify for reimbursement from your Medical Aid or sponsor.
            </div>
          </div>

          {isCardPaidAppointment(appt) && reimbursementClaims.length === 0 ? (
            <button
              type="button"
              onClick={submitReimbursementClaim}
              disabled={reimbursementBusy}
              className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              {reimbursementBusy ? 'Submitting…' : 'Claim reimbursement'}
            </button>
          ) : null}
        </div>

        {reimbursementMessage ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {reimbursementMessage}
          </div>
        ) : null}

        {reimbursementLoading ? (
          <div className="text-xs text-gray-500">Checking reimbursement status…</div>
        ) : reimbursementClaims.length > 0 ? (
          <div className="space-y-2">
            {reimbursementClaims.map((claim) => (
              <div key={claim.id} className="rounded border bg-gray-50 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {claim.claimNumber}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 ${reimbursementTone(claim.status)}`}>
                    {claim.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <span className="text-gray-500">Requested:</span>{' '}
                    {moneyMinor(claim.requestedAmountMinor, claim.currency || 'ZAR')}
                  </div>
                  <div>
                    <span className="text-gray-500">Approved:</span>{' '}
                    {moneyMinor(claim.approvedAmountMinor, claim.currency || 'ZAR')}
                  </div>
                  <div>
                    <span className="text-gray-500">Paid:</span>{' '}
                    {moneyMinor(claim.paidAmountMinor, claim.currency || 'ZAR')}
                  </div>
                </div>

                {claim.reason ? (
                  <div className="mt-2 text-gray-600">Reason: {claim.reason}</div>
                ) : null}

                {claim.remittanceRef ? (
                  <div className="mt-1 text-gray-600">Remittance: {claim.remittanceRef}</div>
                ) : null}

                {['REQUEST_INFO', 'SUBMITTED', 'UNDER_REVIEW'].includes(String(claim.status || '').toUpperCase()) ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-900">
                      Upload reimbursement evidence
                    </div>
                    <div className="mt-1 text-xs text-amber-800">
                      Attach proof of payment, invoice, receipt, benefit statement, or supporting document.
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
                        onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                        className="text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => uploadReimbursementEvidence(claim.id)}
                        disabled={evidenceBusy || !evidenceFile}
                        className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {evidenceBusy ? 'Uploading…' : 'Upload evidence'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : isCardPaidAppointment(appt as Appt) ? (
          <div className="text-xs text-gray-600">
            This completed card-paid visit is eligible for a reimbursement request.
          </div>
        ) : (
          <div className="text-xs text-gray-500">
            Claim-back becomes available after a completed card/self-paid visit.
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <Link
          className={`border rounded px-3 py-1 text-sm ${
            canJoin
              ? 'border-blue-600 text-blue-700 hover:bg-blue-50'
              : 'border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          href={canJoin ? joinHref : '#'}
          aria-disabled={!canJoin}
          title={canJoin ? 'Open pre-visit lobby' : joinReason}
        >
          {canJoin ? 'Open lobby' : 'Join locked'}
        </Link>

        {!canJoin && joinReason ? (
          <span className="self-center text-xs text-amber-700">
            {joinReason}
          </span>
        ) : null}

        <Link className="underline text-sm self-center" href={backHref}>
          ← Back
        </Link>
      </div>

      {ratingOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 grid place-items-center p-4"
          onClick={() => setRatingOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold">Rate this visit</div>

            {!canRate && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                Rating is available only after the consultation is properly completed.
              </div>
            )}

            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const v = i + 1;
                const on = ratingScore >= v;
                return (
                  <button
                    key={v}
                    onClick={() => setRatingScore(v)}
                    className={`text-2xl leading-none ${on ? 'text-amber-500' : 'text-gray-300'}`}
                    aria-label={`Set rating ${v}`}
                    disabled={!canRate}
                  >
                    ★
                  </button>
                );
              })}
              <span className="ml-2 text-sm text-gray-600">
                {ratingScore ? `${ratingScore}/5` : 'Select'}
              </span>
            </div>

            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={4}
              placeholder="Optional comment…"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              disabled={!canRate}
            />

            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                onClick={() => setRatingOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                onClick={submitRating}
                disabled={!canRate || !ratingScore || savingRating}
              >
                {savingRating ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}