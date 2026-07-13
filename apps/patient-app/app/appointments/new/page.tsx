// apps/patient-app/app/appointments/new/page.tsx
'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type CareCircleMember = {
  patientId: string;
  name?: string | null;
  timezone?: string | null;
  relationshipId?: string | null;
};

type BookingParticipantRole =
  | 'observer'
  | 'care_ally'
  | 'second_patient_participant';

type AuthMe = {
  uid?: string | null;
  orgId?: string | null;
};

type PaymentChoice = 'card' | 'medical_aid';

type MedicalAidPolicy = {
  id: string;
  patientId: string;
  payerName: string;
  planName?: string;
  membershipNumber: string;
  dependentCode?: string;
  principalName?: string;
  telemedCover?: 'none' | 'full' | 'partial';
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
  active?: boolean;
  memberStatus?: string | null;
  eligibilityStatus?: string | null;
  verifiedUntil?: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  latestEligibility?: {
    status?: string | null;
    eligibilityStatus?: string | null;
    premiumStatus?: string | null;
    validTo?: string | null;
    effectiveTo?: string | null;
    reasonCode?: string | null;
    reasonText?: string | null;
    [key: string]: any;
  } | null;
  verificationStatus?: string;
  coverageStatus?: string;
  premiumStatus?: string;
  clientId?: string;
  metadata?: {
    clientId?: string;
    sponsorId?: string;
    planId?: string;
    packageName?: string;
    optionCode?: string;
    policyNumber?: string;
    networkName?: string;
    [key: string]: any;
  } | null;
};

type PreflightResult = {
  ok?: boolean;
  error?: string;
  conflicts?: any;
  warnings?: any[];
  sponsor?: {
    ok?: boolean;
    decision?: string;
    reason?: string;
    clientId?: string;
    clientMemberId?: string;
    coveragePlanId?: string;
    sponsorAmountMinor?: number;
    patientCopayMinor?: number;
    uncoveredGapMinor?: number;
    currency?: string;
    authorizationRequired?: boolean;
  };
  priceLock?: {
    token?: string;
    amountMinor?: number;
    currency?: string;
    expiresInSeconds?: number;
  };
  [key: string]: any;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function safeParseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function moneyMinor(value: unknown, currency = 'ZAR') {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(n / 100);
}

async function fetchAuthMe(): Promise<AuthMe | null> {
  try {
    const r = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as AuthMe;
  } catch {
    return null;
  }
}

function policyClientId(policy: MedicalAidPolicy | null) {
  if (!policy) return undefined;

  return (
    policy.clientId ||
    policy.metadata?.clientId ||
    policy.metadata?.sponsorId ||
    (policy.payerName?.toLowerCase().includes('ambulant demo')
      ? undefined
      : undefined)
  );
}

function policyUsable(policy: MedicalAidPolicy | null) {
  if (!policy) return false;

  const latest = policy.latestEligibility || null;

  const status = String(
    policy.eligibilityStatus ||
      latest?.eligibilityStatus ||
      latest?.status ||
      policy.coverageStatus ||
      policy.memberStatus ||
      '',
  ).toUpperCase();

  const premiumStatus = String(
    policy.premiumStatus ||
      latest?.premiumStatus ||
      '',
  ).toUpperCase();

  const blocked = new Set([
    'UNPAID',
    'INACTIVE',
    'SUSPENDED',
    'CANCELLED',
    'CANCELED',
    'EXPIRED',
    'UNVERIFIED',
    'FAILED',
    'LAPSED',
    'PENDING',
    'NOT_ELIGIBLE',
    'NOT_FOUND',
  ]);

  if (policy.active === false) return false;
  if (blocked.has(status)) return false;
  if (premiumStatus && blocked.has(premiumStatus)) return false;

  const validTo =
    policy.verifiedUntil ||
    latest?.validTo ||
    latest?.effectiveTo ||
    null;

  if (validTo) {
    const d = new Date(validTo);
    if (Number.isFinite(d.getTime()) && d.getTime() < Date.now()) return false;
  }

  return ['ACTIVE', 'VERIFIED', 'ELIGIBLE', 'PAID'].includes(status);
}

function policyPaymentLabel(policy: MedicalAidPolicy) {
  if (policyUsable(policy)) return '';

  const reason =
    policy.reasonText ||
    policy.latestEligibility?.reasonText ||
    policy.reasonCode ||
    policy.latestEligibility?.reasonCode ||
    policy.eligibilityStatus ||
    policy.premiumStatus ||
    'not verified for payment';

  return ` — ${String(reason).replace(/_/g, ' ').toLowerCase()}`;
}

function sponsorPatientPayable(preflight: PreflightResult | null) {
  const amount = Number(preflight?.priceLock?.amountMinor || 0);
  const sponsor = preflight?.sponsor;
  const decision = String(sponsor?.decision || '').toUpperCase();

  if (!sponsor) return amount;
  if (decision === 'COVERED') return Number(sponsor.patientCopayMinor || 0);
  if (decision === 'REQUIRES_AUTHORIZATION') return 0;
  if (decision === 'COVERED_WITH_COPAY') return Number(sponsor.patientCopayMinor || amount);
  return amount;
}

function sponsorTone(decision?: string) {
  const d = String(decision || '').toUpperCase();

  if (d === 'COVERED') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (d === 'COVERED_WITH_COPAY') return 'border-sky-200 bg-sky-50 text-sky-900';
  if (d === 'REQUIRES_AUTHORIZATION') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (d === 'NOT_COVERED' || d === 'NOT_ELIGIBLE') return 'border-rose-200 bg-rose-50 text-rose-900';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

function NewAppointmentPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const qs = sp ?? new URLSearchParams();

  const initialClinicianId = qs.get('clinicianId') || '';
  const initialSubjectPatientId = qs.get('subjectPatientId') || '';
  const initialRelationshipId = qs.get('relationshipId') || '';

  const [me, setMe] = useState<AuthMe | null>(null);
  const [profile, setProfile] = useState<any>(null);

  const [clinicianId, setClinicianId] = useState(initialClinicianId);

  const [careCircle, setCareCircle] = useState<CareCircleMember[]>([]);
  const [subjectPatientId, setSubjectPatientId] = useState(initialSubjectPatientId || 'me');
  const [relationshipId, setRelationshipId] = useState(initialRelationshipId || '');

  const now = useMemo(() => new Date(), []);
  const [dateStr, setDateStr] = useState(() => {
    const y = now.getFullYear();
    const m = pad2(now.getMonth() + 1);
    const d = pad2(now.getDate());
    return `${y}-${m}-${d}`;
  });

  const [timeStr, setTimeStr] = useState('09:00');
  const [durationMin, setDurationMin] = useState(45);
  const [reason, setReason] = useState('Consultation');

  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('card');
  const [policies, setPolicies] = useState<MedicalAidPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');

  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [observerName, setObserverName] = useState('');
  const [observerEmail, setObserverEmail] = useState('');
  const [observerPhone, setObserverPhone] = useState('');

  const [careAllyPatientId, setCareAllyPatientId] = useState('');
  const [secondPatientParticipantId, setSecondPatientParticipantId] = useState('');

  const joinableCareCircle = useMemo(
    () => careCircle.filter((m) => m.patientId !== subjectPatientId),
    [careCircle, subjectPatientId],
  );

  const patientId = profile?.patientId || profile?.id || '';
  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) || null;
  const selectedPolicyOk = policyUsable(selectedPolicy);
  const selectedClientId = policyClientId(selectedPolicy);

  useEffect(() => {
    (async () => {
      const auth = await fetchAuthMe();
      setMe(auth);
    })();
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        setProfile(data?.ok === false ? null : data);
      } catch {
        if (alive) setProfile(null);
      }
    }

    void loadProfile();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/care-circle', { cache: 'no-store' });
        if (!r.ok) return;

        const data = await r.json();

        const arr =
          (Array.isArray(data) && data) ||
          data?.members ||
          data?.careCircle ||
          [];

        const normalized: CareCircleMember[] = (arr || [])
          .map((x: any) => ({
            patientId: String(x.patientId || x.id || ''),
            name: x.name ?? null,
            timezone: x.timezone ?? null,
            relationshipId: x.relationshipId ?? null,
          }))
          .filter((m: CareCircleMember) => !!m.patientId);

        setCareCircle(normalized);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!patientId) return;

    let alive = true;

    async function loadPolicies() {
      try {
        const res = await fetch(`/api/medical-aids?patientId=${encodeURIComponent(patientId)}`, {
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({} as any));
        const items = Array.isArray(data?.items) ? data.items : [];

        if (!alive) return;

        setPolicies(items);

        const preferred = items.find((p: MedicalAidPolicy) => policyUsable(p));

        setSelectedPolicyId(preferred?.id || '');
      } catch {
        if (alive) setPolicies([]);
      }
    }

    void loadPolicies();

    return () => {
      alive = false;
    };
  }, [patientId]);

  useEffect(() => {
    setPreflight(null);
  }, [
    clinicianId,
    subjectPatientId,
    relationshipId,
    dateStr,
    timeStr,
    durationMin,
    paymentChoice,
    selectedPolicyId,
  ]);

  function buildParticipants() {
    const extraParticipants: Array<{
      role: BookingParticipantRole;
      patientId?: string;
      relationshipId?: string;
      email?: string;
      phone?: string;
      name?: string;
      required?: boolean;
    }> = [];

    if (observerEmail.trim() || observerPhone.trim()) {
      extraParticipants.push({
        role: 'observer',
        email: observerEmail.trim() || undefined,
        phone: observerPhone.trim() || undefined,
        name: observerName.trim() || undefined,
        required: false,
      });
    }

    if (careAllyPatientId.trim()) {
      const member = careCircle.find((m) => m.patientId === careAllyPatientId);

      extraParticipants.push({
        role: 'care_ally',
        patientId: careAllyPatientId,
        relationshipId: member?.relationshipId || undefined,
        name: member?.name || undefined,
        required: false,
      });
    }

    if (secondPatientParticipantId.trim()) {
      const member = careCircle.find((m) => m.patientId === secondPatientParticipantId);

      extraParticipants.push({
        role: 'second_patient_participant',
        patientId: secondPatientParticipantId,
        relationshipId: member?.relationshipId || undefined,
        name: member?.name || undefined,
        required: true,
      });
    }

    return extraParticipants;
  }

  function baseAppointmentPayload() {
    const start = new Date(`${dateStr}T${timeStr}`);
    const end = new Date(start.getTime() + durationMin * 60000);

    const extraParticipants = buildParticipants();

    const requiredPatientSeats =
      1 +
      (subjectPatientId !== 'me' ? 1 : 0) +
      extraParticipants.length;

    return {
      clinicianId,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      durationMin,
      reason,

      person:
        subjectPatientId === 'me'
          ? { mode: 'SELF' as const }
          : {
              mode: 'FAMILY' as const,
              subjectPatientId,
              relationshipId,
            },

      observers:
        observerEmail || observerPhone
          ? [
              {
                email: observerEmail || undefined,
                phone: observerPhone || undefined,
                name: observerName || undefined,
              },
            ]
          : [],

      participants: extraParticipants,

      multiparty:
        extraParticipants.length > 0 || subjectPatientId !== 'me'
          ? {
              enabled: true,
              requiredPatientSeats,
              requiredClinicianSeats: 1,
              preflightPolicy: 'all_required_green' as const,
            }
          : undefined,
    };
  }

  async function runPreflight(): Promise<PreflightResult> {
    setErr('');

    if (!clinicianId.trim()) {
      throw new Error('Clinician ID required');
    }

    if (paymentChoice === 'medical_aid') {
      if (!selectedPolicy) {
        throw new Error('Select a Medical Aid / sponsor policy first.');
      }

      if (!selectedPolicyOk) {
        throw new Error('This policy is not active/usable for sponsor payment.');
      }
    }

    setPreflightBusy(true);

    try {
      const base = baseAppointmentPayload();

      const res = await fetch('/api/appointments/preflight', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...base,
          paymentMethod: paymentChoice === 'medical_aid' ? 'medical_aid' : 'card',
          clientId: paymentChoice === 'medical_aid' ? selectedClientId : undefined,
          kind: 'standard',
          visitMode: 'televisit',
        }),
      });

      const text = await res.text();
      const data = safeParseJson<PreflightResult>(text) ?? { ok: false, error: text };

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Preflight failed');
      }

      if (!data?.priceLock?.token) {
        throw new Error('Preflight did not return a booking price lock.');
      }

      setPreflight(data);
      return data;
    } finally {
      setPreflightBusy(false);
    }
  }

  async function onSubmit() {
    setErr('');

    if (!clinicianId.trim()) {
      setErr('Clinician ID required');
      return;
    }

    setBusy(true);

    try {
      const pf = preflight?.priceLock?.token ? preflight : await runPreflight();

      const patientPayableMinor = sponsorPatientPayable(pf);
      const sponsorDecision = String(pf?.sponsor?.decision || '').toUpperCase();

      const finalPaymentMethod =
        paymentChoice === 'medical_aid'
          ? sponsorDecision === 'REQUIRES_AUTHORIZATION'
            ? 'medical_aid'
            : patientPayableMinor > 0
              ? 'card'
              : 'medical_aid'
          : 'card';

      const reimbursementIntent =
        finalPaymentMethod === 'card'
          ? {
              eligible: true,
              claimType: 'MEMBER_REIMBURSEMENT',
              payeeType: 'PATIENT',
              originalPaymentMethod: 'CARD',
              providerAlreadyPaid: true,
              reason:
                paymentChoice === 'medical_aid'
                  ? ['NOT_COVERED', 'NOT_ELIGIBLE', 'FALLBACK_TO_SELF_PAY'].includes(sponsorDecision)
                    ? sponsorDecision
                    : patientPayableMinor > 0
                      ? 'CARD_COPAY_OR_GAP'
                      : 'CARD_SELECTED_AFTER_SPONSOR_PREFLIGHT'
                  : 'SELF_PAY_CARD',
              selectedPolicyId: selectedPolicy?.id || null,
              selectedClientId: selectedClientId || null,
              sponsorDecision: sponsorDecision || null,
              sponsorAmountMinor: Number(pf?.sponsor?.sponsorAmountMinor || 0),
              patientPayableMinor,
              currency: pf?.priceLock?.currency || pf?.sponsor?.currency || 'ZAR',
              createdAt: new Date().toISOString(),
            }
          : null;

      if (finalPaymentMethod === 'card' && !String(profile?.email || '').trim()) {
        throw new Error('A patient email is required for card checkout.');
      }

      const payload = {
        ...baseAppointmentPayload(),
        paymentMethod: finalPaymentMethod,
        priceLock: pf.priceLock?.token,
        patientEmail: profile?.email || null,
        callbackUrl:
          typeof window !== 'undefined'
            ? `${window.location.origin}/payments/return`
            : undefined,
        clientId: paymentChoice === 'medical_aid' ? selectedClientId : undefined,
        kind: 'standard',
        visitMode: 'televisit',
        reimbursementIntent,
        medicalAid:
          paymentChoice === 'medical_aid' && selectedPolicy
            ? {
                scheme: selectedPolicy.payerName,
                memberNumber: selectedPolicy.membershipNumber,
                dependentCode: selectedPolicy.dependentCode || '',
                telemedCovered: selectedPolicy.telemedCover !== 'none',
                telemedCoverType: selectedPolicy.telemedCover || null,
                telemedCopayType: selectedPolicy.telemedCopayType || null,
                telemedCopayValue: selectedPolicy.telemedCopayValue ?? null,
                policyId: selectedPolicy.id,
              }
            : null,
      };

      const res = await fetch('/api/appointments/new', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = safeParseJson<any>(text) ?? { raw: text };

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Booking failed');
      }

      const appointmentId =
        data?.appointmentId ??
        data?.appointment_id ??
        data?.appointment?.id ??
        '';

      const encounterId =
        data?.encounterId ??
        data?.encounter_id ??
        data?.appointment?.encounterId ??
        '';

      const paymentRef =
        data?.payment?.ref ??
        data?.paymentRef ??
        data?.payment_ref ??
        data?.appointment?.paymentRef ??
        '';

      const redirectUrl =
        data?.redirectUrl ??
        data?.redirect_url ??
        '';

      try {
        sessionStorage.setItem(
          'ambulant:lastPaymentAttempt',
          JSON.stringify({
            appointmentId,
            encounterId,
            paymentRef,
            redirectUrl,
            clinicianId,
            paymentChoice,
            finalPaymentMethod,
            reimbursementIntent,
            sponsorDecision,
            createdAt: new Date().toISOString(),
            source: 'appointments-new',
          }),
        );
      } catch {}

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      if (appointmentId && paymentRef) {
        router.push(
          `/payments/return?appointmentId=${encodeURIComponent(appointmentId)}&reference=${encodeURIComponent(paymentRef)}`,
        );
        return;
      }

      if (appointmentId) {
        router.push(`/appointments/${encodeURIComponent(appointmentId)}`);
        return;
      }

      router.push('/appointments');
    } catch (e: any) {
      setErr(e?.message || 'Booking failed');
    } finally {
      setBusy(false);
    }
  }

  const sponsor = preflight?.sponsor;
  const patientPayableMinor = sponsorPatientPayable(preflight);
  const preflightCurrency = preflight?.priceLock?.currency || sponsor?.currency || 'ZAR';

  return (
    <main data-p-ui="patient-appointment-new-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
            Ambulant+ Appointment Booking
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Book Appointment</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Choose a clinician, confirm the patient, run sponsor/Medical Aid cover preflight, then book with the correct payment route.
          </p>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-400">Clinician ID</span>
            <input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="clinician-demo-001"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-400">Reason</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Consultation"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-400">Date</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-400">Time</span>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-400">Duration</span>
            <select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-400">Patient</span>
            <select
              value={subjectPatientId}
              onChange={(e) => {
                setSubjectPatientId(e.target.value);
                const member = careCircle.find((m) => m.patientId === e.target.value);
                setRelationshipId(member?.relationshipId || '');
              }}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            >
              <option value="me">Myself</option>
              {careCircle.map((m) => (
                <option key={m.patientId} value={m.patientId}>
                  {m.name || m.patientId}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Payment and sponsor cover</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentChoice('card')}
              className={`rounded-2xl border p-4 text-left ${
                paymentChoice === 'card'
                  ? 'border-sky-400 bg-sky-950/50'
                  : 'border-slate-700 bg-slate-950'
              }`}
            >
              <div className="font-semibold">Card / self-pay</div>
              <div className="mt-1 text-xs text-slate-400">
                Use Paystack for full payment or sponsor co-pay/gap.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentChoice('medical_aid')}
              className={`rounded-2xl border p-4 text-left ${
                paymentChoice === 'medical_aid'
                  ? 'border-emerald-400 bg-emerald-950/30'
                  : 'border-slate-700 bg-slate-950'
              }`}
            >
              <div className="font-semibold">Medical Aid / sponsor</div>
              <div className="mt-1 text-xs text-slate-400">
                Run cover preflight and route payable balance correctly.
              </div>
            </button>
          </div>

          {paymentChoice === 'medical_aid' ? (
            <div className="mt-4 space-y-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-400">Linked policy</span>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
                >
                  <option value="">Select policy</option>
                  {policies.map((p) => {
                    const usable = policyUsable(p);

                    return (
                      <option key={p.id} value={p.id} disabled={!usable}>
                        {p.payerName}
                        {p.planName ? ` — ${p.planName}` : ''}
                        {p.membershipNumber ? ` · ${p.membershipNumber}` : ''}
                        {!usable ? policyPaymentLabel(p) : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              {selectedPolicy ? (
                <div className={`rounded-2xl border p-4 text-sm ${
                  selectedPolicyOk
                    ? 'border-emerald-800 bg-emerald-950/30 text-emerald-100'
                    : 'border-rose-800 bg-rose-950/30 text-rose-100'
                }`}>
                  <div className="font-semibold">
                    {selectedPolicyOk ? 'Policy usable for preflight' : 'Policy not usable for sponsor payment'}
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    Payment eligible: {selectedPolicyOk ? 'Yes' : 'No'} · Status:{' '}
                    {selectedPolicy.eligibilityStatus ||
                      selectedPolicy.latestEligibility?.eligibilityStatus ||
                      selectedPolicy.coverageStatus ||
                      'UNKNOWN'} · Premium:{' '}
                    {selectedPolicy.premiumStatus ||
                      selectedPolicy.latestEligibility?.premiumStatus ||
                      'UNKNOWN'} · Client:{' '}
                    {selectedClientId || 'not mapped'}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">
                  No policy selected. Add or link a policy from Medical Aid / Sponsor Profile first.
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void runPreflight().catch((e: any) => setErr(e?.message || 'Preflight failed'));
              }}
              disabled={preflightBusy || busy}
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
            >
              {preflightBusy ? 'Checking cover…' : 'Run preflight'}
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || preflightBusy}
              className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? 'Booking…' : 'Book appointment'}
            </button>
          </div>

          {preflight ? (
            <div className={`mt-4 rounded-2xl border p-4 text-sm ${sponsorTone(sponsor?.decision)}`}>
              <div className="font-semibold">
                Sponsor decision: {sponsor?.decision || 'No sponsor decision'}
              </div>
              <div className="mt-1">
                {sponsor?.reason || 'Sponsor preflight completed.'}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-current/20 bg-white/40 p-3">
                  <div className="text-xs opacity-70">Gross</div>
                  <div className="mt-1 font-semibold">
                    {moneyMinor(preflight.priceLock?.amountMinor, preflightCurrency)}
                  </div>
                </div>

                <div className="rounded-xl border border-current/20 bg-white/40 p-3">
                  <div className="text-xs opacity-70">Sponsor</div>
                  <div className="mt-1 font-semibold">
                    {moneyMinor(sponsor?.sponsorAmountMinor, preflightCurrency)}
                  </div>
                </div>

                <div className="rounded-xl border border-current/20 bg-white/40 p-3">
                  <div className="text-xs opacity-70">Patient payable</div>
                  <div className="mt-1 font-semibold">
                    {moneyMinor(patientPayableMinor, preflightCurrency)}
                  </div>
                </div>

                <div className="rounded-xl border border-current/20 bg-white/40 p-3">
                  <div className="text-xs opacity-70">Next payment route</div>
                  <div className="mt-1 font-semibold">
                    {paymentChoice === 'medical_aid'
                      ? String(sponsor?.decision || '').toUpperCase() === 'REQUIRES_AUTHORIZATION'
                        ? 'Pre-auth queue'
                        : patientPayableMinor > 0
                          ? 'Card for co-pay/gap'
                          : 'Sponsor only'
                      : 'Card'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Additional participants</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              placeholder="Observer name"
              value={observerName}
              onChange={(e) => setObserverName(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />

            <input
              placeholder="Observer email"
              value={observerEmail}
              onChange={(e) => setObserverEmail(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />

            <input
              placeholder="Observer phone"
              value={observerPhone}
              onChange={(e) => setObserverPhone(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            />

            <select
              value={careAllyPatientId}
              onChange={(e) => setCareAllyPatientId(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            >
              <option value="">Care ally</option>
              {joinableCareCircle.map((m) => (
                <option key={m.patientId} value={m.patientId}>
                  {m.name || m.patientId}
                </option>
              ))}
            </select>

            <select
              value={secondPatientParticipantId}
              onChange={(e) => setSecondPatientParticipantId(e.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none"
            >
              <option value="">Second patient participant</option>
              {joinableCareCircle.map((m) => (
                <option key={m.patientId} value={m.patientId}>
                  {m.name || m.patientId}
                </option>
              ))}
            </select>
          </div>
        </section>

        {err ? (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-100">
            {err}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={null}>
      <NewAppointmentPageContent />
    </Suspense>
  );
}
