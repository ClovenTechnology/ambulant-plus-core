//apps/clinician-app/app/training/schedule/page.tsx
'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Truck,
  Video,
  MapPin,
  BadgeCheck,
  Download,
  FileBadge2,
  PlayCircle,
} from 'lucide-react';

type TrainingMode = 'virtual' | 'in_person';

type TrainingSlot = {
  id: string;
  startAt: string;
  endAt: string;
  seatsLeft?: number | null;
};

type TrainingContext = {
  ok: boolean;
  clinician?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    specialty?: string | null;
    status?: string | null;
  };
  onboarding?: {
    stage?:
      | 'applied'
      | 'screened'
      | 'approved'
      | 'rejected'
      | 'training_scheduled'
      | 'training_completed'
      | string;
    notes?: string | null;
    depositPaid?: boolean | null;
    paymentPlan?: string | null;
    paymentStatus?: string | null;
    amountPaidCents?: number | null;
    outstandingCents?: number | null;
    initialRequirementMet?: boolean | null;
    nextPaymentAt?: string | null;
    waiverActive?: boolean | null;
  } | null;
  training?: {
    status?: 'scheduled' | 'completed' | 'canceled' | string;
    startAt?: string | null;
    endAt?: string | null;
    mode?: TrainingMode | null;
    joinUrl?: string | null;
    paid?: boolean | null;
    currency?: string | null;
    feeCents?: number | null;

    certificateNumber?: string | null;
    certificateCompletedAt?: string | null;
    certificateInstitution?: string | null;
    certificateAvailable?: boolean | null;
    certificateUrl?: string | null;
  } | null;
  dispatch?: {
    status?: 'pending' | 'packed' | 'shipped' | 'delivered' | 'canceled' | string;
    courierName?: string | null;
    trackingCode?: string | null;
    trackingUrl?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
  pricing?: {
    currency: string;
    trainingFeeCents: number;
    paymentProvider: 'stripe' | 'paystack' | 'payfast' | 'ozow' | 'unknown';
    cardPaymentEnabled?: boolean | null;
    manualPaymentEnabled?: boolean | null;
    minimumInitialPaymentCents?: number | null;
    allowPartialPayment?: boolean | null;
    balanceRecoveryMode?: string | null;
    balanceRecoveryNotes?: string | null;
    amountPaidCents?: number | null;
    outstandingCents?: number | null;
    initialPaymentDueCents?: number | null;
    paymentStatus?: string | null;
    initialRequirementMet?: boolean | null;
    fullyPaid?: boolean | null;
    paymentPlan?: string | null;
    waiverActive?: boolean | null;
    temporaryTrainingDevicesAllowed?: boolean | null;
    permanentStarterKitRequiresDepositOrFullPayment?: boolean | null;
    configured?: boolean | null;
  };
  bankInstructions?: Record<string, any> | null;
  starterKitItems?: string[];
  error?: unknown;
};

function errorToMessage(value: unknown, fallback = 'Something went wrong. Please try again or contact Ambulant+ support.') {
  if (!value) return fallback;

  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return fallback;
    if (v === '[object Object]') return fallback;
    if (v === 'clinicianId_required') return 'We could not identify your clinician profile. Please use the training link from your signup email or sign in again.';
    if (v === 'clinician_not_found') return 'We could not find this clinician application. Please check your training link or contact Ambulant+ support.';
    if (v.includes('DATABASE_URL') || v.toLowerCase().includes('prisma')) {
      return 'This service is temporarily unable to reach the database. Please try again shortly.';
    }
    return v.length > 220 ? fallback : v.replace(/_/g, ' ');
  }

  if (value instanceof Error) return errorToMessage(value.message, fallback);

  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    return errorToMessage(obj.error || obj.message || obj.reason || obj.detail, fallback);
  }

  return fallback;
}

function apiError(body: unknown, fallback: string) {
  return errorToMessage(body, fallback);
}

function money(cents: number, currency: string) {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function fmt(dtIso: string) {
  const d = new Date(dtIso);
  return new Intl.DateTimeFormat('en-ZA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtDateOnly(dtIso?: string | null) {
  if (!dtIso) return '-';
  const d = new Date(dtIso);
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(d);
}

function fmtTime(dtIso: string) {
  const d = new Date(dtIso);
  return new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function makeICS({
  title,
  startIso,
  endIso,
  description,
  location,
}: {
  title: string;
  startIso: string;
  endIso: string;
  description?: string;
  location?: string;
}) {
  const toUtc = (iso: string) => {
    const d = new Date(iso);
    const pad = (x: number) => String(x).padStart(2, '0');
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z'
    );
  };

  const uid = `ambulant-training-${Math.random().toString(36).slice(2)}@ambulant.plus`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ambulant+//Training//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtc(new Date().toISOString())}`,
    `DTSTART:${toUtc(startIso)}`,
    `DTEND:${toUtc(endIso)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\\r\\n');
}

function certificateHref(_rawUrl: string | null | undefined, clinicianId: string) {
  if (!clinicianId) return null;
  return `/api/training/certificate?clinicianId=${encodeURIComponent(clinicianId)}&download=1`;
}

function StepPill({
  active,
  done,
  icon,
  label,
}: {
  active?: boolean;
  done?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const tone = done
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : active
      ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
      : 'border-gray-200 bg-white text-gray-600';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${tone}`}>
      <span className="opacity-80">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}


function EnterpriseOnboardingPolicyCard({
  ctx,
  pricing,
  starterKit,
}: {
  ctx: TrainingContext | null;
  pricing: NonNullable<TrainingContext['pricing']>;
  starterKit: string[];
}) {
  const currency = pricing.currency || 'ZAR';
  const fullFee = Math.max(0, Math.round(Number(pricing.trainingFeeCents || 0)));
  const minimumDue = Math.max(
    0,
    Math.round(Number(pricing.initialPaymentDueCents ?? pricing.minimumInitialPaymentCents ?? fullFee)),
  );
  const outstanding = Math.max(0, Math.round(Number(pricing.outstandingCents ?? ctx?.onboarding?.outstandingCents ?? fullFee)));
  const amountPaid = Math.max(0, Math.round(Number(pricing.amountPaidCents ?? ctx?.onboarding?.amountPaidCents ?? 0)));
  const waiverActive = pricing.waiverActive === true || ctx?.onboarding?.waiverActive === true || ctx?.onboarding?.paymentPlan === 'WAIVER_TRAIN_NOW_PAY_LATER';
  const depositMet = pricing.initialRequirementMet === true || ctx?.onboarding?.initialRequirementMet === true || ctx?.onboarding?.depositPaid === true;
  const permanentLocked = pricing.permanentStarterKitRequiresDepositOrFullPayment !== false && !depositMet && !pricing.fullyPaid;
  const bank = ctx?.bankInstructions || {};

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-900">
            <ShieldCheck className="h-4 w-4" />
            Admin-configured onboarding policy
          </div>
          <h2 className="mt-3 text-lg font-black text-slate-950">C-Med Kit, payment and device release terms</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
            These fee, deposit, payment-method and C-Med StarterKit rules are controlled by Ambulant+ Admin. Training may proceed after card payment, confirmed EFT/manual authorisation, or approved waiver/pay-later authorisation.
          </p>
        </div>

        <div className="grid min-w-[220px] gap-2 rounded-xl border bg-slate-50 p-3 text-xs">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Full onboarding fee</span>
            <span className="font-black text-slate-900">{fullFee > 0 ? money(fullFee, currency) : 'Not configured'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Minimum deposit</span>
            <span className="font-black text-slate-900">{minimumDue > 0 ? money(minimumDue, currency) : 'Admin review'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Paid/credited</span>
            <span className="font-black text-slate-900">{money(amountPaid, currency)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Outstanding</span>
            <span className="font-black text-slate-900">{money(outstanding, currency)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Truck className="h-4 w-4 text-indigo-700" />
            C-Med StarterKit contents
          </div>
          {starterKit.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {starterKit.map((item, index) => (
                <li key={`${item}-${index}`} className="rounded-lg border bg-white px-3 py-2 text-xs font-medium text-slate-700">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              C-Med StarterKit contents have not been configured by Admin yet. Please wait for Admin to publish the kit before relying on device-release information.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border bg-slate-50 p-4 text-xs text-slate-700">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <CreditCard className="h-4 w-4 text-indigo-700" />
              Accepted payment routes
            </div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-lg border bg-white px-3 py-2">
                Card/Paystack: <span className="font-bold">{pricing.cardPaymentEnabled === false ? 'Disabled by Admin' : 'Available if configured'}</span>
              </div>
              <div className="rounded-lg border bg-white px-3 py-2">
                EFT/manual proof: <span className="font-bold">{pricing.manualPaymentEnabled === false ? 'Disabled by Admin' : 'Available with Admin confirmation'}</span>
              </div>
              <div className="rounded-lg border bg-white px-3 py-2">
                Waiver/pay later: <span className="font-bold">{waiverActive ? 'Approved for this clinician' : 'Requires Admin approval and T&C'}</span>
              </div>
              {bank?.bankName || bank?.accountName || bank?.referenceFormat ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  EFT reference: {String(bank.referenceFormat || 'Use your full name and clinician ID as payment reference.')}
                </div>
              ) : null}
            </div>
          </div>

          <div className={`rounded-xl border p-4 text-xs ${permanentLocked ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <div className="font-black">
              {permanentLocked ? 'Permanent kit locked until deposit/full payment' : 'Permanent kit release condition met'}
            </div>
            <p className="mt-1 leading-relaxed">
              Temporary training devices may be loaned for training when Admin approves waiver/pay-later. Permanent C-Med Kit/device release requires the Admin-configured minimum deposit or full payment.
            </p>
            {pricing.balanceRecoveryNotes ? (
              <p className="mt-2 rounded-lg bg-white/70 p-2 leading-relaxed">
                Balance recovery note: {pricing.balanceRecoveryNotes}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}


function TrainingSchedulePageContent() {
  const router = useRouter();
  const sp = useSearchParams() ?? new URLSearchParams();

  const [clinicianId, setClinicianId] = useState<string>('');
  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [slots, setSlots] = useState<TrainingSlot[]>([]);
  const [mode, setMode] = useState<TrainingMode>('virtual');
  const [slotId, setSlotId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'pay' | 'done'>('pick');
  const [authorisationCode, setAuthorisationCode] = useState('');
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  useEffect(() => {
    const qId = sp.get('clinicianId') || '';
    const qSlotId = sp.get('slotId') || '';
    if (qSlotId) setSlotId(qSlotId);
    if (qId) {
      setClinicianId(qId);
      return;
    }
    try {
      const p = JSON.parse(localStorage.getItem('ambulant.profile') || '{}');
      if (p?.id) setClinicianId(String(p.id));
    } catch {
      // ignore
    }
  }, [sp]);

  async function load() {
    if (!clinicianId) return;
    setErr(null);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`/api/training/context?clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' }),
        fetch(`/api/training/slots?clinicianId=${encodeURIComponent(clinicianId)}`, { cache: 'no-store' }),
      ]);

      const c = (await cRes.json().catch(() => null)) as TrainingContext | null;
      const s = (await sRes.json().catch(() => null)) as { ok: boolean; slots: TrainingSlot[]; error?: string } | null;

      if (!cRes.ok || !c?.ok) throw new Error(apiError(c, 'Unable to load your training details right now.'));
      if (!sRes.ok || !s?.ok) throw new Error(apiError(s, 'Unable to load available training slots right now.'));

      setCtx(c);
      setSlots(s.slots || []);

      if (c.training?.status === 'training_completed' || c.training?.status === 'completed') {
        setStep('done');
      } else if (c.training?.status === 'scheduled' && c.training?.paid) {
        setStep('done');
      } else if (c.training?.status === 'scheduled' && !c.training?.paid) {
        setStep('pay');
      } else {
        setStep('pick');
      }

      if (c.training?.startAt) {
        const pre = (s.slots || []).find((x) => x.startAt === c.training?.startAt);
        if (pre) setSlotId(pre.id);
      }
    } catch (e: any) {
      setErr(errorToMessage(e, 'Unable to load your training details right now.'));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicianId]);

  const selectedSlot = useMemo(() => slots.find((x) => x.id === slotId) || null, [slots, slotId]);
  const pricing = ctx?.pricing || {
    currency: 'ZAR',
    trainingFeeCents: 0,
    paymentProvider: 'unknown' as const,
    cardPaymentEnabled: false,
    manualPaymentEnabled: false,
    minimumInitialPaymentCents: 0,
    allowPartialPayment: false,
    balanceRecoveryMode: 'manual',
    balanceRecoveryNotes: null,
    amountPaidCents: 0,
    outstandingCents: 0,
    initialPaymentDueCents: 0,
    paymentStatus: 'unpaid',
    initialRequirementMet: false,
    fullyPaid: false,
    paymentPlan: null,
    waiverActive: false,
    temporaryTrainingDevicesAllowed: false,
    permanentStarterKitRequiresDepositOrFullPayment: true,
    configured: false,
  };
  const feeLabel = pricing.trainingFeeCents > 0 ? money(pricing.trainingFeeCents, pricing.currency) : 'Not configured yet';

  const alreadyScheduled = ctx?.training?.status === 'scheduled';
  const alreadyCompleted =
    ctx?.training?.status === 'completed' || ctx?.onboarding?.stage === 'training_completed';
  const alreadyPaid = !!ctx?.training?.paid;

  const canProceedPick = !!selectedSlot && !!mode;

  async function proceedToPay() {
    setErr(null);
    if (!canProceedPick) return;
    setStep('pay');
  }

  async function startCardPayment() {
    setErr(null);
    setPaymentNotice(null);
    if (!selectedSlot) return;
    if (!pricing.configured || pricing.trainingFeeCents <= 0) {
      setErr('Training payment settings are not configured yet. Please contact Ambulant+ support.');
      return;
    }
    if (pricing.cardPaymentEnabled === false) {
      setErr('Card payment is currently disabled for clinician onboarding. Use an authorisation code if Admin has issued one.');
      return;
    }

    setBusy(true);
    try {
      const callbackUrl = `${window.location.origin}/training/schedule?clinicianId=${encodeURIComponent(
        clinicianId,
      )}&slotId=${encodeURIComponent(selectedSlot.id)}&reason=payment_callback`;

      const res = await fetch('/api/training/payment/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          slotId: selectedSlot.id,
          callbackUrl,
        }),
      });

      const js = await res.json().catch(() => null);
      if (!res.ok || !js?.ok) throw new Error(apiError(js, 'Payment initialisation failed.'));
      if (!js.redirectUrl) throw new Error('Payment checkout URL was not returned. Please contact Ambulant+ support.');

      window.location.href = js.redirectUrl;
    } catch (e: any) {
      setErr(errorToMessage(e, 'Payment initialisation failed.'));
      setBusy(false);
    }
  }

  async function verifyReturnedPayment(reference: string) {
    setErr(null);
    setPaymentNotice('Verifying payment...');
    setBusy(true);
    try {
      const res = await fetch('/api/training/payment/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          slotId: slotId || sp.get('slotId') || undefined,
          providerReference: reference,
        }),
      });
      const js = await res.json().catch(() => null);
      if (!res.ok || !js?.ok) throw new Error(apiError(js, 'Payment verification failed.'));
      await load();
      setStep('done');
      setPaymentNotice('Payment confirmed. Your training booking is now scheduled.');
    } catch (e: any) {
      setErr(errorToMessage(e, 'Payment verification failed.'));
      setPaymentNotice(null);
    } finally {
      setBusy(false);
    }
  }

  async function redeemAuthorisationCode() {
    setErr(null);
    setPaymentNotice(null);
    if (!selectedSlot) {
      setErr('Please select a training slot before using an authorisation code.');
      return;
    }
    const code = authorisationCode.trim();
    if (!code) {
      setErr('Enter the authorisation code issued by Admin.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/training/payment/authorisation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          slotId: selectedSlot.id,
          authorisationCode: code,
        }),
      });
      const js = await res.json().catch(() => null);
      if (!res.ok || !js?.ok) throw new Error(apiError(js, 'Authorisation failed.'));
      await load();
      setStep('done');
      setPaymentNotice('Authorisation accepted. Your training booking is now scheduled.');
    } catch (e: any) {
      setErr(errorToMessage(e, 'Authorisation failed.'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!clinicianId) return;
    const reference = sp.get('paymentRef') || sp.get('reference') || sp.get('trxref') || '';
    if (!reference) return;

    const key = `ambulant-training-payment-verified:${reference}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
    verifyReturnedPayment(reference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicianId, sp]);

  const trainingIcsHref = useMemo(() => {
    const t = ctx?.training;
    const c = ctx?.clinician;
    if (!t?.startAt || !t?.endAt) return null;

    const title = 'Ambulant+ - Mandatory Clinician Training';
    const description = [
      `Clinician: ${c?.name || c?.email || '-'}`,
      `Mode: ${t.mode || '-'}`,
      t.joinUrl ? `Join URL: ${t.joinUrl}` : 'Join URL: will be provided if virtual',
      '',
      'Note: You will not be visible to patients until training is completed and certified by Admin.',
    ].join('\n');

    const location = t.mode === 'in_person' ? 'Ambulant+ Training Centre (details will be sent)' : (t.joinUrl || 'Virtual');
    const ics = makeICS({ title, startIso: t.startAt, endIso: t.endAt, description, location });

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [ctx]);

  const certificateDownloadHref = certificateHref(ctx?.training?.certificateUrl, clinicianId);

  const starterKit = Array.isArray(ctx?.starterKitItems)
    ? ctx.starterKitItems.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  const trainingSlotIdForRoom =
    slotId ||
    (ctx?.training as any)?.trainingSlotId ||
    (ctx?.training as any)?.slotId ||
    ctx?.training?.startAt ||
    '';

  const trainingRoomId = trainingSlotIdForRoom
    ? `training-slot-${trainingSlotIdForRoom}`
    : '';

  const trainingRoomHref =
    ctx?.training?.mode === 'virtual' &&
    ctx?.training?.status === 'scheduled' &&
    ctx?.training?.startAt &&
    trainingRoomId
      ? `/training/room/${encodeURIComponent(trainingRoomId)}?trainingSlotId=${encodeURIComponent(trainingSlotIdForRoom)}`
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <EnterpriseOnboardingPolicyCard ctx={ctx} pricing={pricing} starterKit={starterKit} />

        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900">Mandatory Clinician Training</h1>
              <p className="text-sm text-slate-600">
                Book your onboarding session, complete payment, then we prepare your starter kit dispatch.
              </p>
              {ctx?.clinician?.name || ctx?.clinician?.email ? (
                <div className="mt-2 text-xs text-slate-600">
                  Signed up as <span className="font-medium text-slate-800">{ctx?.clinician?.name || '-'}</span>
                  {ctx?.clinician?.email ? <span className="text-slate-500"> - {ctx.clinician.email}</span> : null}
                  {ctx?.clinician?.specialty ? <span className="text-slate-500"> - {ctx.clinician.specialty}</span> : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <StepPill
                icon={<CalendarDays className="h-4 w-4" />}
                label="1) Book slot"
                active={step === 'pick'}
                done={step !== 'pick'}
              />
              <StepPill
                icon={<CreditCard className="h-4 w-4" />}
                label="2) Pay"
                active={step === 'pay'}
                done={step === 'done'}
              />
              <StepPill
                icon={<BadgeCheck className="h-4 w-4" />}
                label="3) Confirmed"
                active={step === 'done'}
                done={step === 'done'}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Visibility gate"
              text="You can log in, but you won't be visible to patients until training is completed and certified by Admin."
            />
            <InfoCard
              icon={<Truck className="h-5 w-5" />}
              title="Starter kit dispatch"
              text="After payment, we create your dispatch and Admin will add courier + tracking. You'll be notified automatically."
            />
            <InfoCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Fast onboarding"
              text="Once certified, your profile becomes active, insurance can be auto-attached (if enabled), and you can set fees + availability."
            />
          </div>
        </header>

        {!clinicianId ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-rose-700">
            Missing <code className="font-mono">clinicianId</code>. Use the training link from your email/SMS or sign in first.
          </div>
        ) : null}

        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {err}
          </div>
        ) : null}

        {paymentNotice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {paymentNotice}
          </div>
        ) : null}

        {!ctx ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading training context…
          </div>
        ) : null}

        {ctx && (alreadyScheduled || alreadyCompleted) ? (
          <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                    alreadyCompleted
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {alreadyCompleted ? 'Training completed' : 'Training scheduled'}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  {alreadyCompleted ? 'Your training completion' : 'Your booking'}
                </h2>
                <div className="mt-1 text-sm text-slate-700">
                  {ctx.training?.startAt ? (
                    <>
                      {fmt(ctx.training.startAt)} {'→'} {ctx.training?.endAt ? fmtTime(ctx.training.endAt) : '-'}
                    </>
                  ) : (
                    '-'
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  Mode: <span className="font-medium">{ctx.training?.mode === 'in_person' ? 'In person' : 'Virtual'}</span>
                  {ctx.training?.paid ? (
                    <span className="ml-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                      Paid
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                      Payment pending
                    </span>
                  )}
                </div>

                {ctx.training?.joinUrl && !alreadyCompleted ? (
                  <a
                    className="mt-2 inline-flex items-center gap-2 text-sm text-indigo-700 hover:underline"
                    href={ctx.training.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join link <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {trainingIcsHref && !alreadyCompleted ? (
                  <a
                    href={trainingIcsHref}
                    download="ambulant-training.ics"
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Add to calendar
                  </a>
                ) : null}

                {trainingRoomHref && !alreadyCompleted ? (
                  <a
                    href={trainingRoomHref}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Open training room
                  </a>
                ) : null}

                {ctx.training?.certificateAvailable && certificateDownloadHref ? (
                  <a
                    href={`${certificateDownloadHref || '#'}`}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Download certificate
                  </a>
                ) : null}

                {!alreadyPaid && !alreadyCompleted ? (
                  <button
                    type="button"
                    onClick={() => setStep('pay')}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Complete payment
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/auth/login')}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                  >
                    Go to login
                  </button>
                )}
              </div>
            </div>

            {ctx.training?.certificateAvailable ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                      <FileBadge2 className="h-4 w-4" />
                      Training certificate issued
                    </div>
                    <div className="mt-1 text-sm text-emerald-900">
                      Certificate No:{' '}
                      <span className="font-semibold">{ctx.training.certificateNumber || '-'}</span>
                    </div>
                    <div className="mt-1 text-xs text-emerald-800">
                      Completed: {fmtDateOnly(ctx.training.certificateCompletedAt)}
                    </div>
                    <div className="mt-1 text-xs text-emerald-800">
                      Institution: {ctx.training.certificateInstitution || 'Ambulant+ / Cloven Technology'}
                    </div>
                  </div>

                  {certificateDownloadHref ? (
                    <a
                      href={`${certificateDownloadHref || '#'}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold">Starter kit dispatch</div>
              {ctx.dispatch?.status ? (
                <div className="mt-1 text-xs text-slate-600 space-y-1">
                  <div>Status: <span className="font-medium capitalize">{ctx.dispatch.status}</span></div>
                  {ctx.dispatch.courierName ? <div>Courier: {ctx.dispatch.courierName}</div> : null}
                  {ctx.dispatch.trackingCode ? <div>Tracking: {ctx.dispatch.trackingCode}</div> : null}
                  {ctx.dispatch.trackingUrl ? (
                    <a className="inline-flex items-center gap-1 text-indigo-700 hover:underline" href={ctx.dispatch.trackingUrl} target="_blank" rel="noreferrer">
                      Track shipment <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <div className="text-[11px] text-slate-500">Tracking will appear after Admin assigns courier + tracking.</div>
                  )}
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-600">
                  Dispatch will be created after payment, then Admin assigns courier + tracking.
                </div>
              )}
            </div>
          </section>
        ) : null}

        {ctx && step === 'pick' && !alreadyScheduled && !alreadyCompleted ? (
          <section className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Choose training mode</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModeCard
                  active={mode === 'virtual'}
                  onClick={() => setMode('virtual')}
                  icon={<Video className="h-5 w-5" />}
                  title="Virtual"
                  subtitle="Join from anywhere. Link is issued after scheduling."
                />
                <ModeCard
                  active={mode === 'in_person'}
                  onClick={() => setMode('in_person')}
                  icon={<MapPin className="h-5 w-5" />}
                  title="In person"
                  subtitle="Training centre details will be sent after booking."
                />
              </div>

              <div className="pt-2">
                <h3 className="text-sm font-semibold text-slate-900">Pick a slot</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Select one slot. If you need a special time, contact support after booking and we'll adjust.
                </p>

                <div className="mt-3 space-y-2">
                  {slots.length === 0 ? (
                    <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
                      No slots available right now.
                    </div>
                  ) : (
                    slots.map((s) => {
                      const active = s.id === slotId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSlotId(s.id)}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            active ? 'border-indigo-300 bg-indigo-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{fmt(s.startAt)}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                {fmtTime(s.startAt)} {'→'} {fmtTime(s.endAt)}
                                {s.seatsLeft != null ? <span className="ml-2">- Seats left: {s.seatsLeft}</span> : null}
                              </div>
                            </div>
                            {active ? (
                              <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white">
                                Selected
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canProceedPick}
                    onClick={proceedToPay}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Continue to payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('pay')}
                    disabled={!selectedSlot}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Use payment authorisation code
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">What you'll receive</h2>
              <p className="text-sm text-slate-600">
                After payment, your starter kit dispatch is created. Admin will assign courier + tracking and you'll be notified automatically.
              </p>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-700">Starter kit contents</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
                  {starterKit.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-semibold">Training fee</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{feeLabel}</div>
                <div className="mt-1 text-xs text-slate-600">
                  Provider: <span className="font-medium">{pricing.paymentProvider}</span>
                  {pricing.configured === false ? <span className="ml-2 text-amber-700">Admin setup pending</span> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {ctx && step === 'pay' && !alreadyPaid && !alreadyCompleted ? (
          <section className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Payment</h2>
              <p className="text-sm text-slate-600">
                Pay to confirm your training booking. Immediately after payment we create your dispatch as <span className="font-medium">pending</span>,
                then Admin adds courier + tracking.
              </p>

              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">Training booking</div>
                    <div className="mt-1 text-sm text-slate-900">
                      {selectedSlot ? (
                        <>
                          {fmt(selectedSlot.startAt)} {'→'} {fmtTime(selectedSlot.endAt)} - {' '}
                          <span className="font-medium">{mode === 'in_person' ? 'In person' : 'Virtual'}</span>
                        </>
                      ) : (
                        <span className="text-slate-600">No slot selected (go back and choose one).</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-600">Amount</div>
                    <div className="text-xl font-bold text-slate-900">{feeLabel}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !selectedSlot || pricing.cardPaymentEnabled === false || pricing.configured === false}
                  onClick={startCardPayment}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Continue to Paystack checkout
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep('pick')}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">Manual/EFT payment</div>
                If you have already paid by EFT or direct transfer, Admin must first confirm your payment and issue a one-time authorisation code.
                Enter that code below to activate your training booking.
                {ctx.bankInstructions ? (
                  <pre className="mt-2 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">
                    {JSON.stringify(ctx.bankInstructions, null, 2)}
                  </pre>
                ) : null}
              </div>

              <div className="rounded-xl border bg-white p-4">
                <label className="text-xs font-semibold text-slate-700" htmlFor="authorisationCode">
                  Payment authorisation code
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="authorisationCode"
                    value={authorisationCode}
                    onChange={(e) => setAuthorisationCode(e.target.value)}
                    placeholder="Example: AMB-ABC123-DEF456"
                    className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    disabled={busy || !selectedSlot || pricing.manualPaymentEnabled === false}
                    onClick={redeemAuthorisationCode}
                    className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                  >
                    Verify code
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Next steps</h2>
              <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
                <li>Payment or a valid admin authorisation code confirms your slot.</li>
                <li>Dispatch is created (pending).</li>
                <li>Admin assigns courier + tracking on the onboarding board.</li>
                <li>You get email/SMS with tracking and starter kit contents.</li>
                <li>After training completion + admin certification, you become visible to patients.</li>
              </ol>
            </div>
          </section>
        ) : null}

        {ctx && step === 'done' && ctx.training?.startAt ? (
          <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  {alreadyCompleted ? 'Training completed' : 'Confirmed'}
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {alreadyCompleted ? 'Training completed successfully' : 'Training booked successfully'}
                </h2>
                <div className="text-sm text-slate-700">
                  {fmt(ctx.training.startAt)} {'→'} {ctx.training?.endAt ? fmtTime(ctx.training.endAt) : '-'} - {' '}
                  <span className="font-medium">{ctx.training.mode === 'in_person' ? 'In person' : 'Virtual'}</span>
                </div>
                {ctx.training.joinUrl && !alreadyCompleted ? (
                  <a
                    className="inline-flex items-center gap-2 text-sm text-indigo-700 hover:underline"
                    href={ctx.training.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open join link <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {trainingIcsHref && !alreadyCompleted ? (
                  <a
                    href={trainingIcsHref}
                    download="ambulant-training.ics"
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Add to calendar
                  </a>
                ) : null}
                {trainingRoomHref && !alreadyCompleted ? (
                  <a
                    href={trainingRoomHref}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Open training room
                  </a>
                ) : null}
                {ctx.training?.certificateAvailable && certificateDownloadHref ? (
                  <a
                    href={`${certificateDownloadHref || '#'}`}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Download certificate
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => router.push('/auth/login')}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
                >
                  Continue to login
                </button>
              </div>
            </div>

            {ctx.training?.certificateAvailable ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                      <FileBadge2 className="h-4 w-4" />
                      Training certificate available
                    </div>
                    <div className="mt-1 text-sm text-emerald-900">
                      Certificate No:{' '}
                      <span className="font-semibold">{ctx.training.certificateNumber || '-'}</span>
                    </div>
                    <div className="mt-1 text-xs text-emerald-800">
                      Completed: {fmtDateOnly(ctx.training.certificateCompletedAt)}
                    </div>
                    <div className="mt-1 text-xs text-emerald-800">
                      Institution: {ctx.training.certificateInstitution || 'Ambulant+ / Cloven Technology'}
                    </div>
                  </div>

                  {certificateDownloadHref ? (
                    <a
                      href={`${certificateDownloadHref || '#'}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Starter kit (preparing)</div>
                <div className="mt-1 text-xs text-slate-600">
                  Tracking will be sent once Admin assigns courier + tracking number.
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-700 list-disc pl-5">
                  {starterKit.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4 space-y-2">
                <div className="text-sm font-semibold text-slate-900">Certification gate</div>
                <div className="text-sm text-slate-700">
                  After training, Admin will certify your profile. Only then you become visible to patients.
                </div>
                <div className="text-xs text-slate-600">
                  Current stage:{' '}
                  <span className="font-medium">{ctx.onboarding?.stage || ctx.clinician?.status || '-'}</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-900">
        <span className="text-slate-700">{icon}</span>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="mt-1 text-sm text-slate-600">{text}</div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? 'border-indigo-300 bg-indigo-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-700">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-600">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}



export default function TrainingSchedulePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
          <div className="mx-auto max-w-5xl p-6">
            <div className="rounded-xl border bg-white p-6 text-sm text-slate-600 flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
              Loading training schedule…
            </div>
          </div>
        </main>
      }
    >
      <TrainingSchedulePageContent />
    </Suspense>
  );
}
