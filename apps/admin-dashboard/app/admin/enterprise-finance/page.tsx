"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type LoadState = {
  accessEnvelope: JsonRecord | null;
  overview: JsonRecord | null;
  revenueEntries: JsonRecord[];
  manualInflows: JsonRecord[];
  payrollProfiles: JsonRecord[];
  arrears: JsonRecord[];
  commission: JsonRecord[];
  capTable: JsonRecord[];
  shareholders: JsonRecord[];
  shareholderAccess: JsonRecord[];
};

type LoadErrors = Partial<Record<keyof LoadState, string>>;

type ManualInflowForm = {
  category: string;
  amount: string;
  counterparty: string;
  reference: string;
  description: string;
};

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  revenueEntries: [],
  manualInflows: [],
  payrollProfiles: [],
  arrears: [],
  commission: [],
  capTable: [],
  shareholders: [],
  shareholderAccess: [],
};

const initialManualInflowForm: ManualInflowForm = {
  category: "manual_revenue",
  amount: "",
  counterparty: "",
  reference: "",
  description: "",
};

function apiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapRecord(value: unknown): JsonRecord {
  if (isRecord(value)) {
    return value;
  }

  return {};
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

  for (const key of ["items", "rows", "data", "entries", "results", "records", "ledger", "profiles", "grants", "shareholders", "classes"]) {
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

function numberAt(record: JsonRecord | null | undefined, keys: string[]) {
  const value = valueAt(record, keys);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalised = value.replace(/,/g, "");
    const parsed = Number(normalised);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function sumBy(records: JsonRecord[], keys: string[]) {
  return records.reduce((total, record) => total + numberAt(record, keys), 0);
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

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
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
  tone?: "neutral" | "good" | "warn";
}) {
  const borderClass =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
        ? "border-amber-200"
        : "border-slate-200";

  return (
    <div className={`rounded-2xl border ${borderClass} bg-white p-5 shadow-sm`}>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  );
}

function EmptyTable({ message }: { message: string }) {
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
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Backend endpoint did not return data yet: {message}
    </div>
  );
}

function SectionShell({
  title,
  description,
  href,
  children,
  error,
}: {
  title: string;
  description: string;
  href?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Future page
          </Link>
        ) : null}
      </div>
      {children}
      <ErrorNote message={error} />
    </section>
  );
}

function SimpleTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <EmptyTable message={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={`${row.join("-")}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EnterpriseFinanceCommandCentrePage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ManualInflowForm>(initialManualInflowForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const requests = {
      accessEnvelope: fetchJson("/api/enterprise-finance/access-envelope"),
      overview: fetchJson("/api/enterprise-finance/overview"),
      revenueEntries: fetchJson("/api/enterprise-finance/revenue-ledger"),
      manualInflows: fetchJson("/api/enterprise-finance/manual-inflows"),
      payrollProfiles: fetchJson("/api/enterprise-finance/staff-payroll/profiles"),
      arrears: fetchJson("/api/enterprise-finance/staff-payroll/arrears"),
      commission: fetchJson("/api/enterprise-finance/commission"),
      capTable: fetchJson("/api/enterprise-finance/cap-table"),
      shareholders: fetchJson("/api/enterprise-finance/shareholders"),
      shareholderAccess: fetchJson("/api/enterprise-finance/shareholder-access"),
    };

    const settled = await Promise.allSettled(Object.entries(requests).map(async ([key, request]) => [key, await request] as const));

    const nextState: LoadState = { ...emptyState };
    const nextErrors: LoadErrors = {};

    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        const [key, payload] = result.value;
        const typedKey = key as keyof LoadState;

        if (typedKey === "accessEnvelope" || typedKey === "overview") {
          nextState[typedKey] = unwrapRecord(payload) as never;
        } else if (typedKey === "revenueEntries") {
          nextState[typedKey] = arrayFrom(payload, ["revenueEntries", "entries", "ledger", "items"]) as never;
        } else if (typedKey === "manualInflows") {
          nextState[typedKey] = arrayFrom(payload, ["manualInflows", "inflows", "items"]) as never;
        } else if (typedKey === "payrollProfiles") {
          nextState[typedKey] = arrayFrom(payload, ["profiles", "staff", "items"]) as never;
        } else if (typedKey === "arrears") {
          nextState[typedKey] = arrayFrom(payload, ["arrears", "items"]) as never;
        } else if (typedKey === "commission") {
          nextState[typedKey] = arrayFrom(payload, ["commission", "awards", "events", "items"]) as never;
        } else if (typedKey === "capTable") {
          nextState[typedKey] = arrayFrom(payload, ["shareClasses", "capTable", "classes", "items"]) as never;
        } else if (typedKey === "shareholders") {
          nextState[typedKey] = arrayFrom(payload, ["shareholders", "registry", "items"]) as never;
        } else if (typedKey === "shareholderAccess") {
          nextState[typedKey] = arrayFrom(payload, ["grants", "accessGrants", "items"]) as never;
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
    void loadFinanceData();
  }, [loadFinanceData]);

  const summary = useMemo(() => {
    const overview = state.overview;

    const grossRevenue =
      numberAt(overview, ["grossRevenue", "grossRevenueAmount", "totalGrossRevenue", "grossRevenueCents"]) ||
      sumBy(state.revenueEntries, ["grossAmount", "grossRevenue", "amount", "amountCents"]);

    const netPlatformRevenue =
      numberAt(overview, ["netPlatformRevenue", "netRevenue", "platformRevenue", "netPlatformRevenueCents"]) ||
      sumBy(state.revenueEntries, ["netPlatformRevenue", "netAmount", "platformFee", "platformFeeCents"]);

    const manualInflows =
      numberAt(overview, ["manualInflows", "manualRevenue", "manualInflowAmount", "manualInflowsCents"]) ||
      sumBy(state.manualInflows, ["amount", "amountCents", "value"]);

    const investmentInflows =
      numberAt(overview, ["investmentInflows", "investmentContributions", "capitalContributions", "investmentInflowsCents"]) ||
      state.manualInflows
        .filter((item) => textAt(item, ["category", "type"], "").toLowerCase().includes("invest"))
        .reduce((total, item) => total + numberAt(item, ["amount", "amountCents", "value"]), 0);

    const contractorPayable =
      numberAt(overview, ["contractorPayable", "contractorPayables", "partnerPayable", "contractorPayableCents"]);

    const payrollLiability =
      numberAt(overview, ["payrollLiability", "staffPayrollLiability", "payrollPayable", "payrollLiabilityCents"]) ||
      sumBy(state.payrollProfiles, ["monthlySalary", "salary", "grossSalary", "amount", "amountCents"]);

    const salaryArrears =
      numberAt(overview, ["salaryArrears", "staffArrears", "arrearsPayable", "salaryArrearsCents"]) ||
      sumBy(state.arrears, ["amount", "amountCents", "balance", "outstandingAmount"]);

    const commissionPayable =
      numberAt(overview, ["commissionPayable", "commissionOutstanding", "commissionPayableCents"]) ||
      sumBy(state.commission, ["amount", "amountCents", "commissionAmount", "balance"]);

    return {
      grossRevenue,
      netPlatformRevenue,
      manualInflows,
      investmentInflows,
      contractorPayable,
      payrollLiability,
      salaryArrears,
      commissionPayable,
    };
  }, [state]);

  const accessTone = state.accessEnvelope ? "good" : "warn";
  const accessLabel = state.accessEnvelope
    ? textAt(state.accessEnvelope, ["accessLevel", "role", "scope", "status"], "Enterprise finance access envelope loaded")
    : "Access envelope pending";

  async function submitManualInflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);

    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitMessage("Enter a valid positive amount before submitting the manual inflow.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(apiPath("/api/enterprise-finance/manual-inflows"), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: form.category,
          amount,
          counterparty: form.counterparty.trim(),
          reference: form.reference.trim(),
          description: form.description.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      setForm(initialManualInflowForm);
      setSubmitMessage("Manual inflow submitted for accountant/admin review.");
      await loadFinanceData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSubmitMessage(`Manual inflow could not be submitted yet: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const recentRevenueRows = state.revenueEntries.slice(0, 8).map((entry) => [
    formatDate(valueAt(entry, ["createdAt", "date", "paidAt", "transactionDate"])),
    textAt(entry, ["source", "type", "category"], "Revenue"),
    textAt(entry, ["counterparty", "patientName", "partnerName", "payerName"], "—"),
    formatMoney(numberAt(entry, ["grossAmount", "grossRevenue", "amount", "amountCents"])),
    formatMoney(numberAt(entry, ["netPlatformRevenue", "netAmount", "platformFee", "platformFeeCents"])),
  ]);

  const arrearsRows = state.arrears.slice(0, 8).map((entry) => [
    textAt(entry, ["staffName", "employeeName", "name", "userName"], "Staff member"),
    textAt(entry, ["period", "payPeriod", "month"], "—"),
    formatMoney(numberAt(entry, ["amount", "amountCents", "balance", "outstandingAmount"])),
    textAt(entry, ["status"], "Pending"),
  ]);

  const commissionRows = state.commission.slice(0, 8).map((entry) => [
    textAt(entry, ["recipientName", "staffName", "employeeName", "name"], "Recipient"),
    textAt(entry, ["source", "eventType", "category"], "Commission"),
    formatMoney(numberAt(entry, ["amount", "amountCents", "commissionAmount", "balance"])),
    textAt(entry, ["status"], "Pending"),
  ]);

  const capTableRows = state.capTable.slice(0, 8).map((entry) => [
    textAt(entry, ["shareClass", "className", "name"], "Share class"),
    textAt(entry, ["currency"], "ZAR"),
    String(numberAt(entry, ["issuedShares", "sharesIssued", "totalShares", "shares"])),
    textAt(entry, ["ownershipPercentage", "percentage", "fullyDilutedPercentage"], "—"),
  ]);

  const shareholderRows = state.shareholders.slice(0, 8).map((entry) => [
    textAt(entry, ["name", "shareholderName", "investorName"], "Shareholder"),
    textAt(entry, ["type", "shareholderType", "category"], "—"),
    String(numberAt(entry, ["shares", "shareCount", "totalShares"])),
    textAt(entry, ["accessStatus", "portalAccessStatus", "status"], "—"),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="good">Accountant Command Centre</StatusPill>
                <StatusPill tone={accessTone}>{accessLabel}</StatusPill>
                <StatusPill>Enterprise Finance</StatusPill>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Enterprise Finance Command Centre
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Backend-backed accountant/admin landing page for operating revenue, manual inflows,
                investment contributions, payroll liabilities, arrears, commissions, cap table and
                shareholder registry oversight. Shareholder portal access remains read-only and
                separated from unrelated admin operations.
              </p>
            </div>

            <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:w-96">
              <Link className="rounded-xl border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50" href="/admin/enterprise-finance/revenue">
                Revenue placeholder
              </Link>
              <Link className="rounded-xl border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50" href="/admin/enterprise-finance/payroll">
                Payroll placeholder
              </Link>
              <Link className="rounded-xl border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50" href="/admin/enterprise-finance/commission">
                Commission placeholder
              </Link>
              <Link className="rounded-xl border border-slate-200 px-3 py-2 font-semibold hover:bg-slate-50" href="/admin/enterprise-finance/shareholders">
                Shareholders placeholder
              </Link>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading enterprise finance data from API Gateway…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Gross revenue" value={formatMoney(summary.grossRevenue)} helper="Total operating revenue before platform deductions." tone="good" />
          <MetricCard label="Net platform revenue" value={formatMoney(summary.netPlatformRevenue)} helper="Platform-retained revenue from completed transactions." tone="good" />
          <MetricCard label="Manual inflows" value={formatMoney(summary.manualInflows)} helper="Manual accountant-entered revenue and non-transaction inflows." />
          <MetricCard label="Investment inflows" value={formatMoney(summary.investmentInflows)} helper="Capital contributions and investment-linked inflows." />
          <MetricCard label="Contractor payable" value={formatMoney(summary.contractorPayable)} helper="Clinician, rider, phlebotomist and partner payable exposure." tone="warn" />
          <MetricCard label="Payroll liability" value={formatMoney(summary.payrollLiability)} helper="Staff payroll obligations visible to accountant/admin." tone="warn" />
          <MetricCard label="Salary arrears" value={formatMoney(summary.salaryArrears)} helper="Outstanding staff salary arrears requiring finance review." tone="warn" />
          <MetricCard label="Commission payable" value={formatMoney(summary.commissionPayable)} helper="Commission awards/events not yet fully settled." tone="warn" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Quick manual inflow</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Capture accountant-entered revenue, investment contributions or other finance inflows.
            </p>

            <form onSubmit={submitManualInflow} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Category
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="manual_revenue">Manual revenue</option>
                  <option value="investment_inflow">Investment inflow</option>
                  <option value="capital_contribution">Capital contribution</option>
                  <option value="shareholder_contribution">Shareholder contribution</option>
                  <option value="company_debt">Company debt / loan inflow</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Amount
                <input
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Counterparty
                <input
                  value={form.counterparty}
                  onChange={(event) => setForm((current) => ({ ...current, counterparty: event.target.value }))}
                  placeholder="Investor, shareholder, customer, partner or funder"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Reference
                <input
                  value={form.reference}
                  onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                  placeholder="Bank reference, invoice, note or transaction ID"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Description
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Short accountant note"
                  rows={4}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit manual inflow"}
              </button>

              {submitMessage ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {submitMessage}
                </div>
              ) : null}
            </form>
          </section>

          <SectionShell
            title="Recent revenue entries"
            description="Operating revenue ledger snapshot from Enterprise Finance API."
            href="/admin/enterprise-finance/revenue"
            error={errors.revenueEntries}
          >
            <SimpleTable
              columns={["Date", "Source", "Counterparty", "Gross", "Net platform"]}
              rows={recentRevenueRows}
              emptyMessage="No revenue ledger entries returned yet."
            />
          </SectionShell>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <SectionShell
            title="Staff arrears"
            description="Salary arrears queue for accountant/admin reconciliation."
            href="/admin/enterprise-finance/arrears"
            error={errors.arrears}
          >
            <SimpleTable
              columns={["Staff", "Period", "Outstanding", "Status"]}
              rows={arrearsRows}
              emptyMessage="No salary arrears returned yet."
            />
          </SectionShell>

          <SectionShell
            title="Commission awards/events"
            description="Commission payable exposure and award/event summary."
            href="/admin/enterprise-finance/commission"
            error={errors.commission}
          >
            <SimpleTable
              columns={["Recipient", "Source", "Amount", "Status"]}
              rows={commissionRows}
              emptyMessage="No commission awards or events returned yet."
            />
          </SectionShell>

          <SectionShell
            title="Cap table / share class snapshot"
            description="Share class and issued share summary for enterprise reporting."
            href="/admin/enterprise-finance/cap-table"
            error={errors.capTable}
          >
            <SimpleTable
              columns={["Share class", "Currency", "Issued shares", "Ownership"]}
              rows={capTableRows}
              emptyMessage="No cap table records returned yet."
            />
          </SectionShell>

          <SectionShell
            title="Shareholder registry summary"
            description="Shareholder and investor relations snapshot with portal-access boundary awareness."
            href="/admin/enterprise-finance/shareholders"
            error={errors.shareholders}
          >
            <SimpleTable
              columns={["Shareholder", "Type", "Shares", "Portal access"]}
              rows={shareholderRows}
              emptyMessage="No shareholder registry records returned yet."
            />
          </SectionShell>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Shareholder portal access boundaries</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Shareholder-only users should receive read-only shareholder portal access, while staff-shareholders
                should retain one login with multi-entitlement access.
              </p>
            </div>
            <StatusPill>{state.shareholderAccess.length} access grant(s)</StatusPill>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Boundary rule</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">Investor/shareholder-only users do not see unrelated Admin/operations pages.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Access model</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">Operational roles plus ShareholderAccessGrant under one login.</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Default posture</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">Shareholder portal remains read-only unless explicitly expanded later.</div>
            </div>
          </div>
        </section>
      </div>
    
        <section
          data-a5-k-k-c="cap-table-input-discoverability-command-centre"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"
        >
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Accountant input
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Cap table source-of-truth
            </span>
          </div>

          <h2 className="mt-3 text-lg font-bold text-emerald-950">
            Feed cap table data
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900">
            Accountants and Enterprise Finance admins can now open the cap table input workspace to create audited
            cap table snapshots, share classes, shareholder rows, valuations and share-sale notices.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/admin/enterprise-finance/cap-table/input"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Open accountant cap table input
            </a>

            <a
              href="/admin/enterprise-finance/cap-table"
              className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              Review cap table view
            </a>
          </div>
        </section>

      {/* A5_M_I_D_ENTERPRISE_FINANCE_PROCUREMENT_NAV_CARDS */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Procurement, vendors and inventory
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Admin Ops procurement command links
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Review vendor registration, expenditure, vendor invoices, payouts, stock inventory and import-order receiving workflows from the Enterprise Finance command centre.
            </p>
          </div>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            Read-only launch surfaces
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <a
            href="/admin/enterprise-finance/vendors"
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/70 hover:bg-slate-900"
          >
            <p className="text-sm font-semibold text-white">Vendors</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Registered vendors, approval state and payout eligibility.
            </p>
          </a>

          <a
            href="/admin/enterprise-finance/expenditure"
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/70 hover:bg-slate-900"
          >
            <p className="text-sm font-semibold text-white">Expenditure ledger</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Operating expenditure, proof-of-payment records and payment status.
            </p>
          </a>

          <a
            href="/admin/enterprise-finance/vendor-invoices"
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/70 hover:bg-slate-900"
          >
            <p className="text-sm font-semibold text-white">Vendor invoices</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Uploaded invoices, verification state, balances and due dates.
            </p>
          </a>

          <a
            href="/admin/enterprise-finance/vendor-payouts"
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/70 hover:bg-slate-900"
          >
            <p className="text-sm font-semibold text-white">Vendor payouts</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Scheduled payouts, Paystack readiness and paid vendor transfers.
            </p>
          </a>

          <a
            href="/admin/enterprise-finance/inventory"
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/70 hover:bg-slate-900"
          >
            <p className="text-sm font-semibold text-white">Inventory</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Admin Ops stock, devices, CarePort-linked items and operational consumables.
            </p>
          </a>

          <a
            href="/admin/enterprise-finance/import-orders"
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/70 hover:bg-slate-900"
          >
            <p className="text-sm font-semibold text-white">Import orders</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Order, payment, delivery, inspection and stock-acceptance workflow.
            </p>
          </a>
        </div>
      </section>

</main>
  );
}

