// apps/patient-app/app/appointments/new/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import MedicalAidForm, {
  type MedicalAidPolicy,
} from '@/components/MedicalAidForm';
import { usePlan } from '@/components/context/PlanContext';

const API =
  process.env.NEXT_PUBLIC_APIGW_BASE ??
  'http://localhost:3010';

type PaymentMethod =
  | 'card'
  | 'medical_aid'
  | 'voucher'
  | 'eft'
  | 'mpesa';

type MedicalAidInfo = {
  scheme: string;
  memberNumber: string;
  dependentCode: string;
};

type BookingForMode = 'self' | 'family';

type FamilyRelationshipSummary = {
  id: string;
  relationType: string;
  relationLabel: string;
  subjectPatientId: string;
  subjectName: string;
  permissions?: {
    canBookAppointments?: boolean;
    canJoinTelevisit?: boolean;
  } | null;
};

type SubjectOption = {
  relationshipId: string;
  patientId: string;
  label: string;
  relationLabel: string;
  canBook: boolean;
};

type ObserverDraft = {
  raw: string; // comma-separated emails for now
};

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v =
      (globalThis.crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2)) +
      '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

// Simple mapper from backend relation type to UI label
function relationTypeToLabel(t: string): string {
  switch (t) {
    case 'SPOUSE':
    case 'PARTNER':
      return 'Spouse / Partner';
    case 'CHILD':
    case 'DEPENDANT':
      return 'Child / Dependant';
    case 'PARENT':
    case 'GUARDIAN':
      return 'Parent / Guardian';
    case 'FRIEND':
    case 'CARE_ALLY':
      return 'Friend / Care circle';
    default:
      return 'Family / Care circle';
  }
}

export default function NewAppointmentPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { isPremium } = usePlan();

  const clinicianId =
    sp.get('clinicianId') || 'doctor-12';
  const reason =
    sp.get('reason') || 'Televisit consult';
  const pay = sp.get('pay') === '1';

  const initialMethod: PaymentMethod = (() => {
    const q = sp.get('payMethod');
    if (
      q === 'medical_aid' ||
      q === 'voucher' ||
      q === 'eft' ||
      q === 'mpesa'
    )
      return q;
    return 'card';
  })();

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>(initialMethod);

  const [voucherCode, setVoucherCode] =
    useState('');
  const [medicalAid, setMedicalAid] =
    useState<MedicalAidInfo>({
      scheme: '',
      memberNumber: '',
      dependentCode: '',
    });

  // Stored medical aids
  const [medicalAids, setMedicalAids] = useState<
    MedicalAidPolicy[]
  >([]);
  const [medicalAidsLoading, setMedicalAidsLoading] =
    useState(false);
  const [medicalAidsError, setMedicalAidsError] =
    useState<string | null>(null);
  const [selectedMedicalAidId, setSelectedMedicalAidId] =
    useState<string | null>(null);
  const [aidModalOpen, setAidModalOpen] =
    useState(false);
  const [aidEditing, setAidEditing] =
    useState<MedicalAidPolicy | null>(null);

  // Booking context: who is this for?
  const [bookingMode, setBookingMode] =
    useState<BookingForMode>('self');
  const [familyOptions, setFamilyOptions] = useState<
    SubjectOption[]
  >([]);
  const [familyLoading, setFamilyLoading] =
    useState(false);
  const [familyError, setFamilyError] =
    useState<string | null>(null);
  const [selectedFamilySubjectId, setSelectedFamilySubjectId] =
    useState<string | null>(null);

  // Observers (simple comma-separated emails for now)
  const [allowObservers, setAllowObservers] =
    useState(true);
  const [observerDraft, setObserverDraft] =
    useState<ObserverDraft>({ raw: '' });

  // Country / cross-border context
  const [country, setCountry] = useState(
    sp.get('country') || 'ZA',
  );
  const [subjectCountrySame, setSubjectCountrySame] =
    useState(true);
  const [subjectCountry, setSubjectCountry] =
    useState('');

  // SMS alert (+R5)
  const [smsAlert, setSmsAlert] =
    useState(false);

  const [roomId] = useState(
    () =>
      `room-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
  );
  const [starts, setStarts] = useState(
    () => new Date(Date.now() + 30 * 60 * 1000),
  );
  const [ends, setEnds] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000),
  );
  const [agree, setAgree] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const startsISO = useMemo(
    () => starts.toISOString(),
    [starts],
  );
  const endsISO = useMemo(
    () => ends.toISOString(),
    [ends],
  );

  const canUseFamily = isPremium;
  const canUseObservers = isPremium;

  useEffect(() => {
    setErr('');
  }, [paymentMethod, bookingMode, isPremium]);

  // Load medical aids
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setMedicalAidsLoading(true);
        const res = await fetch('/api/medical-aids', {
          cache: 'no-store',
        });
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}`,
          );
        }
        const json = await res.json();
        const items =
          (json.items ||
            []) as MedicalAidPolicy[];
        if (!mounted) return;
        setMedicalAids(items);
        setMedicalAidsError(null);
        const def =
          items.find((p) => p.isDefault) ||
          items[0];
        setSelectedMedicalAidId(
          def?.id || null,
        );
      } catch (e: any) {
        if (!mounted) return;
        console.error(
          'load medical-aids failed',
          e,
        );
        setMedicalAidsError(
          e?.message ||
            'Failed to load medical aids',
        );
      } finally {
        if (!mounted) return;
        setMedicalAidsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load family relationships for care circle booking
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setFamilyLoading(true);
        setFamilyError(null);
        const res = await fetch(
          '/api/family/relationships',
          { cache: 'no-store' },
        );
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}`,
          );
        }
        const json = await res.json();
        const rels =
          (json.items ||
            json.relationships ||
            []) as FamilyRelationshipSummary[];

        if (!mounted) return;

        const opts: SubjectOption[] =
          rels
            .filter((r) => {
              const canBook =
                r.permissions
                  ?.canBookAppointments ?? true;
              return canBook;
            })
            .map((r) => ({
              relationshipId: r.id,
              patientId: r.subjectPatientId,
              label:
                r.subjectName ||
                'Family member',
              relationLabel:
                r.relationLabel ||
                relationTypeToLabel(
                  r.relationType,
                ),
              canBook:
                r.permissions
                  ?.canBookAppointments ?? true,
            }));

        setFamilyOptions(opts);

        if (!selectedFamilySubjectId && opts[0]) {
          setSelectedFamilySubjectId(
            opts[0].relationshipId,
          );
        }
      } catch (e: any) {
        if (!mounted) return;
        setFamilyError(
          e?.message ||
            'Failed to load care circle',
        );
      } finally {
        if (!mounted) return;
        setFamilyLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedFamilySubjectId]);

  function openAddMedicalAid() {
    setAidEditing(null);
    setAidModalOpen(true);
  }

  function openEditMedicalAid(policy: MedicalAidPolicy) {
    setAidEditing(policy);
    setAidModalOpen(true);
  }

  function parseObserverEmails(
    draft: ObserverDraft,
  ) {
    const emails = draft.raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return emails.map((email) => ({ email }));
  }

  async function create() {
    setErr('');
    if (!agree) {
      setErr(
        'Please accept the refund policy.',
      );
      return;
    }

    // Validate premium gating
    if (!canUseFamily && bookingMode === 'family') {
      setErr(
        'Family & Friends bookings are a Premium feature. Please book for yourself or upgrade your plan.',
      );
      return;
    }

    // Validate booking subject
    let person:
      | {
          mode: 'SELF' | 'FAMILY';
          subjectPatientId?: string | null;
          relationshipId?: string | null;
        }
      | undefined;

    if (bookingMode === 'self') {
      person = { mode: 'SELF' };
    } else {
      const selectedRel = familyOptions.find(
        (o) =>
          o.relationshipId ===
          selectedFamilySubjectId,
      );
      if (!selectedRel) {
        setErr(
          'Please choose who you are booking for in your care circle.',
        );
        return;
      }
      person = {
        mode: 'FAMILY',
        subjectPatientId:
          selectedRel.patientId,
        relationshipId:
          selectedRel.relationshipId,
      };
    }

    const selectedPolicy =
      selectedMedicalAidId &&
      medicalAids.find(
        (p) => p.id === selectedMedicalAidId,
      );

    if (paymentMethod === 'medical_aid') {
      const hasManual =
        medicalAid.scheme.trim() &&
        medicalAid.memberNumber.trim();
      if (!selectedPolicy && !hasManual) {
        setErr(
          'Please select a saved medical aid or enter at least scheme and membership number.',
        );
        return;
      }
    }

    if (paymentMethod === 'voucher') {
      if (!voucherCode.trim()) {
        setErr(
          'Please enter a voucher/promo code, or switch payment method.',
        );
        return;
      }
    }

    setBusy(true);

    try {
      if (pay) {
        const uid = getUid();

        // Build high-level payload for our BFF route
        const payload: any = {
          clinicianId,
          startsAt: startsISO,
          endsAt: endsISO,
          reason,
          roomId,
          paymentMethod,
          person,
          country,
          subjectCountrySame,
          subjectCountry:
            subjectCountrySame
              ? country
              : subjectCountry || country,
          smsAlert,
        };

        if (paymentMethod === 'voucher') {
          payload.voucherCode =
            voucherCode.trim();
        } else if (
          paymentMethod === 'medical_aid'
        ) {
          const policy = selectedPolicy;
          if (policy) {
            payload.medicalAid = {
              scheme: policy.schemeName,
              memberNumber:
                policy.membershipNumber,
              dependentCode:
                policy.dependentCode ||
                '',
              telemedCovered:
                policy.coversTelemedicine,
              telemedCoverType:
                policy.telemedicineCoverType,
              telemedCopayType:
                policy.coPaymentType,
              telemedCopayValue:
                policy.coPaymentValue,
              policyId: policy.id,
            };
          } else {
            payload.medicalAid = {
              scheme:
                medicalAid.scheme.trim(),
              memberNumber:
                medicalAid.memberNumber.trim(),
              dependentCode:
                medicalAid.dependentCode.trim(),
            };
          }
        }

        if (canUseObservers && allowObservers) {
          payload.observers =
            parseObserverEmails(
              observerDraft,
            );
        }

        const res = await fetch(
          '/api/appointments/new',
          {
            method: 'POST',
            headers: {
              'content-type':
                'application/json',
              'x-uid': uid,
            },
            body: JSON.stringify(payload),
          },
        );

        const out = await res
          .json()
          .catch(() => null);

        if (!res.ok || !out?.ok) {
          throw new Error(
            out?.error ||
              `Gateway responded ${res.status}`,
          );
        }

        const apptId =
          out.appointmentId ||
          `appt-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        const redirectUrl =
          typeof out.redirectUrl ===
          'string'
            ? out.redirectUrl
            : '';

        if (
          paymentMethod === 'card' &&
          redirectUrl
        ) {
          router.replace(
            `/checkout?a=${encodeURIComponent(
              apptId,
            )}&provider=paystack&redirect=${encodeURIComponent(
              redirectUrl,
            )}`,
          );
        } else {
          router.replace(
            `/checkout/success?a=${encodeURIComponent(
              apptId,
            )}`,
          );
        }
        return;
      }

      // Demo mode (no real gateway call)
      const apptId = `appt-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      router.replace(
        `/checkout/success?a=${apptId}`,
      );
    } catch (e: any) {
      setErr(
        e?.message ||
          'Failed to create appointment',
      );
    } finally {
      setBusy(false);
    }
  }

  const paymentModeDescription = (() => {
    if (paymentMethod === 'card') {
      return pay
        ? 'Payment mode: Self-pay via card (Paystack). Apple Pay / Samsung Pay supported where your card & country allow it.'
        : 'Payment mode: Self-pay via card (demo mode, no real charge).';
    }
    if (paymentMethod === 'medical_aid') {
      return pay
        ? 'Payment mode: Medical aid claim — Ambulant+ will compile a claim using your stored policy details after the virtual consult.'
        : 'Payment mode: Medical aid (demo mode, no real claim).';
    }
    if (paymentMethod === 'voucher') {
      return pay
        ? 'Payment mode: Self-pay with voucher/promo — card gateway not used for this booking.'
        : 'Payment mode: Voucher/promo (demo mode).';
    }
    if (paymentMethod === 'eft') {
      return pay
        ? 'Payment mode: EFT / bank transfer — your slot is reserved for a limited time while we await payment confirmation.'
        : 'Payment mode: EFT (demo mode).';
    }
    // mpesa
    return pay
      ? 'Payment mode: M-Pesa mobile money — available for supported Kenyan flows.'
      : 'Payment mode: M-Pesa (demo mode).';
  })();

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <Link
          href="/clinicians"
          className="text-sm text-teal-700 hover:underline"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">
          Confirm Televisit
        </h1>
        <span />
      </header>

      <section className="bg-white border rounded-lg p-5 space-y-4">
        {/* Who is this appointment for? */}
        <section className="border rounded-lg p-3 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-gray-800">
              Who is this appointment for?
            </div>
            {!isPremium && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                Family &amp; observers are Premium features
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-2 text-sm">
            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white cursor-pointer">
              <input
                type="radio"
                name="bookingFor"
                value="self"
                checked={bookingMode === 'self'}
                onChange={() =>
                  setBookingMode('self')
                }
              />
              <span>
                <div className="font-medium">
                  Me
                </div>
                <div className="text-xs text-gray-500">
                  Book this visit for your own care.
                  Observers can join when your plan supports it.
                </div>
              </span>
            </label>

            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white">
              <input
                type="radio"
                name="bookingFor"
                value="family"
                checked={bookingMode === 'family'}
                disabled={!canUseFamily}
                onChange={() =>
                  canUseFamily &&
                  setBookingMode('family')
                }
              />
              <span className={canUseFamily ? 'cursor-pointer' : 'opacity-60'}>
                <div className="flex items-center gap-1">
                  <div className="font-medium">
                    Someone in my care circle
                  </div>
                  {!canUseFamily && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                      Premium
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Book on behalf of a spouse, child, parent or trusted friend you support.
                </div>
              </span>
            </label>
          </div>

          {bookingMode === 'family' && (
            <div className="mt-2 text-xs space-y-1">
              {familyLoading && (
                <div className="text-gray-500">
                  Loading your Family &amp; Friends…
                </div>
              )}
              {familyError && (
                <div className="text-rose-600">
                  {familyError}
                </div>
              )}
              {!familyLoading &&
                !familyError && (
                  <>
                    {familyOptions.length === 0 ? (
                      <div className="text-gray-500">
                        You don&apos;t have any active Family &amp; Friends yet.
                        Add them from{' '}
                        <Link
                          href="/family"
                          className="underline"
                        >
                          Family &amp; Friends
                        </Link>{' '}
                        to book on their behalf.
                      </div>
                    ) : (
                      <label className="flex flex-col gap-1">
                        <span className="text-gray-600">
                          Choose person
                        </span>
                        <select
                          className="border rounded px-2 py-1"
                          value={
                            selectedFamilySubjectId ?? ''
                          }
                          onChange={(e) =>
                            setSelectedFamilySubjectId(
                              e.target.value || null,
                            )
                          }
                        >
                          {familyOptions.map(
                            (o) => (
                              <option
                                key={o.relationshipId}
                                value={
                                  o.relationshipId
                                }
                              >
                                {o.label} —{' '}
                                {o.relationLabel}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )}
                  </>
                )}
            </div>
          )}
        </section>

        {/* Country / cross-border context */}
        <section className="border rounded-lg p-3 bg-slate-50 space-y-2 text-xs">
          <div className="text-sm font-medium text-gray-800">
            Where will the care be delivered?
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-gray-600">
                Your country
              </span>
              <select
                className="border rounded px-2 py-1"
                value={country}
                onChange={(e) =>
                  setCountry(e.target.value)
                }
              >
                <option value="ZA">South Africa</option>
                <option value="KE">Kenya</option>
                <option value="NG">Nigeria</option>
                <option value="GB">United Kingdom</option>
                <option value="US">United States</option>
              </select>
            </label>

            {bookingMode === 'family' && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-600">
                  Is the person in the same country?
                </span>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      checked={subjectCountrySame}
                      onChange={() =>
                        setSubjectCountrySame(true)
                      }
                    />
                    <span>Yes</span>
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      checked={!subjectCountrySame}
                      onChange={() =>
                        setSubjectCountrySame(false)
                      }
                    />
                    <span>No</span>
                  </label>
                </div>
                {!subjectCountrySame && (
                  <label className="flex flex-col gap-1 mt-1">
                    <span className="text-gray-600">
                      Their country
                    </span>
                    <input
                      className="border rounded px-2 py-1"
                      value={subjectCountry}
                      onChange={(e) =>
                        setSubjectCountry(
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Kenya"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            Ambulant+ can support borderless, contactless care,
            but prescriptions and medical aid rules still follow local law.
            If the person is in another country, some payment methods,
            medical aids and pharmacy partners may not apply.
          </p>
        </section>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">
              Clinician ID
            </span>
            <input
              className="w-full border rounded px-2 py-1"
              value={clinicianId}
              readOnly
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">
              Room ID (meta)
            </span>
            <input
              className="w-full border rounded px-2 py-1"
              value={roomId}
              readOnly
            />
          </label>
        </div>

        <label className="text-sm block">
          <span className="block text-gray-600 mb-1">
            Reason (meta)
          </span>
          <input
            className="w-full border rounded px-2 py-1"
            value={reason}
            readOnly
          />
        </label>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">
              Starts
            </span>
            <input
              type="datetime-local"
              className="w-full border rounded px-2 py-1"
              value={new Date(starts)
                .toISOString()
                .slice(0, 16)}
              onChange={(e) =>
                setStarts(
                  new Date(e.target.value),
                )
              }
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">
              Ends
            </span>
            <input
              type="datetime-local"
              className="w-full border rounded px-2 py-1"
              value={new Date(ends)
                .toISOString()
                .slice(0, 16)}
              onChange={(e) =>
                setEnds(
                  new Date(e.target.value),
                )
              }
            />
          </label>
        </div>

        {/* Payment method chooser */}
        <section className="border rounded-lg p-3 space-y-2 bg-slate-50">
          <div className="text-sm font-medium text-gray-800">
            Payment method
          </div>
          {!pay && (
            <div className="text-[11px] text-gray-500 mb-1">
              You are currently in demo mode (no real charge). Append{' '}
              <code className="bg-gray-100 px-1 rounded">
                ?pay=1
              </code>{' '}
              to the URL to exercise real gateway flows.
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-2 text-sm">
            {/* Card */}
            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={() =>
                  setPaymentMethod('card')
                }
              />
              <span>
                <div className="font-medium">
                  Card (incl. Apple / Samsung Pay)
                </div>
                <div className="text-xs text-gray-500">
                  Debit/credit via Paystack; wallets where supported.
                </div>
              </span>
            </label>

            {/* Medical Aid */}
            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="medical_aid"
                checked={
                  paymentMethod === 'medical_aid'
                }
                onChange={() =>
                  setPaymentMethod(
                    'medical_aid',
                  )
                }
              />
              <span>
                <div className="font-medium">
                  Medical Aid
                </div>
                <div className="text-xs text-gray-500">
                  We submit a claim to your scheme,
                  where supported.
                </div>
              </span>
            </label>

            {/* Voucher */}
            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="voucher"
                checked={
                  paymentMethod === 'voucher'
                }
                onChange={() =>
                  setPaymentMethod(
                    'voucher',
                  )
                }
              />
              <span>
                <div className="font-medium">
                  Voucher / Promo
                </div>
                <div className="text-xs text-gray-500">
                  Use a prepaid or sponsored code.
                </div>
              </span>
            </label>

            {/* EFT */}
            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="eft"
                checked={paymentMethod === 'eft'}
                onChange={() =>
                  setPaymentMethod('eft')
                }
              />
              <span>
                <div className="font-medium">
                  EFT / Bank Transfer
                </div>
                <div className="text-xs text-gray-500">
                  Reserve a slot while you pay via bank transfer.
                </div>
              </span>
            </label>

            {/* M-Pesa */}
            <label className="flex items-start gap-2 border rounded px-2 py-2 bg-white cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="mpesa"
                checked={paymentMethod === 'mpesa'}
                onChange={() =>
                  setPaymentMethod('mpesa')
                }
              />
              <span>
                <div className="font-medium">
                  M-Pesa (KE)
                </div>
                <div className="text-xs text-gray-500">
                  Mobile money for supported Kenyan flows.
                </div>
              </span>
            </label>
          </div>

          {/* Extra fields per method */}
          {paymentMethod === 'medical_aid' && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="text-gray-600">
                  Saved medical aids
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openAddMedicalAid}
                    className="px-2 py-0.5 border rounded bg-white hover:bg-slate-50"
                  >
                    Add / Update
                  </button>
                </div>
              </div>
              <div className="border rounded bg-white divide-y">
                {medicalAidsLoading && (
                  <div className="p-2 text-gray-500">
                    Loading…
                  </div>
                )}
                {medicalAidsError && (
                  <div className="p-2 text-rose-600">
                    {medicalAidsError}
                  </div>
                )}
                {!medicalAidsLoading &&
                  !medicalAidsError &&
                  medicalAids.length ===
                    0 && (
                    <div className="p-2 text-gray-500">
                      No medical aids on file
                      yet. You can still enter
                      details for this booking
                      only below.
                    </div>
                  )}
                {medicalAids.map((ma) => (
                  <label
                    key={ma.id}
                    className="flex items-start gap-2 p-2 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="medicalAidPolicy"
                      checked={
                        selectedMedicalAidId ===
                        ma.id
                      }
                      onChange={() =>
                        setSelectedMedicalAidId(
                          ma.id,
                        )
                      }
                    />
                    <div>
                      <div className="font-medium">
                        {ma.schemeName}{' '}
                        {ma.planName
                          ? `· ${ma.planName}`
                          : ''}
                        {ma.isDefault && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-gray-700">
                        Member{' '}
                        <span className="font-mono">
                          {ma.membershipNumber}
                        </span>
                        {ma.dependentCode && (
                          <> · Dep {ma.dependentCode}</>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Telemedicine:{' '}
                        {ma.coversTelemedicine
                          ? ma.telemedicineCoverType ===
                            'full'
                            ? 'Full cover'
                            : 'Partial (co-payment)'
                          : 'Not explicit'}
                        {ma.hasCom &&
                          ' · COM on file'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditMedicalAid(ma);
                      }}
                      className="ml-auto text-[11px] px-2 py-0.5 border rounded bg-white hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </label>
                ))}
              </div>

              <div className="mt-2 text-[11px] text-gray-500">
                If you prefer, you can provide
                medical aid details for{' '}
                <strong>this booking only</strong>{' '}
                below:
              </div>
              <div className="grid md:grid-cols-3 gap-2 mt-1">
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600">
                    Scheme
                  </span>
                  <input
                    className="border rounded px-2 py-1"
                    value={medicalAid.scheme}
                    onChange={(e) =>
                      setMedicalAid((m) => ({
                        ...m,
                        scheme: e.target.value,
                      }))
                    }
                    placeholder="e.g. Discovery"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600">
                    Member number
                  </span>
                  <input
                    className="border rounded px-2 py-1"
                    value={medicalAid.memberNumber}
                    onChange={(e) =>
                      setMedicalAid((m) => ({
                        ...m,
                        memberNumber:
                          e.target.value,
                      }))
                    }
                    placeholder="e.g. 123456789"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600">
                    Dependent code
                  </span>
                  <input
                    className="border rounded px-2 py-1"
                    value={medicalAid.dependentCode}
                    onChange={(e) =>
                      setMedicalAid((m) => ({
                        ...m,
                        dependentCode:
                          e.target.value,
                      }))
                    }
                    placeholder="e.g. 01"
                  />
                </label>
              </div>
            </div>
          )}

          {paymentMethod === 'voucher' && (
            <div className="mt-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-gray-600">
                  Voucher or promo code
                </span>
                <input
                  className="border rounded px-2 py-1"
                  value={voucherCode}
                  onChange={(e) =>
                    setVoucherCode(
                      e.target.value,
                    )
                  }
                  placeholder="e.g. TELE-2025-ABC"
                />
              </label>
            </div>
          )}

          {paymentMethod === 'eft' && (
            <p className="mt-2 text-[11px] text-gray-500">
              For EFT bookings we reserve your slot for a limited time while you pay.
              In production, we&apos;ll pair your proof of payment or Paystack bank transfer
              reference with this booking; if not confirmed in time, the slot is released.
            </p>
          )}

          {paymentMethod === 'mpesa' && (
            <p className="mt-2 text-[11px] text-gray-500">
              M-Pesa is available when your clinician and country support it.
              Behind the scenes we&apos;ll use a mobile money provider or Paystack
              integration optimised for Kenyan flows.
            </p>
          )}
        </section>

        {/* SMS alert */}
        <section className="border rounded-lg p-3 bg-slate-50 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-800">
              SMS alerts (+R5)
            </div>
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={smsAlert}
              onChange={(e) =>
                setSmsAlert(e.target.checked)
              }
            />
            <span>
              Send SMS notifications for this booking (flat R5, added to your total).
            </span>
          </label>
          <p className="text-[11px] text-gray-500">
            If it&apos;s a multi-party visit, all attending parties will receive the SMS
            at the same flat rate. Email and in-app notifications remain free.
          </p>
        </section>

        {/* Observers */}
        <section className="border rounded-lg p-3 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-gray-800">
                Observers &amp; supporters
              </div>
              {!canUseObservers && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                  Premium
                </span>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={allowObservers}
                disabled={!canUseObservers}
                onChange={(e) =>
                  canUseObservers &&
                  setAllowObservers(
                    e.target.checked,
                  )
                }
              />
              Allow observers to join this call
            </label>
          </div>
          <p className="text-[11px] text-gray-500">
            Observers (e.g. spouse, parent or friend) can join as guests.
            Clinical notes and billing remain tied to the person this appointment is for.
            Guest access is limited — after a few joins we&apos;ll prompt them to sign up
            with a simple profile.
          </p>
          {allowObservers && canUseObservers && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-gray-600">
                Observer emails (comma separated)
              </span>
              <input
                className="border rounded px-2 py-1"
                value={observerDraft.raw}
                onChange={(e) =>
                  setObserverDraft({
                    raw: e.target.value,
                  })
                }
                placeholder="e.g. spouse@example.com, parent@example.com"
              />
              <span className="text-[10px] text-gray-500">
                We&apos;ll enforce a limited number of guest joins for non-registered
                observers and encourage quick sign-up over time.
              </span>
            </label>
          )}
        </section>

        <div className="text-sm text-gray-700">
          <div className="font-medium">
            {paymentModeDescription}
          </div>
          {pay ? (
            <div className="text-xs text-gray-500 mt-1">
              The gateway receives{' '}
              <code className="bg-gray-100 px-1 rounded">
                payment_method
              </code>{' '}
              plus voucher / medical aid / SMS / country metadata so
              payouts &amp; claims can be computed correctly.
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-1">
              This environment does not call the
              gateway; we just simulate a successful
              appointment.
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500">
          Clinicians practising on Ambulant+ are
          independent practitioners with their own
          practice numbers, consulting virtually
          via the{' '}
          <strong>Ambulant+ Center</strong>. If
          your policy covers telemedicine, your
          claims will reference the virtual session
          and, where applicable, connected IoMT
          devices and vitals.
        </div>

        {err ? (
          <div className="text-rose-600 text-sm">
            {err}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              alert(
                "Refund policy: clinician-specific (demo).",
              )
            }
            className="px-3 py-1 rounded border text-sm"
          >
            View clinician’s refund policy
          </button>
          <label className="text-sm inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) =>
                setAgree(e.target.checked)
              }
            />{' '}
            I have read and accept the refund policy
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={create}
            disabled={busy}
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            {busy
              ? 'Creating…'
              : 'Create Appointment'}
          </button>
          <Link
            href="/clinicians"
            className="text-sm underline"
          >
            Browse clinicians
          </Link>
        </div>
      </section>

      {/* Medical Aid modal */}
      {aidModalOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
          <div className="w-full max-w-lg p-4 bg-white rounded shadow-lg">
            <h3 className="text-lg font-semibold mb-2">
              {aidEditing
                ? 'Edit Medical Aid'
                : 'Add Medical Aid'}
            </h3>
            <MedicalAidForm
              initial={aidEditing || undefined}
              onCancel={() => setAidModalOpen(false)}
              onSaved={(policy) => {
                setMedicalAids((prev) => {
                  const others = prev.filter(
                    (p) => p.id !== policy.id,
                  );
                  return [policy, ...others];
                });
                setSelectedMedicalAidId(
                  policy.id,
                );
                setAidModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
