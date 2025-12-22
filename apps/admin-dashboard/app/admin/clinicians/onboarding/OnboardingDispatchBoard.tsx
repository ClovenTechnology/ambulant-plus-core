// apps/admin-dashboard/app/admin/clinicians/onboarding/OnboardingDispatchBoard.tsx
'use client';

import { useState } from 'react';

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

export default function OnboardingDispatchBoard({
  rows,
}: {
  rows: OnboardingBoardRow[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const sorted = [...rows].sort((a, b) => {
    const ra = computeReadiness(a).score;
    const rb = computeReadiness(b).score;
    if (rb !== ra) return rb - ra; // higher readiness first
    return (
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime()
    );
  });

  async function postAction(url: string, body: any) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => 'error');
      alert(`Action failed (${url}): ${txt}`);
      return false;
    }
    location.reload();
    return true;
  }

  const handleScheduleTraining = async (row: OnboardingBoardRow) => {
    const start = prompt(
      'Enter training start datetime (ISO, e.g. 2025-03-31T15:00:00Z)',
    );
    if (!start) return;
    const end =
      prompt(
        'Enter training end datetime (ISO, optional, blank to auto-calc 60 min)',
      ) || null;
    setBusyId(row.clinicianId);
    try {
      await postAction('/api/admin/clinicians/onboarding/schedule-training', {
        clinicianId: row.clinicianId,
        onboardingId: row.onboarding.id,
        startAt: start,
        endAt: end,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkTrainingComplete = async (row: OnboardingBoardRow) => {
    if (!row.trainingSlot) {
      alert('No training slot associated with this clinician yet.');
      return;
    }
    if (
      !confirm(
        `Mark training slot ${row.trainingSlot.id} as completed for ${row.displayName}?`,
      )
    )
      return;
    setBusyId(row.clinicianId);
    try {
      await postAction(
        '/api/admin/clinicians/onboarding/mark-training-complete',
        {
          clinicianId: row.clinicianId,
          onboardingId: row.onboarding.id,
          trainingSlotId: row.trainingSlot.id,
        },
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateDispatch = async (row: OnboardingBoardRow) => {
    const courierName =
      prompt('Courier name (e.g. Dawn Wing, The Courier Guy)') || '';
    const trackingCode =
      prompt('Tracking code (as supplied by courier, optional)') || '';
    setBusyId(row.clinicianId);
    try {
      await postAction('/api/admin/clinicians/onboarding/create-dispatch', {
        clinicianId: row.clinicianId,
        onboardingId: row.onboarding.id,
        courierName: courierName || null,
        trackingCode: trackingCode || null,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateDispatchStatus = async (
    row: OnboardingBoardRow,
    status:
      | 'pending'
      | 'packed'
      | 'shipped'
      | 'delivered'
      | 'canceled',
  ) => {
    if (!row.dispatch) {
      alert('No dispatch found for this clinician yet.');
      return;
    }
    if (
      !confirm(
        `Update dispatch ${row.dispatch.id} status to ${status} for ${row.displayName}?`,
      )
    )
      return;
    setBusyId(row.clinicianId);
    try {
      await postAction(
        '/api/admin/clinicians/onboarding/update-dispatch-status',
        {
          clinicianId: row.clinicianId,
          dispatchId: row.dispatch.id,
          status,
        },
      );
    } finally {
      setBusyId(null);
    }
  };

  if (sorted.length === 0) {
    return (
      <section className="rounded-lg border bg-white p-4 text-sm text-gray-600">
        No clinicians in onboarding. New signups will appear here once
        created.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-white p-3 text-xs text-gray-600">
        <div className="font-semibold text-gray-800">
          Onboarding → Training → Dispatch
        </div>
        <div className="mt-1">
          Each card represents one clinician. Actions here update the{' '}
          <code className="font-mono text-[11px]">
            ClinicianOnboarding
          </code>
          ,{' '}
          <code className="font-mono text-[11px]">
            ClinicianTrainingSlot
          </code>{' '}
          and{' '}
          <code className="font-mono text-[11px]">ClinicianDispatch</code>{' '}
          models via admin API routes.
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
            readiness.score >= 80
              ? 'Launch-ready'
              : readiness.score >= 50
              ? 'In progress'
              : 'Early stage';

          return (
            <article
              key={row.clinicianId}
              className="flex flex-col gap-3 rounded-xl border bg-white p-4 md:flex-row md:items-start md:justify-between"
            >
              {/* Left: clinician & stage */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-gray-900">
                    {row.displayName}
                  </h2>
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
                  <span className="text-[11px] text-gray-400">
                    • Signed up: {created}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    • {readinessLabel}
                  </span>
                </div>

                {/* Readiness bar */}
                <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                  <span>Progress</span>
                  <div className="h-1.5 w-32 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-600"
                      style={{ width: `${readiness.score}%` }}
                    />
                  </div>
                  <span className="text-gray-500">
                    Docs {readiness.docWeight} • Training{' '}
                    {readiness.trainingWeight} • Dispatch{' '}
                    {readiness.dispatchWeight}
                  </span>
                </div>

                {row.onboarding.notes && (
                  <div className="mt-1 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                    <span className="font-semibold">Notes:</span>{' '}
                    {row.onboarding.notes}
                  </div>
                )}

                {/* Training block */}
                <div className="mt-3 rounded-lg border bg-slate-50 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-semibold text-gray-800">
                      Training &amp; onboarding call
                    </div>
                    <span className="text-[11px] text-gray-500">
                      ClinicianTrainingSlot
                    </span>
                  </div>
                  {training ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-700">
                          {training.mode === 'virtual'
                            ? 'Virtual'
                            : 'In person'}{' '}
                          • {training.status}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(
                            training.startAt,
                          ).toLocaleString()}{' '}
                          →{' '}
                          {new Date(training.endAt).toLocaleTimeString(
                            [],
                            { hour: '2-digit', minute: '2-digit' },
                          )}
                        </span>
                      </div>
                      {training.joinUrl && (
                        <div className="text-[11px] text-blue-700">
                          Join: {training.joinUrl}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">
                      No training slot scheduled yet.
                    </div>
                  )}
                </div>

                {/* Dispatch block */}
                <div className="mt-3 rounded-lg border bg-slate-50 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="font-semibold text-gray-800">
                      Starter kit dispatch
                    </div>
                    <span className="text-[11px] text-gray-500">
                      ClinicianDispatch
                    </span>
                  </div>
                  {dispatch ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] capitalize text-gray-800">
                          Status: {dispatch.status}
                        </span>
                        {dispatch.courierName && (
                          <span className="text-[11px] text-gray-500">
                            Courier: {dispatch.courierName}
                          </span>
                        )}
                        {dispatch.trackingCode && (
                          <span className="text-[11px] text-gray-500">
                            Tracking: {dispatch.trackingCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {dispatch.shippedAt && (
                          <span>
                            Shipped:{' '}
                            {new Date(
                              dispatch.shippedAt,
                            ).toLocaleString()}
                          </span>
                        )}
                        {dispatch.shippedAt && dispatch.deliveredAt && (
                          <span> • </span>
                        )}
                        {dispatch.deliveredAt && (
                          <span>
                            Delivered:{' '}
                            {new Date(
                              dispatch.deliveredAt,
                            ).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500">
                      No dispatch created yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex-shrink-0 space-y-2 text-xs">
                {/* Training actions */}
                <div className="rounded-lg border bg-white p-2">
                  <div className="mb-1 text-[11px] font-semibold text-gray-800">
                    Training actions
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleScheduleTraining(row)}
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
                  </div>
                </div>

                {/* Dispatch actions */}
                <div className="rounded-lg border bg-white p-2">
                  <div className="mb-1 text-[11px] font-semibold text-gray-800">
                    Dispatch actions
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={isBusy || !!row.dispatch}
                      onClick={() => handleCreateDispatch(row)}
                      className="rounded bg-teal-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      Create starter kit dispatch
                    </button>
                    {row.dispatch && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(['packed', 'shipped', 'delivered', 'canceled'] as const).map(
                          (s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleUpdateDispatchStatus(row, s)
                              }
                              className="rounded-full border px-2 py-0.5 text-[10px] capitalize hover:bg-gray-50 disabled:opacity-50"
                            >
                              {s}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isBusy && (
                  <div className="text-[11px] text-gray-500">Saving…</div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
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
