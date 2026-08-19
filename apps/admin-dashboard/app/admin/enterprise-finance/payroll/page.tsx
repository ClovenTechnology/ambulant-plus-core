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

type ProfileFilters = {
  search: string;
  status: string;
  payCycle: string;
  bankStatus: string;
};

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  payrollProfiles: [],
  arrears: [],
};

const initialFilters: ProfileFilters = {
  search: "",
  status: "all",
  payCycle: "all",
  bankStatus: "all",
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

  for (const key of ["items", "rows", "data", "results", "records", "profiles", "staff", "arrears"]) {
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

function recordId(record: JsonRecord, fallback: string) {
  return textAt(record, ["id", "staffId", "userId", "employeeId", "profileId"], fallback);
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

export default function EnterpriseFinancePayrollPage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProfileFilters>(initialFilters);
  const [selectedArrearsIds, setSelectedArrearsIds] = useState<Set<string>>(new Set());
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  const loadPayrollData = useCallback(async () => {
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
    void loadPayrollData();
  }, [loadPayrollData]);

  const profileOptions = useMemo(() => {
    const statuses = new Set<string>();
    const payCycles = new Set<string>();
    const bankStatuses = new Set<string>();

    state.payrollProfiles.forEach((profile) => {
      statuses.add(textAt(profile, ["status", "employmentStatus", "payrollStatus"], "active"));
      payCycles.add(textAt(profile, ["payCycle", "payFrequency", "frequency"], "monthly"));
      bankStatuses.add(textAt(profile, ["bankStatus", "bankVerificationStatus", "payoutStatus"], "pending"));
    });

    return {
      statuses: Array.from(statuses).filter(Boolean).sort(),
      payCycles: Array.from(payCycles).filter(Boolean).sort(),
      bankStatuses: Array.from(bankStatuses).filter(Boolean).sort(),
    };
  }, [state.payrollProfiles]);

  const filteredProfiles = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return state.payrollProfiles.filter((profile) => {
      const status = textAt(profile, ["status", "employmentStatus", "payrollStatus"], "active").toLowerCase();
      const payCycle = textAt(profile, ["payCycle", "payFrequency", "frequency"], "monthly").toLowerCase();
      const bankStatus = textAt(profile, ["bankStatus", "bankVerificationStatus", "payoutStatus"], "pending").toLowerCase();

      if (filters.status !== "all" && status !== filters.status.toLowerCase()) {
        return false;
      }

      if (filters.payCycle !== "all" && payCycle !== filters.payCycle.toLowerCase()) {
        return false;
      }

      if (filters.bankStatus !== "all" && bankStatus !== filters.bankStatus.toLowerCase()) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        textAt(profile, ["staffName", "employeeName", "name", "userName"], ""),
        textAt(profile, ["email", "staffEmail", "employeeEmail"], ""),
        textAt(profile, ["role", "jobTitle", "designation"], ""),
        status,
        payCycle,
        bankStatus,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [filters, state.payrollProfiles]);

  const arrearsByStaff = useMemo(() => {
    const totals = new Map<string, number>();

    state.arrears.forEach((entry) => {
      const staffKey = textAt(entry, ["staffId", "userId", "employeeId", "profileId", "staffName", "employeeName", "name"], "unknown");
      totals.set(staffKey, (totals.get(staffKey) || 0) + amountAt(entry, ["outstandingAmount", "balance", "amount", "amountCents"]));
    });

    return totals;
  }, [state.arrears]);

  const unpaidArrears = useMemo(() => {
    return state.arrears.filter((entry) => {
      const status = textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending").toLowerCase();
      return !["paid", "settled", "closed"].includes(status);
    });
  }, [state.arrears]);

  const selectedArrears = useMemo(() => {
    return unpaidArrears.filter((entry, index) => selectedArrearsIds.has(recordId(entry, String(index))));
  }, [selectedArrearsIds, unpaidArrears]);

  const summary = useMemo(() => {
    const payrollLiability =
      amountAt(state.overview, ["payrollLiability", "staffPayrollLiability", "payrollPayable", "payrollLiabilityCents"]) ||
      sumAmounts(state.payrollProfiles, ["monthlySalary", "salary", "grossSalary", "baseSalary", "amount", "amountCents"]);

    const unpaidSalaryBalance =
      amountAt(state.overview, ["salaryArrears", "staffArrears", "arrearsPayable", "salaryArrearsCents"]) ||
      sumAmounts(unpaidArrears, ["outstandingAmount", "balance", "amount", "amountCents"]);

    const selectedPaymentPlan = sumAmounts(selectedArrears, ["outstandingAmount", "balance", "amount", "amountCents"]);

    const disputedCount = state.arrears.filter((entry) => {
      const status = textAt(entry, ["disputeStatus", "status", "arrearsStatus"], "").toLowerCase();
      return status.includes("dispute") || status.includes("query");
    }).length;

    return {
      payrollLiability,
      unpaidSalaryBalance,
      selectedPaymentPlan,
      activeStaff: state.payrollProfiles.length,
      unpaidArrearsCount: unpaidArrears.length,
      disputedCount,
    };
  }, [selectedArrears, state.arrears, state.overview, state.payrollProfiles, unpaidArrears]);

  function toggleArrears(entry: JsonRecord, index: number) {
    const id = recordId(entry, String(index));

    setSelectedArrearsIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function copyBulkPaymentPlan() {
    setPlanMessage(null);

    const headings = ["Staff", "Period", "Outstanding", "Status", "Reference"];

    const rows = selectedArrears.map((entry) => [
      textAt(entry, ["staffName", "employeeName", "name", "userName"], "Staff member"),
      textAt(entry, ["period", "payPeriod", "month"], "—"),
      String(amountAt(entry, ["outstandingAmount", "balance", "amount", "amountCents"])),
      textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending"),
      textAt(entry, ["reference", "id", "payrollRunId"], ""),
    ]);

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (rows.length === 0) {
      setPlanMessage("Select one or more unpaid arrears rows before copying a bulk payment plan.");
      return;
    }

    if (!navigator.clipboard) {
      setPlanMessage("Bulk payment plan is ready, but clipboard access is unavailable in this browser.");
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setPlanMessage(`Copied ${rows.length} arrears payment row(s) for accountant review.`))
      .catch(() => setPlanMessage("Bulk payment plan could not be copied to clipboard."));
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
                <StatusPill>Payroll command</StatusPill>
                <StatusPill tone={state.accessEnvelope ? "good" : "warn"}>{accessLabel}</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Staff Payroll and Arrears
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Accountant-facing payroll page for staff payroll profiles, salary liability,
                unpaid arrears, bulk payment planning and dispute visibility. Staff self-service
                remains a later separate surface for payslips, bank details and disputes.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link
                href="/admin/enterprise-finance"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to command centre
              </Link>
              <Link
                href="/admin/enterprise-finance/arrears"
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Open arrears ledger
              </Link>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading payroll data from Enterprise Finance API…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active payroll profiles"
            value={String(summary.activeStaff)}
            helper="Staff payroll profiles returned by the Enterprise Finance API."
            tone="good"
          />
          <MetricCard
            label="Payroll liability"
            value={formatMoney(summary.payrollLiability)}
            helper="Current recognised staff payroll exposure."
            tone="warn"
          />
          <MetricCard
            label="Unpaid salary arrears"
            value={formatMoney(summary.unpaidSalaryBalance)}
            helper={`${summary.unpaidArrearsCount} unpaid arrears record(s) requiring review.`}
            tone="danger"
          />
          <MetricCard
            label="Selected payment plan"
            value={formatMoney(summary.selectedPaymentPlan)}
            helper="Bulk arrears payment planning total selected by accountant/admin."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Payroll profile filters</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Filter staff by role, payroll status, pay cycle or bank-account readiness.
                </p>
              </div>
              <StatusPill>{filteredProfiles.length} visible profile(s)</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <FieldLabel>Search</FieldLabel>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Name, email, role or status"
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
                  {profileOptions.statuses.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Pay cycle</FieldLabel>
                <select
                  value={filters.payCycle}
                  onChange={(event) => setFilters((current) => ({ ...current, payCycle: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All pay cycles</option>
                  {profileOptions.payCycles.map((cycle) => (
                    <option key={cycle} value={cycle.toLowerCase()}>
                      {cycle}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Bank status</FieldLabel>
                <select
                  value={filters.bankStatus}
                  onChange={(event) => setFilters((current) => ({ ...current, bankStatus: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All bank statuses</option>
                  {profileOptions.bankStatuses.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {status}
                    </option>
                  ))}
                </select>
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
                onClick={() => void loadPayrollData()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh payroll data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Accountant-only controls</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              This slice is read/write-ready at the UI level but only submits to existing backend-backed endpoints.
              Direct salary settlement, Paystack transfer release, payslip generation and staff self-service controls remain future slices.
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Bulk payment planning</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Select unpaid arrears records below, then copy an accountant-reviewed payment plan for finance release.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Staff self-service later</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Staff payslips, arrears view, bank details and dispute submission should be added as a separate staff-facing workflow.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Dispute visibility</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {summary.disputedCount} arrears record(s) currently look disputed or queried from available backend fields.
                </p>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Staff payroll profiles</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Staff salary, pay-cycle, bank-readiness and arrears exposure snapshot.
              </p>
            </div>
            <StatusPill>{state.payrollProfiles.length} total profile(s)</StatusPill>
          </div>

          <div className="grid gap-3">
            <ErrorNote message={errors.overview} />

            {filteredProfiles.length === 0 ? (
              <EmptyState message="No staff payroll profiles match the current filters." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Staff", "Role", "Pay cycle", "Salary", "Bank status", "Payroll status", "Arrears exposure"].map((heading) => (
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
                      {filteredProfiles.map((profile, index) => {
                        const staffKey = textAt(profile, ["staffId", "userId", "employeeId", "profileId", "staffName", "employeeName", "name"], String(index));
                        const salary = amountAt(profile, ["monthlySalary", "salary", "grossSalary", "baseSalary", "amount", "amountCents"]);
                        const bankStatus = textAt(profile, ["bankStatus", "bankVerificationStatus", "payoutStatus"], "pending");
                        const payrollStatus = textAt(profile, ["status", "employmentStatus", "payrollStatus"], "active");
                        const arrearsExposure = arrearsByStaff.get(staffKey) || 0;

                        return (
                          <tr key={`${staffKey}-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <div className="font-semibold text-slate-900">
                                {textAt(profile, ["staffName", "employeeName", "name", "userName"], "Staff member")}
                              </div>
                              <div className="text-xs text-slate-500">
                                {textAt(profile, ["email", "staffEmail", "employeeEmail"], "—")}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(profile, ["role", "jobTitle", "designation"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(profile, ["payCycle", "payFrequency", "frequency"], "monthly")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(salary)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <StatusPill tone={bankStatus.toLowerCase().includes("verified") ? "good" : "warn"}>{bankStatus}</StatusPill>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {payrollStatus}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(arrearsExposure)}
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Bulk arrears payment planning</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Select unpaid salary arrears rows for accountant review before any real transfer workflow is introduced.
              </p>
            </div>
            <button
              type="button"
              onClick={copyBulkPaymentPlan}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Copy bulk payment plan
            </button>
          </div>

          {planMessage ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {planMessage}
            </div>
          ) : null}

          {unpaidArrears.length === 0 ? (
            <EmptyState message="No unpaid salary arrears returned yet." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Select", "Staff", "Period", "Outstanding", "Status", "Dispute", "Due date"].map((heading) => (
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
                    {unpaidArrears.slice(0, 12).map((entry, index) => {
                      const id = recordId(entry, String(index));
                      const selected = selectedArrearsIds.has(id);

                      return (
                        <tr key={`${id}-${index}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleArrears(entry, index)}
                              className="h-4 w-4 rounded border-slate-300"
                              aria-label={`Select arrears row ${id}`}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(entry, ["staffName", "employeeName", "name", "userName"], "Staff member")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(entry, ["period", "payPeriod", "month"], "—")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatMoney(amountAt(entry, ["outstandingAmount", "balance", "amount", "amountCents"]))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(entry, ["status", "paymentStatus", "arrearsStatus"], "pending")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(entry, ["disputeStatus", "dispute", "queryStatus"], "—")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {formatDate(valueAt(entry, ["dueDate", "scheduledPaymentDate", "payableAt"]))}
                          </td>
                        </tr>
                      );
                    })}
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
