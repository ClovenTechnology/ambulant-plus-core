// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingDispatchBoard.tsx
'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type OnboardingBoardRow = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  createdAt: string;

  onboarding: {
    id: string;
    stage:
      | 'applied'
      | 'screened'
      | 'approved'
      | 'rejected'
      | 'training_scheduled'
      | 'training_completed';
    notes?: string | null;
  };

  trainingSlot?: {
    id: string;
    startAt: string;
    endAt: string;
    mode: 'virtual' | 'in_person';
    status: 'scheduled' | 'completed' | 'canceled';
    joinUrl?: string | null;
  } | null;

  dispatch?: {
    id: string;
    status: 'pending' | 'packed' | 'shipped' | 'delivered' | 'canceled';
    courierName?: string | null;
    trackingCode?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
};

type Readiness = {
  score: number; // 0-100
  docWeight: number;
  trainingWeight: number;
  dispatchWeight: number;
};

const STARTER_KIT: { key: string; label: string }[] = [
  { key: 'duecare_health_monitor', label: 'DueCare 6-in-1 Health Monitor' },
  { key: 'nexring', label: 'NexRing (sleep/stress/vitals)' },
  { key: 'digital_stethoscope', label: 'Digital Stethoscope' },
  { key: 'hd_otoscope', label: 'HD Otoscope' },
  { key: 'cables_chargers', label: 'Cables, chargers & adapters' },
  { key: 'quickstart_pack', label: 'Quick-start pack (QR + guides)' },
];

function safeDate(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toLocalInputValue(iso?: string | null) {
  const d = safeDate(iso);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localInputToIso(v: string) {
  // datetime-local is interpreted in local tz by JS Date ctor
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function computeReadiness(row: OnboardingBoardRow): Readiness {
  let doc = 0;
  let training = 0;
  let dispatch = 0;

  // Docs / onboarding stage
  switch (row.onboarding.stage) {
    case 'applied':
      doc = 10;
      break;
    case 'screened':
      doc = 20;
      break;
    case 'approved':
      doc = 40;
      break;
    case 'training_scheduled':
      doc = 50;
      break;
    case 'training_completed':
      doc = 50;
      break;
    case 'rejected':
      doc = 0;
      break;
    default:
      doc = 0;
  }

  // Training
  if (row.trainingSlot) {
    if (row.trainingSlot.status === 'scheduled') {
      training = 15;
    } else if (row.trainingSlot.status === 'completed') {
      training = 30;
    }
  } else if (row.onboarding.stage === 'training_completed') {
    training = 30;
  }

  // Dispatch
  if (row.dispatch) {
    switch (row.dispatch.status) {
      case 'pending':
      case 'packed':
        dispatch = 10;
        break;
      case 'shipped':
        dispatch = 20;
        break;
      case 'delivered':
        dispatch = 30;
        break;
      case 'canceled':
        dispatch = 0;
        break;
      default:
        dispatch = 0;
    }
  }

  const score = Math.min(doc + training + dispatch, 100);
  return { score, docWeight: doc, trainingWeight: training, dispatchWeight: dispatch };
}

function StagePill({
  stage,
}: {
  stage: OnboardingBoardRow['onboarding']['stage'];
}) {
  const pretty =
    stage === 'training_scheduled'
      ? 'Training scheduled'
      : stage === 'training_completed'
      ? 'Training completed'
      : stage.charAt(0).toUpperCase() + stage.slice(1);
  const tone =
    stage === 'approved' || stage === 'training_completed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : stage === 'rejected'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {pretty}
    </span>
  );
}

/* ------------------------------
   Tiny modal helpers
------------------------------ */
function Modal({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl rounded-2xl border bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="mt-0.5 text-[11px] text-gray-500">
              Times are saved as ISO (UTC). Inputs are in your local timezone.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-[11px] font-semibold text-gray-700">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-gray-500">{hint}</div> : null}
    </label>
  );
}

export default function OnboardingDispatchBoard({
  rows,
}: {
  rows: OnboardingBoardRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // schedule modal
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedRow, setSchedRow] = useState<OnboardingBoardRow | null>(null);
  const [schedMode, setSchedMode] = useState<'virtual' | 'in_person'>('virtual');
  const [schedStartLocal, setSchedStartLocal] = useState('');
  const [schedEndLocal, setSchedEndLocal] = useState('');
  const [schedDurationMin, setSchedDurationMin] = useState(60);
  const [schedJoinUrl, setSchedJoinUrl] = useState('');

  // dispatch modal
  const [dispOpen, setDispOpen] = useState(false);
  const [dispRow, setDispRow] = useState<OnboardingBoardRow | null>(null);
  const [dispCourier, setDispCourier] = useState('');
  const [dispTrackingCode, setDispTrackingCode] = useState('');
  const [dispTrackingUrl, setDispTrackingUrl] = useState('');
  const [dispKit, setDispKit] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const it of STARTER_KIT) init[it.key] = true;
    return init;
  });
  const [dispNotifyNow, setDispNotifyNow] = useState(true);

  // tracking update modal (for existing dispatch)
  const [trackOpen, setTrackOpen] = useState(false);
  const [trackRow, setTrackRow] = useState<OnboardingBoardRow | null>(null);
  const [trackCourier, setTrackCourier] = useState('');
  const [trackCode, setTrackCode] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [trackNotify, setTrackNotify] = useState(true);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ra = computeReadiness(a).score;
      const rb = computeReadiness(b).score;
      if (rb !== ra) return rb - ra;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [rows]);

  const postAction = useCallback(
    async (url: string, body: any) => {
      setNotice(null);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => 'error');
        setNotice({ tone: 'err', text: `Action failed (${url}): ${txt}` });
        return false;
      }
      router.refresh();
      return true;
    },
    [router]
  );

  const openSchedule = (row: OnboardingBoardRow) => {
    setSchedRow(row);
    const t = row.trainingSlot;
    setSchedMode(t?.mode ?? 'virtual');
    setSchedStartLocal(toLocalInputValue(t?.startAt ?? null));
    setSchedEndLocal(toLocalInputValue(t?.endAt ?? null));
    setSchedDurationMin(60);
    setSchedJoinUrl(t?.joinUrl ?? '');
    setSchedOpen(true);
  };

  const saveSchedule = async () => {
    if (!schedRow) return;
    const startIso = localInputToIso(schedStartLocal);
    if (!startIso) {
      setNotice({ tone: 'err', text: 'Start datetime is required.' });
      return;
    }

    let endIso: string | null = null;
    if (schedEndLocal?.trim()) {
      endIso = localInputToIso(schedEndLocal);
      if (!endIso) {
        setNotice({ tone: 'err', text: 'End datetime is invalid.' });
        return;
      }
    } else {
      const startD = new Date(schedStartLocal);
      const endD = new Date(startD.getTime() + Math.max(5, schedDurationMin) * 60_000);
      endIso = endD.toISOString();
    }

    if (schedMode === 'virtual' && !schedJoinUrl.trim()) {
      setNotice({ tone: 'err', text: 'Join URL is required for virtual training.' });
      return;
    }

    setBusyId(schedRow.clinicianId);
    try {
      const ok = await postAction('/api/admin/clinicians/onboarding/schedule-training', {
        clinicianId: schedRow.clinicianId,
        onboardingId: schedRow.onboarding.id,
        startAt: startIso,
        endAt: endIso,
        mode: schedMode,
        joinUrl: schedJoinUrl.trim() ? schedJoinUrl.trim() : null,
      });
      if (ok) setSchedOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkTrainingComplete = async (row: OnboardingBoardRow) => {
    if (!row.trainingSlot) {
      setNotice({ tone: 'err', text: 'No training slot associated with this clinician yet.' });
      return;
    }
    if (!confirm(`Mark training slot ${row.trainingSlot.id} as completed for ${row.displayName}?`)) return;

    setBusyId(row.clinicianId);
    try {
      await postAction('/api/admin/clinicians/onboarding/mark-training-complete', {
        clinicianId: row.clinicianId,
        onboardingId: row.onboarding.id,
        trainingSlotId: row.trainingSlot.id,
      });
    } finally {
      setBusyId(null);
    }
  };

  const openCreateDispatch = (row: OnboardingBoardRow) => {
    setDispRow(row);
    setDispCourier('');
    setDispTrackingCode('');
    setDispTrackingUrl('');
    setDispNotifyNow(true);
    // default kit all checked
    const init: Record<string, boolean> = {};
    for (const it of STARTER_KIT) init[it.key] = true;
    setDispKit(init);
    setDispOpen(true);
  };

  const saveCreateDispatch = async () => {
    if (!dispRow) return;
    if (!dispCourier.trim()) {
      setNotice({ tone: 'err', text: 'Courier name is required.' });
      return;
    }

    const kitItems = STARTER_KIT.filter((k) => !!dispKit[k.key]).map((k) => k.key);
    if (kitItems.length === 0) {
      setNotice({ tone: 'err', text: 'Select at least one kit item.' });
      return;
    }

    setBusyId(dispRow.clinicianId);
    try {
      const ok = await postAction('/api/admin/clinicians/onboarding/create-dispatch', {
        clinicianId: dispRow.clinicianId,
        onboardingId: dispRow.onboarding.id,
        courierName: dispCourier.trim(),
        trackingCode: dispTrackingCode.trim() ? dispTrackingCode.trim() : null,
        trackingUrl: dispTrackingUrl.trim() ? dispTrackingUrl.trim() : null,
        kitItems,
        notifyClinician: !!dispNotifyNow,
      });
      if (ok) setDispOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  const openUpdateTracking = (row: OnboardingBoardRow) => {
    if (!row.dispatch) {
      setNotice({ tone: 'err', text: 'No dispatch exists for this clinician yet.' });
      return;
    }
    setTrackRow(row);
    setTrackCourier(row.dispatch.courierName ?? '');
    setTrackCode(row.dispatch.trackingCode ?? '');
    setTrackUrl('');
    setTrackNotify(true);
    setTrackOpen(true);
  };

  const saveUpdateTracking = async () => {
    if (!trackRow?.dispatch) return;
    const courierName = trackCourier.trim();
    const trackingCode = trackCode.trim();
    const trackingUrl = trackUrl.trim();

    if (!courierName) {
      setNotice({ tone: 'err', text: 'Courier name is required.' });
      return;
    }
    if (!trackingCode && !trackingUrl) {
      setNotice({ tone: 'err', text: 'Provide tracking code and/or tracking URL.' });
      return;
    }

    // kit items still included for notification payload (stable “full kit list”)
    const kitItems = STARTER_KIT.map((k) => k.key);

    setBusyId(trackRow.clinicianId);
    try {
      const ok = await postAction('/api/admin/clinicians/onboarding/update-dispatch-tracking', {
        clinicianId: trackRow.clinicianId,
        dispatchId: trackRow.dispatch.id,
        courierName,
        trackingCode: trackingCode || null,
        trackingUrl: trackingUrl || null,
        kitItems,
        notifyClinician: !!trackNotify,
      });
      if (ok) setTrackOpen(false);
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateDispatchStatus = async (
    row: OnboardingBoardRow,
    status: 'pending' | 'packed' | 'shipped' | 'delivered' | 'canceled'
  ) => {
    if (!row.dispatch) {
      setNotice({ tone: 'err', text: 'No dispatch found for this clinician yet.' });
      return;
    }
    if (!confirm(`Update dispatch ${row.dispatch.id} status to ${status} for ${row.displayName}?`)) return;

    setBusyId(row.clinicianId);
    try {
      await postAction('/api/admin/clinicians/onboarding/update-dispatch-status', {
        clinicianId: row.clinicianId,
        dispatchId: row.dispatch.id,
        status,
      });
    } finally {
      setBusyId(null);
    }
  };

  if (sorted.length === 0) {
    return (
      <section className="rounded-lg border bg-white p-4 text-sm text-gray-600">
        No clinicians in onboarding. New signups will appear here once created.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {notice && (
        <div
          className={[
            'rounded border p-3 text-xs',
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          ].join(' ')}
        >
          {notice.text}
        </div>
      )}

      <div className="rounded-lg border bg-white p-3 text-xs text-gray-600">
        <div className="font-semibold text-gray-800">Onboarding → Training → Dispatch</div>
        <div className="mt-1">
          “Schedule training” is now a proper modal (no ISO prompts). For a full calendar view, use{' '}
          <a className="text-blue-700 hover:underline" href="/admin/calendar">
            /admin/calendar
          </a>
          .
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((row) => {
          const created = new Date(row.createdAt).toLocaleString();
          const training = row.trainingSlot;
          const dispatch = row.dispatch;
          const isBusy = busyId === row.clinicianId;
          const readiness = computeReadiness(row);

          const readinessLabel =
            readiness.score >= 80 ? 'Launch-ready' : readiness.score >= 50 ? 'In progress' : 'Early stage';

          return (
            <article
              key={row.clinicianId}
              className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row md:items-start md:justify-between"
            >
              {/* Left */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-gray-900">{row.displayName}</h2>
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-gray-700">
                    {row.specialty || 'Unknown specialty'}
                  </span>
                  <StagePill stage={row.onboarding.stage} />
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                    Readiness: {readiness.score}%
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {row.email && <span>{row.email}</span>}
                  {row.email && row.phone && <span>•</span>}
                  {row.phone && <span>{row.phone}</span>}
                  <span className="text-[11px] text-gray-400">• Signed up: {created}</span>
                  <span className="text-[11px] text-gray-400">• {readinessLabel}</span>
                </div>

                {/* Readiness bar */}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                  <span>Progress</span>
                  <div className="h-1.5 w-32 rounded-full bg-gray-100">
                    <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${readiness.score}%` }} />
                  </div>
                  <span className="text-gray-500">
                    Docs {readiness.docWeight} • Training {readiness.trainingWeight} • Dispatch {readiness.dispatchWeight}
                  </span>
                </div>

                {row.onboarding.notes && (
                  <div className="mt-1 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                    <span className="font-semibold">Notes:</span> {row.onboarding.notes}
                  </div>
                )}

                {/* Training block */}
                <div className="mt-3 rounded-lg border bg-slate-50 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-semibold text-gray-800">Training &amp; onboarding call</div>
                    <span className="text-[11px] text-gray-500">ClinicianTrainingSlot</span>
                  </div>
                  {training ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-700">
                          {training.mode === 'virtual' ? 'Virtual' : 'In person'} • {training.status}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(training.startAt).toLocaleString()} →{' '}
                          {new Date(training.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {training.joinUrl && <div className="text-[11px] text-blue-700 break-all">Join: {training.joinUrl}</div>}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">No training slot scheduled yet.</div>
                  )}
                </div>

                {/* Dispatch block */}
                <div className="mt-3 rounded-lg border bg-slate-50 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-semibold text-gray-800">Starter kit dispatch</div>
                    <span className="text-[11px] text-gray-500">ClinicianDispatch</span>
                  </div>
                  {dispatch ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] capitalize text-gray-800">
                          Status: {dispatch.status}
                        </span>
                        {dispatch.courierName && <span className="text-[11px] text-gray-500">Courier: {dispatch.courierName}</span>}
                        {dispatch.trackingCode && <span className="text-[11px] text-gray-500">Tracking: {dispatch.trackingCode}</span>}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {dispatch.shippedAt && <span>Shipped: {new Date(dispatch.shippedAt).toLocaleString()}</span>}
                        {dispatch.shippedAt && dispatch.deliveredAt && <span> • </span>}
                        {dispatch.deliveredAt && <span>Delivered: {new Date(dispatch.deliveredAt).toLocaleString()}</span>}
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => openUpdateTracking(row)}
                          className="rounded border bg-white px-2 py-1 text-[11px] hover:bg-gray-50 disabled:opacity-50"
                        >
                          Update tracking &amp; notify clinician
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">No dispatch created yet.</div>
                  )}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex-shrink-0 space-y-2 text-xs">
                <div className="rounded-lg border bg-white p-2">
                  <div className="mb-1 text-[11px] font-semibold text-gray-800">Training actions</div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openSchedule(row)}
                      className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Schedule training
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || !row.trainingSlot}
                      onClick={() => handleMarkTrainingComplete(row)}
                      className="rounded bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Mark training completed
                    </button>
                    <a
                      href={`/admin/calendar?focus=${encodeURIComponent(row.clinicianId)}`}
                      className="rounded border bg-white px-3 py-1 text-[11px] font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Open in calendar
                    </a>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-2">
                  <div className="mb-1 text-[11px] font-semibold text-gray-800">Dispatch actions</div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={isBusy || !!row.dispatch}
                      onClick={() => openCreateDispatch(row)}
                      className="rounded bg-teal-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      Create starter kit dispatch
                    </button>

                    {row.dispatch && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(['packed', 'shipped', 'delivered', 'canceled'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUpdateDispatchStatus(row, s)}
                            className="rounded-full border px-2 py-0.5 text-[10px] capitalize hover:bg-gray-50 disabled:opacity-50"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isBusy && <div className="text-[11px] text-gray-500">Saving…</div>}
              </div>
            </article>
          );
        })}
      </div>

      {/* Schedule modal */}
      <Modal
        title={schedRow ? `Schedule training — ${schedRow.displayName}` : 'Schedule training'}
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-gray-500">
              Tip: leave End blank and set Duration to auto-calc.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSchedOpen(false)}
                className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSchedule}
                className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
              >
                Save schedule
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mode">
            <select
              value={schedMode}
              onChange={(e) => setSchedMode(e.target.value as any)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="virtual">Virtual</option>
              <option value="in_person">In person</option>
            </select>
          </Field>

          <Field label="Duration (minutes)" hint="Used only when End is blank.">
            <input
              type="number"
              value={schedDurationMin}
              min={15}
              step={5}
              onChange={(e) => setSchedDurationMin(Number(e.target.value || 60))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <Field label="Start (local time)">
            <input
              type="datetime-local"
              value={schedStartLocal}
              onChange={(e) => setSchedStartLocal(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <Field label="End (local time)" hint="Optional — otherwise calculated from Start + Duration.">
            <input
              type="datetime-local"
              value={schedEndLocal}
              onChange={(e) => setSchedEndLocal(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Join URL (required for virtual)">
              <input
                value={schedJoinUrl}
                onChange={(e) => setSchedJoinUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Create dispatch modal */}
      <Modal
        title={dispRow ? `Create dispatch — ${dispRow.displayName}` : 'Create dispatch'}
        open={dispOpen}
        onClose={() => setDispOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={dispNotifyNow}
                onChange={(e) => setDispNotifyNow(e.target.checked)}
              />
              Notify clinician now (if tracking present)
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDispOpen(false)}
                className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCreateDispatch}
                className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
              >
                Create dispatch
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Courier name" hint="e.g. The Courier Guy, Dawn Wing">
            <input
              value={dispCourier}
              onChange={(e) => setDispCourier(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <Field label="Tracking code (optional)">
            <input
              value={dispTrackingCode}
              onChange={(e) => setDispTrackingCode(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Tracking URL (optional)" hint="If you paste the full tracking link, the clinician gets a clickable URL.">
              <input
                value={dispTrackingUrl}
                onChange={(e) => setDispTrackingUrl(e.target.value)}
                placeholder="https://tracking…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <div className="text-[11px] font-semibold text-gray-700">Kit items</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {STARTER_KIT.map((it) => (
                <label key={it.key} className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!dispKit[it.key]}
                    onChange={(e) => setDispKit((p) => ({ ...p, [it.key]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>{it.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Update tracking modal */}
      <Modal
        title={trackRow ? `Update tracking — ${trackRow.displayName}` : 'Update tracking'}
        open={trackOpen}
        onClose={() => setTrackOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={trackNotify}
                onChange={(e) => setTrackNotify(e.target.checked)}
              />
              Notify clinician after save
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTrackOpen(false)}
                className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveUpdateTracking}
                className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90"
              >
                Save tracking
              </button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Courier name">
            <input
              value={trackCourier}
              onChange={(e) => setTrackCourier(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <Field label="Tracking code">
            <input
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Tracking URL (optional)">
              <input
                value={trackUrl}
                onChange={(e) => setTrackUrl(e.target.value)}
                placeholder="https://tracking…"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </Field>
            <div className="mt-2 text-[11px] text-gray-500">
              This will trigger an auto-notification payload containing <span className="font-semibold">trackingUrl</span> + the
              <span className="font-semibold"> full kit list</span>. If the gateway hasn’t implemented notify yet, the save still succeeds.
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
