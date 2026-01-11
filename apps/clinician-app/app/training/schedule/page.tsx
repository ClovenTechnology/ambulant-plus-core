//apps/clinician-app/app/training/schedule/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';

type TrainingMode = 'virtual' | 'in_person';

type TrainingSlot = {
  id: string;
  startAt: string; // ISO
  endAt: string; // ISO
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
    paymentProvider: 'mock' | 'stripe' | 'paystack' | 'ozow' | 'unknown';
  };
  starterKitItems?: string[];
  error?: string;
};

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
  // ICS wants UTC timestamps (YYYYMMDDTHHMMSSZ)
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

  return lines.join('\r\n');
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

export default function TrainingSchedulePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [clinicianId, setClinicianId] = useState<string>('');
  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [slots, setSlots] = useState<TrainingSlot[]>([]);
  const [mode, setMode] = useState<TrainingMode>('virtual');
  const [slotId, setSlotId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'pay' | 'done'>('pick');

  useEffect(() => {
    const qId = sp.get('clinicianId') || '';
    if (qId) {
      setClinicianId(qId);
      return;
    }
    // fallback: if clinician already logged in on this device
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

      if (!cRes.ok || !c?.ok) throw new Error(c?.error || `Failed to load training context`);
      if (!sRes.ok || !s?.ok) throw new Error(s?.error || `Failed to load training slots`);

      setCtx(c);
      setSlots(s.slots || []);

      // If already scheduled & paid, show done.
      if (c.training?.status === 'scheduled' && c.training?.paid) setStep('done');
      else if (c.training?.status === 'scheduled' && !c.training?.paid) setStep('pay');
      else setStep('pick');

      // preselect if already booked
      if (c.training?.startAt) {
        const pre = (s.slots || []).find((x) => x.startAt === c.training?.startAt);
        if (pre) setSlotId(pre.id);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicianId]);

  const selectedSlot = useMemo(() => slots.find((x) => x.id === slotId) || null, [slots, slotId]);
  const pricing = ctx?.pricing || { currency: 'ZAR', trainingFeeCents: 0, paymentProvider: 'unknown' as const };
  const feeLabel = money(pricing.trainingFeeCents, pricing.currency);

  const alreadyScheduled = ctx?.training?.status === 'scheduled';
  const alreadyPaid = !!ctx?.training?.paid;

  const canProceedPick = !!selectedSlot && !!mode;

  async function proceedToPay() {
    setErr(null);
    if (!canProceedPick) return;
    setStep('pay');
  }

  async function confirmAndPay() {
    setErr(null);
    if (!selectedSlot) return;
    setBusy(true);
    try {
      const res = await fetch('/api/training/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          slotId: selectedSlot.id,
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
          mode,
          payment: {
            provider: pricing.paymentProvider, // server will fallback to mock if unset
          },
        }),
      });
      const js = await res.json().catch(() => null);
      if (!res.ok || !js?.ok) throw new Error(js?.error || 'Booking failed');
      await load();
      setStep('done');
    } catch (e: any) {
      setErr(e?.message || 'Payment/booking failed');
    } finally {
      setBusy(false);
    }
  }

  const trainingIcsHref = useMemo(() => {
    const t = ctx?.training;
    const c = ctx?.clinician;
    if (!t?.startAt || !t?.endAt) return null;

    const title = 'Ambulant+ — Mandatory Clinician Training';
    const description = [
      `Clinician: ${c?.name || c?.email || '—'}`,
      `Mode: ${t.mode || '—'}`,
      t.joinUrl ? `Join URL: ${t.joinUrl}` : 'Join URL: will be provided if virtual',
      '',
      'Note: You will not be visible to patients until training is completed and certified by Admin.',
    ].join('\n');

    const location = t.mode === 'in_person' ? 'Ambulant+ Training Centre (details will be sent)' : (t.joinUrl || 'Virtual');
    const ics = makeICS({ title, startIso: t.startAt, endIso: t.endAt, description, location });

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [ctx]);

  const starterKit = ctx?.starterKitItems || [
    'DueCare 6-in-1 Health Monitor (IoMT)',
    'NexRing (IoMT)',
    'Digital Stethoscope (IoMT)',
    'HD Otoscope (IoMT)',
    'Clinician Handbook',
    'Consumables pack',
    'Ambulant+ formal shirt (Black)',
    'Ambulant+ formal shirt (White)',
    'Ambulant+ Mug',
    'Ambulant+ Thermo Bottle',
    'Smart ID + card holder + lanyard',
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        {/* Header */}
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900">Mandatory Clinician Training</h1>
              <p className="text-sm text-slate-600">
                Book your onboarding session, complete payment, then we prepare your starter kit dispatch.
              </p>
              {ctx?.clinician?.name || ctx?.clinician?.email ? (
                <div className="mt-2 text-xs text-slate-600">
                  Signed up as <span className="font-medium text-slate-800">{ctx?.clinician?.name || '—'}</span>
                  {ctx?.clinician?.email ? <span className="text-slate-500"> • {ctx.clinician.email}</span> : null}
                  {ctx?.clinician?.specialty ? <span className="text-slate-500"> • {ctx.clinician.specialty}</span> : null}
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

          {/* Gate notes */}
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Visibility gate"
              text="You can log in, but you won’t be visible to patients until training is completed and certified by Admin."
            />
            <InfoCard
              icon={<Truck className="h-5 w-5" />}
              title="Starter kit dispatch"
              text="After payment, we create your dispatch and Admin will add courier + tracking. You’ll be notified automatically."
            />
            <InfoCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Fast onboarding"
              text="Once certified, your profile becomes active, insurance can be auto-attached (if enabled), and you can set fees + availability."
            />
          </div>
        </header>

        {/* Errors / Loading */}
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

        {!ctx ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading training context…
          </div>
        ) : null}

        {/* Already scheduled summary */}
        {ctx && alreadyScheduled ? (
          <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Training scheduled
                </div>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Your booking</h2>
                <div className="mt-1 text-sm text-slate-700">
                  {ctx.training?.startAt ? (
                    <>
                      {fmt(ctx.training.startAt)} → {ctx.training?.endAt ? fmtTime(ctx.training.endAt) : '—'}
                    </>
                  ) : (
                    '—'
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

                {ctx.training?.joinUrl ? (
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
                {trainingIcsHref ? (
                  <a
                    href={trainingIcsHref}
                    download="ambulant-training.ics"
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Add to calendar
                  </a>
                ) : null}

                {!alreadyPaid ? (
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

            {/* Dispatch status (if exists) */}
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

        {/* Step: Pick */}
        {ctx && step === 'pick' && !alreadyScheduled ? (
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
                  Select one slot. If you need a special time, contact support after booking and we’ll adjust.
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
                                {fmtTime(s.startAt)} → {fmtTime(s.endAt)}
                                {s.seatsLeft != null ? <span className="ml-2">• Seats left: {s.seatsLeft}</span> : null}
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
                    onClick={() => router.push('/auth/login')}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    I already have an account
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">What you’ll receive</h2>
              <p className="text-sm text-slate-600">
                After payment, your starter kit dispatch is created. Admin will assign courier + tracking and you’ll be notified automatically.
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
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Step: Pay */}
        {ctx && step === 'pay' && !alreadyPaid ? (
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
                          {fmt(selectedSlot.startAt)} → {fmtTime(selectedSlot.endAt)} •{' '}
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
                  disabled={busy || !selectedSlot}
                  onClick={confirmAndPay}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Pay & confirm booking
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

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <div className="font-semibold">Note</div>
                This build is payment-provider ready. If you haven’t configured Stripe/Paystack/Ozow yet, the server will safely fall back to a “mock paid”
                mode for dev/testing.
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Next steps</h2>
              <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
                <li>Payment confirms your slot.</li>
                <li>Dispatch is created (pending).</li>
                <li>Admin assigns courier + tracking on the onboarding board.</li>
                <li>You get email/SMS with tracking and starter kit contents.</li>
                <li>After training completion + admin certification, you become visible to patients.</li>
              </ol>
            </div>
          </section>
        ) : null}

        {/* Step: Done */}
        {ctx && step === 'done' && ctx.training?.startAt ? (
          <section className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmed
                </div>
                <h2 className="text-xl font-semibold text-slate-900">Training booked successfully</h2>
                <div className="text-sm text-slate-700">
                  {fmt(ctx.training.startAt)} → {ctx.training?.endAt ? fmtTime(ctx.training.endAt) : '—'} •{' '}
                  <span className="font-medium">{ctx.training.mode === 'in_person' ? 'In person' : 'Virtual'}</span>
                </div>
                {ctx.training.joinUrl ? (
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
                {trainingIcsHref ? (
                  <a
                    href={trainingIcsHref}
                    download="ambulant-training.ics"
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    Add to calendar
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
                  After training, Admin will certify your profile (individually or by batch). Only then you become visible to patients.
                </div>
                <div className="text-xs text-slate-600">
                  Current stage:{' '}
                  <span className="font-medium">{ctx.onboarding?.stage || ctx.clinician?.status || '—'}</span>
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
