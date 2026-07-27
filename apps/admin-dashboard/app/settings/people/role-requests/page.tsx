'use client';

import {
  useEffect,
  useState,
} from 'react';
import type {
  RoleName,
} from '@/src/lib/gateway';
import {
  RoleReqApi,
} from '@/src/lib/gateway';

type RequestStatus =
  | 'pending'
  | 'approved'
  | 'denied';

type RequestView =
  | RequestStatus
  | 'all';

type Item = {
  id: string;
  email: string;
  name?: string | null;
  userId?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  department?: {
    name?: string | null;
  } | null;
  designation?: {
    name?: string | null;
  } | null;
  requestedRoles: RoleName[];
  status: RequestStatus;
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

type DecisionTarget = {
  item: Item;
  status:
    | 'approved'
    | 'denied';
};

function friendlyError(
  value: unknown,
) {
  const raw =
    value instanceof Error
      ? value.message
      : String(
          value || '',
        );

  if (
    raw.includes(
      'secure_admin_credential_required',
    )
  ) {
    return 'Approvals require a password-authenticated Super Admin session. This Super Admin account must have a secure credential before decisions can be made.';
  }

  if (
    raw.includes(
      'admin_authentication_required',
    )
  ) {
    return 'Your Admin session has expired. Sign in again to continue.';
  }

  if (
    raw.includes(
      'super_admin_required',
    )
  ) {
    return 'Only a Super Admin can review or decide Admin account applications.';
  }

  if (
    raw.includes(
      'self_approval_not_permitted',
    )
  ) {
    return 'A Super Admin cannot approve or deny their own application.';
  }

  if (
    raw.includes(
      'superadmin_designation_requires_separate_assignment',
    ) ||
    raw.includes(
      'superadmin_role_requires_separate_assignment',
    )
  ) {
    return 'This request contains Super Admin authority. Super Admin access must be assigned through a separate controlled process.';
  }

  if (
    raw.includes(
      'role_request_requires_at_least_one_role',
    )
  ) {
    return 'This application does not contain an eligible role or designation. Update the organisational assignment before approval.';
  }

  if (
    raw.includes(
      'pending_application_credential_missing',
    )
  ) {
    return 'The applicant’s secure credential record is missing. The account was not activated.';
  }

  if (
    raw.includes(
      'role_request_already_decided',
    )
  ) {
    return 'This application has already been decided. Refresh the page to see its current status.';
  }

  if (
    raw.includes(
      'role_request_gateway_unavailable',
    )
  ) {
    return 'The approval service is temporarily unavailable. Please try again.';
  }

  return raw ||
    'The approval operation failed.';
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    'en-ZA',
    {
      dateStyle:
        'medium',
      timeStyle:
        'short',
    },
  );
}

function statusClass(
  status: RequestStatus,
) {
  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'denied') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function RoleRequestsPage() {
  const [
    items,
    setItems,
  ] =
    useState<Item[]>([]);

  const [
    view,
    setView,
  ] =
    useState<RequestView>(
      'pending',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null,
    );

  const [
    decisionTarget,
    setDecisionTarget,
  ] =
    useState<DecisionTarget | null>(
      null,
    );

  const [
    reason,
    setReason,
  ] =
    useState('');

  const [
    actionPending,
    setActionPending,
  ] =
    useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await RoleReqApi.list(
          view === 'all'
            ? undefined
            : view,
        );

      setItems(
        Array.isArray(
          response?.items,
        )
          ? response.items
          : [],
      );
    }
    catch (caught) {
      setItems([]);
      setError(
        friendlyError(
          caught,
        ),
      );
    }
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function openDecision(
    item: Item,
    status:
      | 'approved'
      | 'denied',
  ) {
    setError(null);
    setNotice(null);
    setReason('');
    setDecisionTarget({
      item,
      status,
    });
  }

  function closeDecision() {
    if (actionPending) {
      return;
    }

    setDecisionTarget(
      null,
    );
    setReason('');
  }

  async function submitDecision() {
    if (!decisionTarget) {
      return;
    }

    const cleanReason =
      reason.trim();

    if (
      decisionTarget.status ===
        'denied' &&
      !cleanReason
    ) {
      setError(
        'A reason is required when denying an Admin account application.',
      );

      return;
    }

    setActionPending(true);
    setError(null);
    setNotice(null);

    try {
      await RoleReqApi.decide(
        decisionTarget.item.id,
        {
          status:
            decisionTarget.status,
          reason:
            cleanReason ||
            undefined,
        },
      );

      const applicant =
        decisionTarget.item.name ||
        decisionTarget.item.email;

      setNotice(
        decisionTarget.status ===
          'approved'
          ? `${applicant} was approved and the Admin profile was activated.`
          : `${applicant} was denied. The account remains inactive.`,
      );

      setDecisionTarget(
        null,
      );

      setReason('');

      await refresh();
    }
    catch (caught) {
      setError(
        friendlyError(
          caught,
        ),
      );
    }
    finally {
      setActionPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Access governance
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Admin account approvals
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              New Admin registrations remain inactive until a password-authenticated Super Admin reviews and approves the application.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                'pending',
                'approved',
                'denied',
                'all',
              ] as const
            ).map(
              (candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={
                    view ===
                    candidate
                      ? 'rounded-lg border border-slate-950 bg-slate-950 px-3 py-2 text-sm font-medium text-white'
                      : 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'
                  }
                  onClick={() =>
                    setView(
                      candidate,
                    )
                  }
                >
                  {
                    candidate
                      .charAt(0)
                      .toUpperCase() +
                    candidate.slice(1)
                  }
                </button>
              ),
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Approver identity is taken from the signed live session. Applications cannot be self-approved, and decision history cannot be deleted.
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {loading
            ? 'Loading applications…'
            : `${items.length} application${items.length === 1 ? '' : 's'} shown`}
        </div>

        <button
          type="button"
          onClick={() =>
            void refresh()
          }
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {!loading &&
      !items.length ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            No {view === 'all' ? '' : `${view} `}applications
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            New Admin registrations will appear here for Super Admin review.
          </p>
        </section>
      ) : null}

      <ul className="space-y-3">
        {items.map(
          (item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-950">
                      {item.name ||
                        item.email}
                    </h2>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-1 break-all text-sm text-slate-600">
                    {item.email}
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs text-slate-500">
                        Department
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {item.department
                          ?.name ||
                          '—'}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">
                        Designation
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {item.designation
                          ?.name ||
                          '—'}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">
                        Submitted
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {formatDate(
                          item.createdAt,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">
                        Request ID
                      </dt>
                      <dd className="mt-1 truncate font-mono text-xs text-slate-700">
                        {item.id}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <div className="text-xs font-medium text-slate-500">
                      Requested roles
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.requestedRoles
                        ?.length ? (
                        item.requestedRoles.map(
                          (role) => (
                            <span
                              key={role}
                              className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                            >
                              {role}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-sm text-slate-600">
                          No extra role requested; approved designation access will apply.
                        </span>
                      )}
                    </div>
                  </div>

                  {item.status !==
                  'pending' ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div>
                        Decided by:{' '}
                        <span className="font-medium">
                          {item.decidedBy ||
                            'Recorded administrator'}
                        </span>
                      </div>

                      <div className="mt-1">
                        Decision date:{' '}
                        <span className="font-medium">
                          {formatDate(
                            item.decidedAt,
                          )}
                        </span>
                      </div>

                      {item.reason ? (
                        <div className="mt-2">
                          Reason: {item.reason}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      item.status !==
                      'pending'
                    }
                    onClick={() =>
                      openDecision(
                        item,
                        'approved',
                      )
                    }
                    className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    disabled={
                      item.status !==
                      'pending'
                    }
                    onClick={() =>
                      openDecision(
                        item,
                        'denied',
                      )
                    }
                    className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Deny
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        item.id,
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Copy ID
                  </button>
                </div>
              </div>
            </li>
          ),
        )}
      </ul>

      {decisionTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-title"
        >
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Super Admin decision
            </div>

            <h2
              id="decision-title"
              className="mt-2 text-xl font-semibold text-slate-950"
            >
              {decisionTarget.status ===
              'approved'
                ? 'Approve Admin account'
                : 'Deny Admin application'}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {decisionTarget.status ===
              'approved'
                ? 'Approval will activate the Admin profile and apply the approved designation and roles.'
                : 'Denial keeps the account inactive and prevents the applicant from signing in.'}
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium text-slate-900">
                {decisionTarget.item
                  .name ||
                  decisionTarget.item
                    .email}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                {decisionTarget.item
                  .email}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-800">
                {decisionTarget.status ===
                'denied'
                  ? 'Reason for denial'
                  : 'Approval note (optional)'}
              </span>

              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                maxLength={1000}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder={
                  decisionTarget.status ===
                  'denied'
                    ? 'Explain why this application is being denied.'
                    : 'Add an optional audit note.'
                }
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={
                  closeDecision
                }
                disabled={
                  actionPending
                }
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void submitDecision()
                }
                disabled={
                  actionPending ||
                  (
                    decisionTarget.status ===
                      'denied' &&
                    !reason.trim()
                  )
                }
                className={
                  decisionTarget.status ===
                  'approved'
                    ? 'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50'
                    : 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50'
                }
              >
                {actionPending
                  ? 'Saving decision…'
                  : decisionTarget.status ===
                      'approved'
                    ? 'Confirm approval'
                    : 'Confirm denial'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}