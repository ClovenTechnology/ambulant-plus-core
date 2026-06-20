// apps/patient-app/app/clinicians/[id]/calendar/page.tsx
'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { usePlan } from '@/components/context/PlanContext';
import RefundPolicyPanel from '@/components/RefundPolicyPanel';

type Slot = { start: string; end?: string };

type RefundPolicy = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

type FeeProfile = {
  priceCents: number;
  currency: string;
  durationMin: number;
  bufferMin: number;
};

type BookingProfile = {
  clinician: {
    id: string;
    name: string;
    specialty?: string;
    timezone?: string;

    // ✅ optional rating fields for header consistency
    rating?: number;
    ratingCount?: number;

    operational?: {
      canBeListed?: boolean;
      canBeBooked?: boolean;
      canPrescribe?: boolean;
      prescribingMode?: 'no' | 'conditional' | 'yes';
      allowedWorkspaces?: string[];
      patientCategory?: 'clinical' | 'wellness' | null;
      blockers?: string[];
      riskFlags?: string[];
      ambulantId?: string | null;
    };
  };
  fees: {
    standard: FeeProfile;
    followUp: FeeProfile;
  };
  refundPolicy: RefundPolicy;
  rules?: {
    followUpRequiresOpenCase?: boolean;
    followUpFromCaseContextOnly?: boolean;
  };
};

type ConsultType = 'standard' | 'followup';

/* ----------------- UID + tiny toasts (no deps) ----------------- */

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

type Toast = { id: string; text: string; tone?: 'info' | 'success' | 'error' };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(text: string, tone: Toast['tone'] = 'info', ttl = 5000) {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }
  function remove(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }
  const Toasts = () => (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1200 }} aria-live="polite">
      <div className="flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded shadow text-sm ${
              t.tone === 'success'
                ? 'bg-green-50 text-green-800'
                : t.tone === 'error'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-white text-gray-800'
            }`}
          >
            {t.text}
            <button onClick={() => remove(t.id)} className="ml-3 text-xs text-gray-500">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
  return { push, Toasts };
}

function formatMoney(cents: number, currency: string) {
  const v = Number(cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(v);
  } catch {
    const rands = v.toFixed(2);
    return currency === 'ZAR' ? `R ${rands}` : `${currency} ${rands}`;
  }
}

function addMinutes(iso: string, mins: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

function localApiUrl(path: string) {
  return path;
}

async function readJsonSafe(r: Response) {
  return r.json().catch(() => null);
}

function safeNum(v: any): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/* ----------------- normalizers (robust to partial API payloads) ----------------- */

function normalizeFeeProfile(p: Partial<FeeProfile> | null | undefined, fallback: FeeProfile): FeeProfile {
  const priceCents = Number.isFinite(Number(p?.priceCents)) ? Number(p!.priceCents) : fallback.priceCents;
  const durationMin = Number.isFinite(Number(p?.durationMin)) ? Number(p!.durationMin) : fallback.durationMin;
  const bufferMin = Number.isFinite(Number(p?.bufferMin)) ? Number(p!.bufferMin) : fallback.bufferMin;
  const currency = (p?.currency || fallback.currency || 'ZAR') as string;

  return { priceCents, durationMin, bufferMin, currency };
}

function normalizeBookingProfile(p: any, fallback: BookingProfile): BookingProfile {
  const clinician = {
    id: String(p?.clinician?.id || fallback.clinician.id),
    name: String(p?.clinician?.name || fallback.clinician.name),
    specialty: p?.clinician?.specialty ?? fallback.clinician.specialty,
    timezone: p?.clinician?.timezone ?? fallback.clinician.timezone,

    // ✅ tolerate different field names
    rating:
      safeNum(p?.clinician?.rating) ??
      safeNum(p?.clinician?.ratingAvg) ??
      safeNum(p?.clinician?.ratingAverage) ??
      fallback.clinician.rating,
    ratingCount:
      safeNum(p?.clinician?.ratingCount) ??
      safeNum(p?.clinician?.ratingsCount) ??
      safeNum(p?.clinician?.reviewCount) ??
      safeNum(p?.clinician?.totalRatings) ??
      fallback.clinician.ratingCount,

    operational:
      p?.clinician?.operational && typeof p.clinician.operational === 'object'
        ? {
            canBeListed: p.clinician.operational.canBeListed,
            canBeBooked: p.clinician.operational.canBeBooked,
            canPrescribe: p.clinician.operational.canPrescribe,
            prescribingMode: p.clinician.operational.prescribingMode ?? 'no',
            allowedWorkspaces: Array.isArray(p.clinician.operational.allowedWorkspaces)
              ? p.clinician.operational.allowedWorkspaces.map(String)
              : [],
            patientCategory: p.clinician.operational.patientCategory ?? null,
            blockers: Array.isArray(p.clinician.operational.blockers)
              ? p.clinician.operational.blockers.map(String)
              : [],
            riskFlags: Array.isArray(p.clinician.operational.riskFlags)
              ? p.clinician.operational.riskFlags.map(String)
              : [],
            ambulantId: p.clinician.operational.ambulantId ?? null,
          }
        : fallback.clinician.operational,
  };

  const fees = {
    standard: normalizeFeeProfile(p?.fees?.standard, fallback.fees.standard),
    followUp: normalizeFeeProfile(p?.fees?.followUp, fallback.fees.followUp),
  };

  const refundPolicy: RefundPolicy = {
    within24hPercent: Number.isFinite(Number(p?.refundPolicy?.within24hPercent))
      ? Number(p.refundPolicy.within24hPercent)
      : fallback.refundPolicy.within24hPercent,
    noShowPercent: Number.isFinite(Number(p?.refundPolicy?.noShowPercent))
      ? Number(p.refundPolicy.noShowPercent)
      : fallback.refundPolicy.noShowPercent,
    clinicianMissPercent: Number.isFinite(Number(p?.refundPolicy?.clinicianMissPercent))
      ? Number(p.refundPolicy.clinicianMissPercent)
      : fallback.refundPolicy.clinicianMissPercent,
    networkProrate:
      typeof p?.refundPolicy?.networkProrate === 'boolean'
        ? Boolean(p.refundPolicy.networkProrate)
        : fallback.refundPolicy.networkProrate,
  };

  const rules = {
    followUpRequiresOpenCase:
      typeof p?.rules?.followUpRequiresOpenCase === 'boolean'
        ? Boolean(p.rules.followUpRequiresOpenCase)
        : fallback.rules?.followUpRequiresOpenCase,
    followUpFromCaseContextOnly:
      typeof p?.rules?.followUpFromCaseContextOnly === 'boolean'
        ? Boolean(p.rules.followUpFromCaseContextOnly)
        : fallback.rules?.followUpFromCaseContextOnly,
  };

  return { clinician, fees, refundPolicy, rules };
}

export default function ClinicianCalendar({ params }: { params: { id: string } }) {
  const { isPremium } = usePlan();
  const router = useRouter();
  const sp = useSearchParams();
  const qs = sp ?? new URLSearchParams();
  const { push, Toasts } = useToasts();

  const country = (qs.get('country') || 'ZA').toUpperCase();
  const apiEnabled = country === 'ZA';

  // Optional: case context supplied by Encounter/Case pages for follow-ups
  const caseId = qs.get('caseId') || undefined;

  const qpType = (qs.get('type') as ConsultType | null) ?? 'standard';
  const [consultType, setConsultType] = useState<ConsultType>(qpType === 'followup' && !caseId ? 'standard' : qpType);

  const [profile, setProfile] = useState<BookingProfile | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{ open: boolean; start?: string }>({ open: false });

  const fallbackProfile = useMemo<BookingProfile>(
    () => ({
      clinician: {
        id: params.id,
        name: 'Clinician',
        timezone: 'Africa/Johannesburg',
        rating: undefined,
        ratingCount: undefined,
        operational: undefined,
      },
      fees: {
        standard: { priceCents: 60000, currency: 'ZAR', durationMin: 45, bufferMin: 5 },
        followUp: { priceCents: 35000, currency: 'ZAR', durationMin: 25, bufferMin: 5 },
      },
      refundPolicy: {
        within24hPercent: 50,
        noShowPercent: 0,
        clinicianMissPercent: 100,
        networkProrate: true,
      },
      rules: { followUpRequiresOpenCase: true, followUpFromCaseContextOnly: true },
    }),
    [params.id],
  );

  const followUpAllowed = useMemo(() => Boolean(caseId), [caseId]);

  useEffect(() => {
    if (consultType === 'followup' && !followUpAllowed) setConsultType('standard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUpAllowed]);

  const normalizedForUi = useMemo(() => {
    const src = profile ?? fallbackProfile;
    return normalizeBookingProfile(src as any, fallbackProfile);
  }, [profile, fallbackProfile]);

  const fee: FeeProfile = useMemo(() => {
    const src = normalizedForUi;
    return consultType === 'followup' ? src.fees.followUp : src.fees.standard;
  }, [normalizedForUi, consultType]);

  const tileMinutes = useMemo(() => Math.max(10, (fee.durationMin ?? 0) + (fee.bufferMin ?? 0)), [fee]);

  /* ----------------- load booking profile ----------------- */

  useEffect(() => {
    let canceled = false;

    async function loadProfile() {
      try {
        setErr(null);

        if (!apiEnabled) {
          if (!canceled) {
            setProfile(fallbackProfile);
            setErr('Live booking is currently available for South Africa (ZA) only. Showing default fee profile.');
          }
          return;
        }

        const url = localApiUrl(`/api/clinicians/${encodeURIComponent(params.id)}/booking-profile`);
        const r = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const j = await readJsonSafe(r);

        if (r.ok && j) {
          const normalized = normalizeBookingProfile(j, fallbackProfile);
          if (!canceled) setProfile(normalized);
          return;
        }

        const msg = j?.error || `Failed to load clinician profile (HTTP ${r.status})`;
        if (!canceled) {
          setErr(String(msg));
          setProfile(fallbackProfile);
        }
      } catch (e: any) {
        if (!canceled) {
          setErr(e?.message || 'Failed to load clinician profile');
          setProfile(fallbackProfile);
        }
      }
    }

    loadProfile();
    return () => {
      canceled = true;
    };
  }, [params.id, apiEnabled, fallbackProfile]);

  /* ----------------- header display helpers (✅ rating in header) ----------------- */

  const c = normalizedForUi.clinician;
  const operational = c.operational ?? null;
  const canBeBooked = operational ? operational.canBeBooked !== false : true;
  const ratingValue = typeof c.rating === 'number' && Number.isFinite(c.rating) ? c.rating : null;
  const ratingCount = typeof c.ratingCount === 'number' && Number.isFinite(c.ratingCount) ? c.ratingCount : null;

  /* ----------------- load slots ----------------- */

  useEffect(() => {
    let canceled = false;

    async function loadSlots() {
      try {
        setBusy(true);
        setErr((prev) => prev);

        if (!apiEnabled) {
          if (!canceled) setSlots([]);
          return;
        }

        if (!canBeBooked) {
          if (!canceled) setSlots([]);
          return;
        }

        const from = new Date();
        const q = new URLSearchParams({
          from: from.toISOString().slice(0, 10),
          days: '14',
          slot: String(tileMinutes),
          type: consultType,
        });
        if (caseId) q.set('caseId', caseId);

        const url = localApiUrl(`/api/clinicians/${encodeURIComponent(params.id)}/availability?${q.toString()}`);
        const r = await fetch(url, {
          cache: 'no-store',
          headers: { 'x-role': 'patient', 'x-uid': getUid() },
        });

        const j = await readJsonSafe(r);
        if (!r.ok) throw new Error(j?.error || `Failed to load availability (HTTP ${r.status})`);

        const out = Array.isArray(j?.slots) ? (j.slots as Slot[]) : [];
        if (!canceled) setSlots(out);
      } catch (e: any) {
        if (!canceled) {
          setErr(e?.message || 'Failed to load availability');
          setSlots([]);
        }
      } finally {
        if (!canceled) setBusy(false);
      }
    }

    loadSlots();
    return () => {
      canceled = true;
    };
  }, [params.id, consultType, caseId, tileMinutes, apiEnabled, canBeBooked]);

  /* ----------------- create appointment with committed price ----------------- */

  const selectedStart = confirm.start;
  const selectedEndsAt = selectedStart ? addMinutes(selectedStart, fee.durationMin) : undefined;

  async function confirmBooking() {
    if (!canBeBooked) {
      push('This clinician is not currently bookable on Ambulant+.', 'error');
      setConfirm({ open: false });
      return;
    }

    if (!selectedStart || !selectedEndsAt) return;

    if (!apiEnabled) {
      push('Live booking is currently available for South Africa (ZA) only.', 'error');
      setConfirm({ open: false });
      return;
    }

    if (consultType === 'followup' && !followUpAllowed) {
      push('Follow-ups require an active case context.', 'error');
      setConfirm({ open: false });
      return;
    }

    try {
      const payload: any = {
        clinicianId: params.id,
        startsAt: selectedStart,
        endsAt: selectedEndsAt,
        reason: consultType === 'followup' ? 'Follow-up consultation' : 'New consultation',
        kind: consultType,
        visitMode: 'televisit',
        country,
      };

      if (consultType === 'followup' && caseId) {
        payload.caseId = caseId;
      }

      const r = await fetch('/api/appointments/new', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-role': 'patient',
          'x-uid': getUid(),
        },
        body: JSON.stringify(payload),
      });

      const j = await readJsonSafe(r);

      if (r.status === 409 && j?.error === 'PRECHECK_REQUIRED') {
        const warningText = Array.isArray(j?.preflight?.warnings)
          ? j.preflight.warnings.map((w: any) => w?.title || w?.message).filter(Boolean).join(' • ')
          : 'Booking needs confirmation before proceeding.';
        push(warningText || 'Booking needs confirmation before proceeding.', 'error');
        return;
      }

      if (!r.ok) {
        throw new Error(j?.error || `Booking failed (HTTP ${r.status})`);
      }

      setConfirm({ open: false });

      if (j?.redirectUrl) {
        try {
          sessionStorage.setItem(
            'ambulant:lastPaymentAttempt',
            JSON.stringify({
              appointmentId: j.appointmentId ?? j.appointment_id ?? '',
              encounterId: j.encounterId ?? j.encounter_id ?? '',
              paymentRef:
                j.payment?.ref ??
                j.paymentRef ??
                j.payment_ref ??
                '',
              redirectUrl: j.redirectUrl,
              clinicianId: params.id,
              createdAt: new Date().toISOString(),
            }),
          );
        } catch {}

        push('Redirecting to secure payment…', 'info');
        window.location.href = j.redirectUrl;
        return;
      }

      if (j?.payment?.status === 'PENDING') {
        push('Booking created. Payment is pending.', 'info');
        router.push('/appointments');
        return;
      }

      if (j?.sponsor?.decision === 'COVERED') {
        push('Appointment booked and covered ✔️', 'success');
        router.push('/appointments');
        return;
      }

      push('Appointment booked ✔️', 'success');
      router.push('/appointments');
    } catch (e: any) {
      push(e?.message || 'Failed to book appointment', 'error');
    }
  }

  const title = consultType === 'followup' ? 'Follow-up — Calendar' : 'New consultation — Calendar';
  const helperText =
    consultType === 'followup' ? `Follow-up for Case: ${caseId ?? '—'}` : 'This booking creates a first consultation for a new case.';

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-4">
      <Toasts />

      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-teal-700 hover:underline">
          ← Back
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="text-lg font-semibold">{c.name}</div>
            <div className="text-xs text-amber-700">
              ★ {ratingValue != null ? ratingValue.toFixed(1) : '—'}
              {ratingCount != null ? <span className="text-gray-500"> · {ratingCount.toLocaleString()} rated</span> : null}
            </div>
          </div>
          <h1 className="text-xl font-semibold mt-1">{title}</h1>
          <div className="text-xs text-gray-600 mt-1">{helperText}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/clinicians" className="text-sm text-gray-600 hover:underline">
            Clinicians
          </Link>
        </div>
      </div>

      {!apiEnabled && (
        <div className="text-sm text-amber-800 border border-amber-200 bg-amber-50 px-3 py-2 rounded">
          Live booking is currently available for <b>South Africa (ZA)</b> only. You can still view the clinician calendar
          layout and fee profile.
        </div>
      )}

      {!canBeBooked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Booking is temporarily unavailable for this clinician.
          {Array.isArray(operational?.blockers) && operational.blockers.length ? (
            <div className="mt-1 text-xs">
              Reason: <b>{operational.blockers.join(', ')}</b>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
        <div className="space-y-4">
          <section className="bg-white border rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">Booking type</div>
                <div className="text-xs text-gray-600">Follow-ups can only be booked from an active Case/Encounter context.</div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="text-sm border rounded px-3 py-2"
                  value={consultType}
                  onChange={(e) => {
                    const v = e.target.value as ConsultType;
                    if (v === 'followup' && !followUpAllowed) {
                      push('Follow-up requires a caseId (from your Cases/Encounters page).', 'error');
                      return;
                    }
                    setConsultType(v);
                  }}
                  disabled={!canBeBooked}
                >
                  <option value="standard">Standard (new case)</option>
                  <option value="followup" disabled={!followUpAllowed}>
                    Follow-up (case required)
                  </option>
                </select>

                {consultType === 'followup' && !followUpAllowed && <span className="text-xs text-rose-600">caseId missing</span>}
              </div>
            </div>

            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Fee (committed at booking)</div>
                <div className="text-lg font-semibold">{formatMoney(fee.priceCents, fee.currency)}</div>
                <div className="text-xs text-gray-500">{fee.currency}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Consult duration</div>
                <div className="text-lg font-semibold">{fee.durationMin} min</div>
                <div className="text-xs text-gray-500">EndsAt = StartsAt + {fee.durationMin} min</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-gray-500">Slot tile size</div>
                <div className="text-lg font-semibold">{tileMinutes} min</div>
                <div className="text-xs text-gray-500">
                  {fee.durationMin} consult + {fee.bufferMin} buffer
                </div>
              </div>
            </div>

            {consultType === 'followup' && followUpAllowed && (
              <div className="mt-3 text-sm text-gray-700">
                Follow-up will be attached to <b>Case {caseId}</b>.
              </div>
            )}

            {consultType === 'standard' && (
              <div className="mt-3 text-xs text-gray-600">
                This calendar is for a <b>first consultation</b>. For follow-ups, go to your Case/Encounter page and book
                from the case context.
              </div>
            )}
          </section>
          <section className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium mb-1">Available slots (next 14 days)</div>
                <p className="text-xs text-gray-600">
                  Tiles match clinician’s effective slot size ({tileMinutes} min). Click a tile to confirm booking.
                </p>
              </div>
              <div className="text-xs text-gray-600">
                {isPremium ? 'Premium can instant-book when online.' : 'Choose a time to book.'}
              </div>
            </div>

            {busy ? (
              <div className="text-sm text-gray-500 mt-3">Loading…</div>
            ) : err ? (
              <div className="text-sm text-rose-600 mt-3">{err}</div>
            ) : slots.length === 0 ? (
              <div className="text-sm text-gray-500 mt-3">
                {apiEnabled ? 'No open slots in this window.' : 'Live availability is not available for this country.'}
              </div>
            ) : (
              <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 mt-3">
                {slots.map((s) => {
                  const start = s.start;
                  const displayEnd = addMinutes(start, fee.durationMin);
                  return (
                    <li key={start}>
                      <button
                        className="w-full text-left block text-xs px-3 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setConfirm({ open: true, start })}
                        title="Select this slot"
                        disabled={!apiEnabled || !canBeBooked}
                      >
                        <div className="font-medium">{new Date(start).toLocaleString()}</div>
                        <div className="text-[11px] text-gray-600">
                          Ends {new Date(displayEnd).toLocaleTimeString()} · {fee.durationMin} min ·{' '}
                          {formatMoney(fee.priceCents, fee.currency)}
                        </div>
                        <div className="text-[11px] text-gray-500">Tile: {tileMinutes} min</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="bg-white border rounded-lg p-4 h-fit space-y-3">
          <div>
            <div className="font-medium mb-1">Refund policy</div>
            <p className="text-xs text-gray-600 mb-2">
              This clinician’s policy applies to this booking. Please read before confirming.
            </p>
            <RefundPolicyPanel clinicianId={params.id} />
          </div>

          <div className="border-t pt-3">
            <div className="font-medium mb-1">Rules</div>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>• Standard bookings = new case first consultation.</li>
              <li>• Follow-ups require an open case and must be booked from encounter/case context.</li>
              <li>• Appointment price is committed at booking time (fee changes won’t affect existing bookings).</li>
            </ul>
          </div>
        </aside>
      </div>

      {confirm.open && selectedStart && selectedEndsAt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-md">
            <h2 className="text-lg font-semibold">Confirm booking</h2>

            <div className="mt-2 text-sm text-gray-700">
              <div>
                <span className="text-gray-500">Type:</span>{' '}
                <b>{consultType === 'followup' ? 'Follow-up' : 'Standard (new case)'}</b>
              </div>
              {consultType === 'followup' && (
                <div className="mt-1">
                  <span className="text-gray-500">Case:</span> <b>{caseId ?? '—'}</b>
                </div>
              )}
              <div className="mt-2">
                <span className="text-gray-500">Starts:</span> <b>{new Date(selectedStart).toLocaleString()}</b>
              </div>
              <div>
                <span className="text-gray-500">Ends:</span> <b>{new Date(selectedEndsAt).toLocaleString()}</b>
              </div>
              <div className="mt-2">
                <span className="text-gray-500">Fee (committed):</span>{' '}
                <b>{formatMoney(fee.priceCents, fee.currency)}</b>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Slot tile size: {tileMinutes} min (includes clinician’s buffer). Appointment endsAt is based on consult
                duration only.
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={() => setConfirm({ open: false })}>
                Cancel
              </button>
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={confirmBooking}
                disabled={!apiEnabled || !canBeBooked}
              >
                Confirm &amp; book
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
