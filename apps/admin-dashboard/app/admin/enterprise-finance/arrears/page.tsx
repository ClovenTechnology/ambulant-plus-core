"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type LoadState = {
  accessEnvelope: JsonRecord | null;
  overview: JsonRecord | null;
  payrollProfiles: JsonRecord[];
  arrears: JsonRecord[];
};

type LoadErrors = Partial<Record<keyof LoadState, string>>;

type ArrearsFilters = {
  search: string;
  staffUserId: string;
  status: string;
  disputeStatus: string;
  period: string;
  startDate: string;
  endDate: string;
};

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  payrollProfiles: [],
  arrears: [],
};

const initialFilters: ArrearsFilters = {
  search: "",
  staffUserId: "all",
  status: "all",
  disputeStatus: "all",
  period: "all",
  startDate: "",
  endDate: "",
};

type PaymentForm = {
  amount: string;
  paymentMethod: string;
  paymentReference: string;
  description: string;
};

const initialPaymentForm: PaymentForm = {
  amount: "",
  paymentMethod: "bank_transfer",
  paymentReference: "",
  description: "Arrears payment recorded",
};

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

  for (const key of ["items", "rows", "data", "results", "records", "profiles", "staff", "arrears", "payments", "history"]) {
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
  const value = valueAt(record, ["createdAt", "dueDate", "scheduledPaymentDate", "paidAt", "updatedAt", "payableAt"]);

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
  return textAt(record, ["id", "arrearsId", "staffId", "employeeId", "payrollRunId"], fallback);
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

export default function EnterpriseFinanceArrearsPage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ArrearsFilters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePaymentRecord, setActivePaymentRecord] = useState<JsonRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(initialPaymentForm);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  const loadArrearsData = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const requests = {
      accessEnvelope: fetchJson("/api/enterprise-finance/access-envelope"),
      overview: fetchJson("/api/enterprise-finance/overview"),
      payrollProfiles: fetchJson("/api/enterprise-finance/staff-payroll/profiles"),
      arrears: fetchJson("/api/enterprise-finance/staff-payroll/arrears"),
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
        } else if (typedKey === "payrollProfiles") {
          nextState[typedKey] = arrayFrom(payload, ["profiles", "staff", "items", "rows"]) as never;
        } else if (typedKey === "arrears") {
          nextState[typedKey] = arrayFrom(payload, ["arrears", "items", "rows"]) as never;
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
    void loadArrearsData();
  }, [loadArrearsData]);

  const filterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const disputeStatuses = new Set<string>();
    const periods = new Set<string>();

    state.arrears.forEach((entry) => {
      statuses.add(textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending"));
      disputeStatuses.add(textAt(entry, ["disputeStatus", "dispute", "queryStatus"], "none"));
      periods.add(textAt(entry, ["period", "payPeriod", "month"], "unspecified"));
    });

    return {
      statuses: Array.from(statuses).filter(Boolean).sort(),
      disputeStatuses: Array.from(disputeStatuses).filter(Boolean).sort(),
      periods: Array.from(periods).filter(Boolean).sort(),
    };
  }, [state.arrears]);

  const staffOptions = useMemo(
    () =>
      state.payrollProfiles
        .map((profile) => ({
          staffUserId: textAt(profile, ["staffUserId", "userId"], ""),
          label: textAt(profile, ["staffName", "staffDisplayName", "name"], "Staff member"),
          email: textAt(profile, ["staffEmail", "email"], ""),
          staffIdentifier: textAt(profile, ["staffIdentifier"], ""),
          payrollNumber: textAt(profile, ["payrollNumber"], ""),
        }))
        .filter((option) => option.staffUserId)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [state.payrollProfiles],
  );

  const filteredArrears = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return state.arrears.filter((entry) => {
      const status = textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending").toLowerCase();
      const disputeStatus = textAt(entry, ["disputeStatus", "dispute", "queryStatus"], "none").toLowerCase();
      const period = textAt(entry, ["period", "payPeriod", "month"], "unspecified").toLowerCase();
      const date = toDateValue(entry);

      const entryStaffUserId = textAt(entry, ["staffUserId", "userId"], "");

      if (filters.staffUserId !== "all" && entryStaffUserId !== filters.staffUserId) {
        return false;
      }

      if (filters.status !== "all" && status !== filters.status.toLowerCase()) {
        return false;
      }

      if (filters.disputeStatus !== "all" && disputeStatus !== filters.disputeStatus.toLowerCase()) {
        return false;
      }

      if (filters.period !== "all" && period !== filters.period.toLowerCase()) {
        return false;
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
        textAt(entry, ["staffName", "employeeName", "name", "userName"], ""),
        textAt(entry, ["staffEmail", "email", "employeeEmail"], ""),
        textAt(entry, ["staffIdentifier"], ""),
        textAt(entry, ["staffProfileId"], ""),
        textAt(entry, ["staffUserId", "userId"], ""),
        textAt(entry, ["payrollNumber", "employerReference"], ""),
        textAt(entry, ["reference", "id", "payrollRunId", "sourceId"], ""),
        textAt(entry, ["paymentReference"], ""),
        textAt(entry, ["notes", "description", "memo"], ""),
        status,
        disputeStatus,
        period,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [filters, state.arrears]);

  const selectedArrears = useMemo(() => {
    return filteredArrears.filter((entry, index) => selectedIds.has(recordId(entry, String(index))));
  }, [filteredArrears, selectedIds]);

  const paymentHistoryRows = useMemo(() => {
    return state.arrears.filter((entry) => {
      const status = textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "").toLowerCase();
      return status.includes("paid") || status.includes("settled") || Boolean(valueAt(entry, ["paidAt", "settledAt", "paymentReference"]));
    });
  }, [state.arrears]);

  const summary = useMemo(() => {
    const unpaidRecords = state.arrears.filter((entry) => {
      const status = textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending").toLowerCase();
      return !["paid", "settled", "closed"].includes(status);
    });

    const unpaidBalance =
      amountAt(state.overview, ["salaryArrears", "staffArrears", "arrearsPayable", "salaryArrearsCents"]) ||
      sumAmounts(unpaidRecords, ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"]);

    const filteredBalance = sumAmounts(filteredArrears, ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"]);
    const selectedBalance = sumAmounts(selectedArrears, ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"]);

    const disputedBalance = sumAmounts(
      state.arrears.filter((entry) => {
        const dispute = textAt(entry, ["disputeStatus", "dispute", "queryStatus", "status"], "").toLowerCase();
        return dispute.includes("dispute") || dispute.includes("query");
      }),
      ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"],
    );

    return {
      totalRecords: state.arrears.length,
      unpaidBalance,
      filteredBalance,
      selectedBalance,
      disputedBalance,
      paymentHistoryCount: paymentHistoryRows.length,
    };
  }, [filteredArrears, paymentHistoryRows.length, selectedArrears, state.arrears, state.overview]);

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

  function copyPaymentPlan(records: JsonRecord[], label: string) {
    setPlanMessage(null);

    const headings = ["Staff", "Period", "Outstanding", "Status", "Dispute", "Due date", "Reference"];

    const rows = records.map((entry) => [
      textAt(entry, ["staffName", "employeeName", "name", "userName"], "Staff member"),
      textAt(entry, ["period", "payPeriod", "month"], "—"),
      String(amountAt(entry, ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"])),
      textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending"),
      textAt(entry, ["disputeStatus", "dispute", "queryStatus"], "—"),
      formatDate(valueAt(entry, ["dueDate", "scheduledPaymentDate", "payableAt"])),
      textAt(entry, ["reference", "id", "payrollRunId"], ""),
    ]);

    if (rows.length === 0) {
      setPlanMessage(`No ${label} arrears rows are available for payment planning.`);
      return;
    }

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (!navigator.clipboard) {
      setPlanMessage(`${label} payment plan is ready, but clipboard access is unavailable in this browser.`);
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setPlanMessage(`Copied ${rows.length} ${label} arrears row(s) for accountant payment review.`))
      .catch(() => setPlanMessage(`${label} payment plan could not be copied to clipboard.`));
  }

  useEffect(() => {
    if (!activePaymentRecord) {
      setPaymentForm(initialPaymentForm);
      setPaymentMessage(null);
      return;
    }

    setPaymentForm({
      amount: String(
        amountAt(activePaymentRecord, [
          "outstandingAmount",
          "outstandingAmountCents",
          "balanceAfterCents",
          "balance",
          "amount",
          "amountCents",
        ]) || "",
      ),
      paymentMethod: "bank_transfer",
      paymentReference: "",
      description: "Arrears payment recorded",
    });
    setPaymentMessage(null);
  }, [activePaymentRecord]);

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePaymentRecord) return;

    const amount = Number(paymentForm.amount);
    const outstanding = amountAt(activePaymentRecord, [
      "outstandingAmount",
      "outstandingAmountCents",
      "balanceAfterCents",
      "balance",
      "amount",
      "amountCents",
    ]);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage("Enter a positive payment amount.");
      return;
    }

    if (outstanding > 0 && amount > outstanding + 0.001) {
      setPaymentMessage("Payment cannot exceed the current outstanding balance.");
      return;
    }

    if (!paymentForm.paymentReference.trim()) {
      setPaymentMessage("A payment reference is required for reconciliation.");
      return;
    }

    const staffUserId = textAt(activePaymentRecord, ["staffUserId", "userId"], "");
    if (!staffUserId) {
      setPaymentMessage("The selected arrears row does not resolve to a canonical Staff user.");
      return;
    }

    setPaymentBusy(true);
    setPaymentMessage(null);

    try {
      const response = await fetch(
        apiPath("/api/enterprise-finance/staff-payroll/arrears"),
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "record_payment",
            staffUserId,
            amountCents: Math.round(amount * 100),
            currency: textAt(activePaymentRecord, ["currency"], "ZAR"),
            paymentMethod: paymentForm.paymentMethod,
            paymentReference: paymentForm.paymentReference.trim(),
            description: paymentForm.description.trim() || "Arrears payment recorded",
            arrearsLedgerEntryId: textAt(activePaymentRecord, ["id"], "") || null,
            payslipId: textAt(activePaymentRecord, ["payslipId"], "") || null,
            payrollProfileId: textAt(activePaymentRecord, ["payrollProfileId"], "") || null,
            payrollPeriodId: textAt(activePaymentRecord, ["payrollPeriodId"], "") || null,
            salaryAccrualId: textAt(activePaymentRecord, ["salaryAccrualId"], "") || null,
            balanceAfterCents: Math.max(0, Math.round((outstanding - amount) * 100)),
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `${response.status} ${response.statusText}`);
      }

      setPlanMessage("Arrears payment recorded and reconciled.");
      setActivePaymentRecord(null);
      setSelectedIds(new Set());
      await loadArrearsData();
    } catch (error) {
      setPaymentMessage(
        `Payment could not be recorded: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setPaymentBusy(false);
    }
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
                <StatusPill>Salary arrears ledger</StatusPill>
                <StatusPill tone={state.accessEnvelope ? "good" : "warn"}>{accessLabel}</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Salary Arrears Ledger
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Accountant/admin arrears page for unpaid salary balance, individual payment planning,
                bulk payment planning, payment history and dispute visibility. This does not expose
                ordinary staff or shareholder users to finance mutation controls.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link
                href="/admin/enterprise-finance/payroll"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to payroll
              </Link>
              <button
                type="button"
                onClick={() => copyPaymentPlan(selectedArrears, "selected")}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Copy selected payment plan
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading salary arrears data from Enterprise Finance API…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Arrears records"
            value={String(summary.totalRecords)}
            helper="Total arrears records returned by the backend."
            tone="good"
          />
          <MetricCard
            label="Unpaid salary balance"
            value={formatMoney(summary.unpaidBalance)}
            helper="Current outstanding staff salary arrears liability."
            tone="danger"
          />
          <MetricCard
            label="Filtered balance"
            value={formatMoney(summary.filteredBalance)}
            helper="Arrears balance currently visible after filters."
            tone="warn"
          />
          <MetricCard
            label="Selected for payment"
            value={formatMoney(summary.selectedBalance)}
            helper="Selected payment-planning exposure for accountant review."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Arrears filters</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Filter by staff, period, status, dispute state and date range.
                </p>
              </div>
              <StatusPill>{filteredArrears.length} visible row(s)</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-2">
                <FieldLabel>Search</FieldLabel>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Name, email, Staff ID, payroll no., reference"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Staff</FieldLabel>
                <select
                  value={filters.staffUserId}
                  onChange={(event) => setFilters((current) => ({ ...current, staffUserId: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All Staff</option>
                  {staffOptions.map((option) => (
                    <option key={option.staffUserId} value={option.staffUserId}>
                      {option.label}
                      {option.staffIdentifier ? ` · ${option.staffIdentifier}` : ""}
                      {option.payrollNumber ? ` · payroll ${option.payrollNumber}` : ""}
                    </option>
                  ))}
                </select>
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
                <FieldLabel>Dispute status</FieldLabel>
                <select
                  value={filters.disputeStatus}
                  onChange={(event) => setFilters((current) => ({ ...current, disputeStatus: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All dispute states</option>
                  {filterOptions.disputeStatuses.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Period</FieldLabel>
                <select
                  value={filters.period}
                  onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All periods</option>
                  {filterOptions.periods.map((period) => (
                    <option key={period} value={period.toLowerCase()}>
                      {period}
                    </option>
                  ))}
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
                onClick={() => void loadArrearsData()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh arrears data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Payment and dispute summary</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Disputed arrears exposure</div>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatMoney(summary.disputedBalance)}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Arrears records marked as disputed, queried or similar by available backend fields.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment history rows</div>
                <p className="mt-2 text-2xl font-bold text-slate-950">{summary.paymentHistoryCount}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Rows that look paid, settled or have payment references.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Control note</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Arrears settlement remains accountant/admin controlled. Completed external payments can be recorded and reconciled here; Staff-facing dispute submission and automated transfer release remain separately governed.
                </p>
              </div>
            </div>
          </section>
        </section>

        {planMessage ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {planMessage}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Salary arrears ledger</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Individual arrears rows with payment planning, dispute visibility and payment-history fields.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyPaymentPlan(filteredArrears, "filtered")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Copy filtered plan
              </button>
              <StatusPill>{selectedArrears.length} selected</StatusPill>
            </div>
          </div>

          <div className="grid gap-3">
            <ErrorNote message={errors.overview} />

            {filteredArrears.length === 0 ? (
              <EmptyState message="No salary arrears records match the current filters." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Select",
                          "Staff",
                          "Period",
                          "Outstanding",
                          "Paid",
                          "Status",
                          "Dispute",
                          "Due date",
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
                      {filteredArrears.map((entry, index) => {
                        const id = recordId(entry, String(index));
                        const selected = selectedIds.has(id);
                        const status = textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending");
                        const dispute = textAt(entry, ["disputeStatus", "dispute", "queryStatus"], "—");
                        const outstanding = amountAt(entry, [
                          "outstandingAmount",
                          "outstandingAmountCents",
                          "balanceAfterCents",
                          "balance",
                          "amount",
                          "amountCents",
                        ]);
                        const canRecordPayment =
                          outstanding > 0 &&
                          !["paid", "settled", "closed", "voided", "cancelled"].some((value) =>
                            status.toLowerCase().includes(value),
                          ) &&
                          textAt(entry, ["entryType"], "").toLowerCase() !== "payment";

                        return (
                          <tr key={`${id}-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelected(entry, index)}
                                className="h-4 w-4 rounded border-slate-300"
                                aria-label={`Select arrears row ${id}`}
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <div className="font-semibold text-slate-900">
                                {textAt(entry, ["staffName", "employeeName", "name", "userName"], "Staff member")}
                              </div>
                              <div className="text-xs text-slate-500">
                                {textAt(entry, ["staffEmail", "email", "employeeEmail"], "—")}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-400">
                                {textAt(entry, ["staffIdentifier", "staffProfileId"], "—")}
                                {" · "}
                                Payroll {textAt(entry, ["payrollNumber"], "—")}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(entry, ["period", "payPeriod", "month"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(amountAt(entry, ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatMoney(amountAt(entry, ["paidAmount", "settledAmount", "paidAmountCents"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <StatusPill tone={status.toLowerCase().includes("paid") ? "good" : "warn"}>{status}</StatusPill>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <StatusPill tone={dispute.toLowerCase().includes("dispute") || dispute.toLowerCase().includes("query") ? "danger" : "neutral"}>
                                {dispute}
                              </StatusPill>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(entry, ["dueDate", "scheduledPaymentDate", "payableAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(entry, ["reference", "id", "payrollRunId"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {canRecordPayment ? (
                                <button
                                  type="button"
                                  onClick={() => setActivePaymentRecord(entry)}
                                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Record payment
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
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

        {activePaymentRecord ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Individual arrears payment plan</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Review one salary arrears item, then record a completed payment against the governed payroll and arrears authority.
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyPaymentPlan([activePaymentRecord], "individual")}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Copy individual plan
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Staff"
                value={textAt(activePaymentRecord, ["staffName", "employeeName", "name", "userName"], "Staff member")}
                helper="Selected staff arrears record."
              />
              <MetricCard
                label="Outstanding"
                value={formatMoney(amountAt(activePaymentRecord, ["outstandingAmount", "outstandingAmountCents", "balanceAfterCents", "balance", "amount", "amountCents"]))}
                helper="Amount currently planned for review."
                tone="warn"
              />
              <MetricCard
                label="Period"
                value={textAt(activePaymentRecord, ["period", "payPeriod", "month"], "—")}
                helper="Payroll period linked to the arrears item."
              />
              <MetricCard
                label="Payment status"
                value={textAt(activePaymentRecord, ["status", "paymentStatus", "arrearsStatus"], "pending")}
                helper="Backend-provided status."
              />
            </div>

            <form
              onSubmit={recordPayment}
              className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-4"
            >
              <label className="grid gap-2">
                <FieldLabel>Amount (ZAR)</FieldLabel>
                <input
                  inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Payment method</FieldLabel>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="paystack">Paystack</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Payment reference</FieldLabel>
                <input
                  value={paymentForm.paymentReference}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      paymentReference: event.target.value,
                    }))
                  }
                  placeholder="Bank / transfer reference"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Description</FieldLabel>
                <input
                  value={paymentForm.description}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="lg:col-span-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs leading-5 text-slate-500">
                  This records a payment that has already completed. It does not initiate a bank or Paystack transfer.
                </div>
                <button
                  type="submit"
                  disabled={paymentBusy}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {paymentBusy ? "Recording…" : "Record completed payment"}
                </button>
              </div>

              {paymentMessage ? (
                <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  {paymentMessage}
                </div>
              ) : null}
            </form>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Payment history</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Arrears records that appear paid, settled or reconciled from available backend fields.
              </p>
            </div>
            <StatusPill>{paymentHistoryRows.length} history row(s)</StatusPill>
          </div>

          {paymentHistoryRows.length === 0 ? (
            <EmptyState message="No arrears payment history rows returned yet." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Staff", "Period", "Paid amount", "Paid date", "Reference", "Status"].map((heading) => (
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
                    {paymentHistoryRows.slice(0, 10).map((entry, index) => (
                      <tr key={`${recordId(entry, String(index))}-history-${index}`}>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(entry, ["staffName", "employeeName", "name", "userName"], "Staff member")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(entry, ["period", "payPeriod", "month"], "—")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {formatMoney(amountAt(entry, ["paidAmount", "settledAmount", "paidAmountCents", "amount", "amountCents"]))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(valueAt(entry, ["paidAt", "settledAt", "updatedAt"]))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(entry, ["paymentReference", "reference", "id"], "—")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "paid")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}