"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type LoadState = {
  accessEnvelope: JsonRecord | null;
  overview: JsonRecord | null;
  commission: JsonRecord[];
  policies: JsonRecord[];
  payrollProfiles: JsonRecord[];
};

type LoadErrors = Partial<Record<keyof LoadState, string>>;

type CommissionFilters = {
  search: string;
  status: string;
  source: string;
  recipient: string;
  payrollInclusion: string;
  startDate: string;
  endDate: string;
};

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  commission: [],
  policies: [],
  payrollProfiles: [],
};

const initialFilters: CommissionFilters = {
  search: "",
  status: "all",
  source: "all",
  recipient: "all",
  payrollInclusion: "all",
  startDate: "",
  endDate: "",
};

const sourceCategories = [
  { value: "device_sale", label: "Device sale" },
  { value: "onboarding", label: "Onboarding" },
  { value: "subscription", label: "Subscription" },
  { value: "client_activation", label: "Client activation" },
  { value: "manual_source", label: "Manual source" },
  { value: "other", label: "Other" },
];

function apiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayFrom(value: unknown, preferredKeys: string[] = []): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  for (const key of preferredKeys) {
    const nested = value[key];

    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }

    if (isRecord(nested)) {
      const deeper = arrayFrom(nested, preferredKeys);
      if (deeper.length > 0) {
        return deeper;
      }
    }
  }

  for (const key of ["items", "rows", "data", "results", "records", "commission", "awards", "events", "policies"]) {
    const nested = value[key];

    if (Array.isArray(nested)) {
      return nested.filter(isRecord);
    }

    if (isRecord(nested)) {
      const deeper = arrayFrom(nested, preferredKeys);
      if (deeper.length > 0) {
        return deeper;
      }
    }
  }

  return [];
}

function valueAt(record: JsonRecord | null | undefined, keys: string[]): unknown {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      const nested = valueAt(value, keys);
      if (nested !== undefined && nested !== null) {
        return nested;
      }
    }
  }

  return undefined;
}

function textAt(record: JsonRecord | null | undefined, keys: string[], fallback = "—") {
  const value = valueAt(record, keys);

  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function amountAt(record: JsonRecord | null | undefined, keys: string[]) {
  if (!record) {
    return 0;
  }

  for (const key of keys) {
    const value = valueAt(record, [key]);

    if (typeof value === "number" && Number.isFinite(value)) {
      return key.toLowerCase().includes("cents") ? value / 100 : value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return key.toLowerCase().includes("cents") ? parsed / 100 : parsed;
      }
    }
  }

  return 0;
}

function sumAmounts(records: JsonRecord[], keys: string[]) {
  return records.reduce((total, record) => total + amountAt(record, keys), 0);
}

function formatMoney(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toDateValue(record: JsonRecord) {
  const value = valueAt(record, ["createdAt", "awardedAt", "eventDate", "approvedAt", "updatedAt", "payableAt"]);

  if (!value || typeof value !== "string") {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

function recordId(record: JsonRecord, fallback: string) {
  return textAt(record, ["id", "commissionId", "awardId", "eventId", "reference"], fallback);
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function fetchJson(path: string) {
  const response = await fetch(apiPath(path), {
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<unknown>;
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const borderClass =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
        ? "border-amber-200"
        : tone === "danger"
          ? "border-rose-200"
          : "border-slate-200";

  return (
    <div className={`rounded-2xl border ${borderClass} bg-white p-5 shadow-sm`}>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  );
}

function ErrorNote({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Backend endpoint did not return data yet: {message}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-semibold text-slate-700">{children}</span>;
}

function sourceLabel(value: string) {
  const match = sourceCategories.find((source) => source.value === value);
  return match?.label || value || "Other";
}

export default function EnterpriseFinanceCommissionPage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CommissionFilters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeReviewRecord, setActiveReviewRecord] = useState<JsonRecord | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const loadCommissionData = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const requests = {
      accessEnvelope: fetchJson("/api/enterprise-finance/access-envelope"),
      overview: fetchJson("/api/enterprise-finance/overview"),
      commission: fetchJson("/api/enterprise-finance/commission"),
      payrollProfiles: fetchJson("/api/enterprise-finance/staff-payroll/profiles"),
    };

    const settled = await Promise.allSettled(
      Object.entries(requests).map(async ([key, request]) => [key, await request] as const),
    );

    const nextState: LoadState = { ...emptyState };
    const nextErrors: LoadErrors = {};

    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        const [key, payload] = result.value;
        const typedKey = key as keyof LoadState;

        if (typedKey === "accessEnvelope" || typedKey === "overview") {
          nextState[typedKey] = isRecord(payload) ? payload : null;
        } else if (typedKey === "commission") {
          nextState.commission = arrayFrom(payload, ["commission", "awards", "events", "items", "rows"]);
          nextState.policies = arrayFrom(payload, ["policies", "commissionPolicies", "rules"]);
        } else if (typedKey === "payrollProfiles") {
          nextState.payrollProfiles = arrayFrom(payload, ["profiles", "staff", "items", "rows"]);
        }
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : "Unknown error";
        nextErrors.overview = nextErrors.overview || reason;
      }
    });

    setState(nextState);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCommissionData();
  }, [loadCommissionData]);

  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const sources = new Set<string>();
    const recipients = new Set<string>();

    state.commission.forEach((entry) => {
      statuses.add(textAt(entry, ["status", "approvalStatus", "paymentStatus"], "pending"));
      sources.add(textAt(entry, ["source", "sourceType", "eventType", "category"], "other"));
      recipients.add(textAt(entry, ["recipientName", "staffName", "employeeName", "name"], "Unassigned"));
    });

    sourceCategories.forEach((source) => sources.add(source.value));

    return {
      statuses: Array.from(statuses).filter(Boolean).sort(),
      sources: Array.from(sources).filter(Boolean).sort(),
      recipients: Array.from(recipients).filter(Boolean).sort(),
    };
  }, [state.commission]);

  const filteredCommission = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return state.commission.filter((entry) => {
      const status = textAt(entry, ["status", "approvalStatus", "paymentStatus"], "pending").toLowerCase();
      const source = textAt(entry, ["source", "sourceType", "eventType", "category"], "other").toLowerCase();
      const recipient = textAt(entry, ["recipientName", "staffName", "employeeName", "name"], "unassigned").toLowerCase();
      const payrollInclusion = textAt(entry, ["payrollInclusionStatus", "includedInPayroll", "payrollStatus"], "not_included").toLowerCase();
      const date = toDateValue(entry);

      if (filters.status !== "all" && status !== filters.status.toLowerCase()) {
        return false;
      }

      if (filters.source !== "all" && source !== filters.source.toLowerCase()) {
        return false;
      }

      if (filters.recipient !== "all" && recipient !== filters.recipient.toLowerCase()) {
        return false;
      }

      if (filters.payrollInclusion !== "all") {
        const wantsIncluded = filters.payrollInclusion === "included";
        const isIncluded =
          payrollInclusion.includes("included") ||
          payrollInclusion.includes("queued") ||
          payrollInclusion.includes("payroll") ||
          payrollInclusion === "true";

        if (wantsIncluded !== isIncluded) {
          return false;
        }
      }

      if (filters.startDate && date && date < filters.startDate) {
        return false;
      }

      if (filters.endDate && date && date > filters.endDate) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        recipient,
        source,
        status,
        payrollInclusion,
        textAt(entry, ["reference", "id", "eventId", "awardId"], ""),
        textAt(entry, ["description", "memo", "note", "reason"], ""),
        textAt(entry, ["clientName", "customerName", "companyName", "patientName"], ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [filters, state.commission]);

  const selectedCommission = useMemo(() => {
    return filteredCommission.filter((entry, index) => selectedIds.has(recordId(entry, String(index))));
  }, [filteredCommission, selectedIds]);

  const summary = useMemo(() => {
    const totalPayable =
      amountAt(state.overview, ["commissionPayable", "commissionOutstanding", "commissionPayableCents"]) ||
      sumAmounts(state.commission, ["amount", "amountCents", "commissionAmount", "balance"]);

    const pendingRows = state.commission.filter((entry) => {
      const status = textAt(entry, ["status", "approvalStatus", "paymentStatus"], "pending").toLowerCase();
      return status.includes("pending") || status.includes("draft") || status.includes("review");
    });

    const approvedRows = state.commission.filter((entry) => {
      const status = textAt(entry, ["status", "approvalStatus", "paymentStatus"], "").toLowerCase();
      return status.includes("approved") || status.includes("accepted");
    });

    const rejectedRows = state.commission.filter((entry) => {
      const status = textAt(entry, ["status", "approvalStatus", "paymentStatus"], "").toLowerCase();
      return status.includes("rejected") || status.includes("declined");
    });

    const payrollReadyRows = state.commission.filter((entry) => {
      const payrollStatus = textAt(entry, ["payrollInclusionStatus", "includedInPayroll", "payrollStatus"], "").toLowerCase();
      return payrollStatus.includes("included") || payrollStatus.includes("queued") || payrollStatus.includes("payroll") || payrollStatus === "true";
    });

    return {
      totalAwards: state.commission.length,
      totalPayable,
      pendingAmount: sumAmounts(pendingRows, ["amount", "amountCents", "commissionAmount", "balance"]),
      approvedAmount: sumAmounts(approvedRows, ["amount", "amountCents", "commissionAmount", "balance"]),
      rejectedCount: rejectedRows.length,
      payrollReadyAmount: sumAmounts(payrollReadyRows, ["amount", "amountCents", "commissionAmount", "balance"]),
      selectedAmount: sumAmounts(selectedCommission, ["amount", "amountCents", "commissionAmount", "balance"]),
    };
  }, [selectedCommission, state.commission, state.overview]);

  const sourceBreakdown = useMemo(() => {
    return sourceCategories.map((source) => {
      const rows = filteredCommission.filter((entry) => {
        const value = textAt(entry, ["source", "sourceType", "eventType", "category"], "other").toLowerCase();
        return value === source.value || value.includes(source.value.replace(/_/g, " "));
      });

      return {
        ...source,
        count: rows.length,
        amount: sumAmounts(rows, ["amount", "amountCents", "commissionAmount", "balance"]),
      };
    });
  }, [filteredCommission]);

  function toggleSelected(entry: JsonRecord, index: number) {
    const id = recordId(entry, String(index));

    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function copyReviewPlan(records: JsonRecord[], action: "approve" | "reject" | "payroll") {
    setReviewMessage(null);

    if (records.length === 0) {
      setReviewMessage(`Select at least one commission row before preparing a ${action} review plan.`);
      return;
    }

    const headings = ["Action", "Recipient", "Source", "Amount", "Status", "Payroll inclusion", "Reference", "Reason"];

    const rows = records.map((entry) => [
      action,
      textAt(entry, ["recipientName", "staffName", "employeeName", "name"], "Recipient"),
      textAt(entry, ["source", "sourceType", "eventType", "category"], "other"),
      String(amountAt(entry, ["amount", "amountCents", "commissionAmount", "balance"])),
      textAt(entry, ["status", "approvalStatus", "paymentStatus"], "pending"),
      textAt(entry, ["payrollInclusionStatus", "includedInPayroll", "payrollStatus"], "not_included"),
      textAt(entry, ["reference", "id", "eventId", "awardId"], ""),
      textAt(entry, ["description", "memo", "note", "reason"], ""),
    ]);

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (!navigator.clipboard) {
      setReviewMessage(`${action} review plan is ready, but clipboard access is unavailable in this browser.`);
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setReviewMessage(`Copied ${rows.length} commission row(s) for accountant ${action} review.`))
      .catch(() => setReviewMessage(`${action} review plan could not be copied to clipboard.`));
  }

  const accessLabel = state.accessEnvelope
    ? textAt(state.accessEnvelope, ["accessLevel", "role", "scope", "status"], "Enterprise finance access loaded")
    : "Access envelope pending";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="good">Enterprise Finance</StatusPill>
                <StatusPill>Commission command</StatusPill>
                <StatusPill tone={state.accessEnvelope ? "good" : "warn"}>{accessLabel}</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Commission Policies, Events and Awards
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Accountant-facing commission page for commission policies, commission events,
                commission awards, approval/rejection review, payroll inclusion planning and staff
                attribution across device sales, onboarding, subscriptions, client activation and manual sources.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link
                href="/admin/enterprise-finance"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to command centre
              </Link>
              <button
                type="button"
                onClick={() => copyReviewPlan(selectedCommission, "payroll")}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Prepare payroll inclusion
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading commission data from Enterprise Finance API…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Commission awards"
            value={String(summary.totalAwards)}
            helper="Commission event/award records returned by the backend."
            tone="good"
          />
          <MetricCard
            label="Commission payable"
            value={formatMoney(summary.totalPayable)}
            helper="Total commission payable exposure from overview or award rows."
            tone="warn"
          />
          <MetricCard
            label="Pending review"
            value={formatMoney(summary.pendingAmount)}
            helper="Commission awards/events awaiting accountant approval or rejection."
            tone="danger"
          />
          <MetricCard
            label="Selected for payroll"
            value={formatMoney(summary.selectedAmount)}
            helper="Selected commission rows being prepared for payroll inclusion."
          />
          <MetricCard
            label="Approved amount"
            value={formatMoney(summary.approvedAmount)}
            helper="Rows that look approved or accepted from available status fields."
            tone="good"
          />
          <MetricCard
            label="Payroll-ready amount"
            value={formatMoney(summary.payrollReadyAmount)}
            helper="Commission rows already marked as payroll-ready or included."
          />
          <MetricCard
            label="Rejected rows"
            value={String(summary.rejectedCount)}
            helper="Rows that look rejected or declined from available status fields."
            tone="danger"
          />
          <MetricCard
            label="Policy records"
            value={String(state.policies.length)}
            helper="Commission policy/rule records returned by the commission endpoint."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Commission filters</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Filter by recipient, source, status, payroll inclusion and date range.
                </p>
              </div>
              <StatusPill>{filteredCommission.length} visible row(s)</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-2">
                <FieldLabel>Search</FieldLabel>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Recipient, source, reference, client, note"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Status</FieldLabel>
                <select
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All statuses</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Source</FieldLabel>
                <select
                  value={filters.source}
                  onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All sources</option>
                  {filterOptions.sources.map((source) => (
                    <option key={source} value={source.toLowerCase()}>
                      {sourceLabel(source)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Recipient</FieldLabel>
                <select
                  value={filters.recipient}
                  onChange={(event) => setFilters((current) => ({ ...current, recipient: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All recipients</option>
                  {filterOptions.recipients.map((recipient) => (
                    <option key={recipient} value={recipient.toLowerCase()}>
                      {recipient}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Payroll inclusion</FieldLabel>
                <select
                  value={filters.payrollInclusion}
                  onChange={(event) => setFilters((current) => ({ ...current, payrollInclusion: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All inclusion states</option>
                  <option value="included">Included / queued</option>
                  <option value="not_included">Not included</option>
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Start date</FieldLabel>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>End date</FieldLabel>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilters(initialFilters)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => void loadCommissionData()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh commission data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Accountant approval controls</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Approval, rejection and payroll inclusion are prepared as accountant review plans in this slice.
              Actual mutation endpoints should be added later with audit logs and idempotency keys.
            </p>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => copyReviewPlan(selectedCommission, "approve")}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                Prepare approval review
              </button>
              <button
                type="button"
                onClick={() => copyReviewPlan(selectedCommission, "reject")}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                Prepare rejection review
              </button>
              <button
                type="button"
                onClick={() => copyReviewPlan(filteredCommission, "payroll")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Copy filtered payroll plan
              </button>
            </div>

            {reviewMessage ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {reviewMessage}
              </div>
            ) : null}
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Source attribution summary</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Commission attribution across device sale, onboarding, subscription, client activation and manual sources.
              </p>
            </div>
            <StatusPill>{selectedCommission.length} selected row(s)</StatusPill>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {sourceBreakdown.map((source) => (
              <div key={source.value} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{source.label}</div>
                <div className="mt-2 text-xl font-bold text-slate-950">{formatMoney(source.amount)}</div>
                <p className="mt-1 text-xs text-slate-500">{source.count} visible row(s)</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Commission events and awards</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Commission rows with recipient attribution, source, amount, approval status and payroll inclusion visibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill>{state.commission.length} total row(s)</StatusPill>
              <StatusPill>{state.payrollProfiles.length} payroll profile(s)</StatusPill>
            </div>
          </div>

          <div className="grid gap-3">
            <ErrorNote message={errors.overview} />

            {filteredCommission.length === 0 ? (
              <EmptyState message="No commission events or awards match the current filters." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Select",
                          "Date",
                          "Recipient",
                          "Source",
                          "Amount",
                          "Status",
                          "Payroll inclusion",
                          "Reference",
                          "Action",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredCommission.map((entry, index) => {
                        const id = recordId(entry, String(index));
                        const selected = selectedIds.has(id);
                        const status = textAt(entry, ["status", "approvalStatus", "paymentStatus"], "pending");
                        const source = textAt(entry, ["source", "sourceType", "eventType", "category"], "other");
                        const payrollStatus = textAt(entry, ["payrollInclusionStatus", "includedInPayroll", "payrollStatus"], "not_included");

                        return (
                          <tr key={`${id}-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelected(entry, index)}
                                className="h-4 w-4 rounded border-slate-300"
                                aria-label={`Select commission row ${id}`}
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(entry, ["createdAt", "awardedAt", "eventDate", "approvedAt", "updatedAt", "payableAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <div className="font-semibold text-slate-900">
                                {textAt(entry, ["recipientName", "staffName", "employeeName", "name"], "Recipient")}
                              </div>
                              <div className="text-xs text-slate-500">
                                {textAt(entry, ["recipientEmail", "staffEmail", "email"], "—")}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {sourceLabel(source)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(amountAt(entry, ["amount", "amountCents", "commissionAmount", "balance"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <StatusPill
                                tone={
                                  status.toLowerCase().includes("approved")
                                    ? "good"
                                    : status.toLowerCase().includes("reject")
                                      ? "danger"
                                      : "warn"
                                }
                              >
                                {status}
                              </StatusPill>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {payrollStatus}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(entry, ["reference", "id", "eventId", "awardId"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <button
                                type="button"
                                onClick={() => setActiveReviewRecord(entry)}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {activeReviewRecord ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Commission review card</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Accountant review snapshot before approval, rejection or payroll inclusion is persisted by future write endpoints.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyReviewPlan([activeReviewRecord], "approve")}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Copy approval
                </button>
                <button
                  type="button"
                  onClick={() => copyReviewPlan([activeReviewRecord], "reject")}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  Copy rejection
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Recipient"
                value={textAt(activeReviewRecord, ["recipientName", "staffName", "employeeName", "name"], "Recipient")}
                helper="Commission recipient for attribution review."
              />
              <MetricCard
                label="Source"
                value={sourceLabel(textAt(activeReviewRecord, ["source", "sourceType", "eventType", "category"], "other"))}
                helper="Attribution source for the commission event."
              />
              <MetricCard
                label="Amount"
                value={formatMoney(amountAt(activeReviewRecord, ["amount", "amountCents", "commissionAmount", "balance"]))}
                helper="Commission amount prepared for accountant review."
                tone="warn"
              />
              <MetricCard
                label="Status"
                value={textAt(activeReviewRecord, ["status", "approvalStatus", "paymentStatus"], "pending")}
                helper="Backend-provided approval/payment status."
              />
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Commission policies</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Policy/rule records returned by the commission endpoint. Policy editing should remain an accountant/admin controlled future slice.
            </p>

            <div className="mt-4">
              {state.policies.length === 0 ? (
                <EmptyState message="No commission policy records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Policy", "Source", "Rate", "Status"].map((heading) => (
                            <th
                              key={heading}
                              className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.policies.slice(0, 8).map((policy, index) => (
                          <tr key={`${recordId(policy, String(index))}-policy-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(policy, ["name", "policyName", "title"], "Commission policy")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {sourceLabel(textAt(policy, ["source", "sourceType", "category"], "other"))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(policy, ["rate", "percentage", "fixedAmount"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(policy, ["status", "policyStatus"], "active")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Control boundaries</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Approval / rejection</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This page prepares accountant review decisions. Future PATCH endpoints should persist approvals/rejections with audit logs.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Payroll inclusion</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Approved commission awards should later flow into payroll batches, not directly into ordinary staff or shareholder controls.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Attribution source</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Supported attribution sources include device sale, onboarding, subscription, client activation and other manual sources.
                </p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
