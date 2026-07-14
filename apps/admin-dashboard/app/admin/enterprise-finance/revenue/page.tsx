"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type RevenueFilters = {
  search: string;
  category: string;
  module: string;
  status: string;
  startDate: string;
  endDate: string;
};

type ManualInflowForm = {
  category: string;
  amount: string;
  counterparty: string;
  reference: string;
  description: string;
  occurredAt: string;
};

type LoadState = {
  accessEnvelope: JsonRecord | null;
  overview: JsonRecord | null;
  revenueEntries: JsonRecord[];
  manualInflows: JsonRecord[];
};

type LoadErrors = Partial<Record<keyof LoadState, string>>;

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  revenueEntries: [],
  manualInflows: [],
};

const initialFilters: RevenueFilters = {
  search: "",
  category: "all",
  module: "all",
  status: "all",
  startDate: "",
  endDate: "",
};

const initialManualInflowForm: ManualInflowForm = {
  category: "manual_revenue",
  amount: "",
  counterparty: "",
  reference: "",
  description: "",
  occurredAt: "",
};

const manualInflowCategories = [
  { value: "manual_revenue", label: "Manual revenue" },
  { value: "investment_inflow", label: "Investment inflow" },
  { value: "capital_contribution", label: "Capital contribution" },
  { value: "shareholder_contribution", label: "Shareholder contribution" },
  { value: "company_debt", label: "Company debt / loan inflow" },
  { value: "refund_adjustment", label: "Refund adjustment" },
  { value: "provider_fee_adjustment", label: "Provider fee adjustment" },
  { value: "other", label: "Other" },
];

const apiBase = (
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/$/, "");

function apiPath(path: string) {
  return `${apiBase}${path}`;
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

  for (const key of ["items", "rows", "data", "entries", "results", "records", "ledger", "manualInflows", "inflows"]) {
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
  const value = valueAt(record, ["createdAt", "occurredAt", "date", "paidAt", "transactionDate", "postedAt"]);

  if (!value || typeof value !== "string") {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
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

export default function EnterpriseFinanceRevenuePage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RevenueFilters>(initialFilters);
  const [form, setForm] = useState<ManualInflowForm>(initialManualInflowForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const loadRevenueData = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const requests = {
      accessEnvelope: fetchJson("/api/enterprise-finance/access-envelope"),
      overview: fetchJson("/api/enterprise-finance/overview"),
      revenueEntries: fetchJson("/api/enterprise-finance/revenue-ledger"),
      manualInflows: fetchJson("/api/enterprise-finance/manual-inflows"),
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
        } else if (typedKey === "revenueEntries") {
          nextState[typedKey] = arrayFrom(payload, ["revenueEntries", "entries", "ledger", "items"]) as never;
        } else if (typedKey === "manualInflows") {
          nextState[typedKey] = arrayFrom(payload, ["manualInflows", "inflows", "items"]) as never;
        }
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : "Unknown error";
        nextErrors.overview = nextErrors.overview || reason;
      }
    });

    setState(nextState);
    setLoading(false);
    setErrors(nextErrors);
  }, []);

  useEffect(() => {
    void loadRevenueData();
  }, [loadRevenueData]);

  const ledgerRows = useMemo(() => {
    const operatingRows = state.revenueEntries.map((entry) => ({
      sourceKind: "operating" as const,
      record: entry,
    }));

    const manualRows = state.manualInflows.map((entry) => ({
      sourceKind: "manual" as const,
      record: entry,
    }));

    return [...operatingRows, ...manualRows].sort((left, right) => {
      const leftDate = new Date(toDateValue(left.record)).getTime() || 0;
      const rightDate = new Date(toDateValue(right.record)).getTime() || 0;

      return rightDate - leftDate;
    });
  }, [state.manualInflows, state.revenueEntries]);

  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const modules = new Set<string>();
    const statuses = new Set<string>();

    ledgerRows.forEach(({ record, sourceKind }) => {
      categories.add(textAt(record, ["category", "type", "source"], sourceKind));
      modules.add(textAt(record, ["module", "product", "serviceLine"], sourceKind === "manual" ? "manual" : "platform"));
      statuses.add(textAt(record, ["status", "paymentStatus", "reconciliationStatus"], "recorded"));
    });

    return {
      categories: Array.from(categories).filter(Boolean).sort(),
      modules: Array.from(modules).filter(Boolean).sort(),
      statuses: Array.from(statuses).filter(Boolean).sort(),
    };
  }, [ledgerRows]);

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return ledgerRows.filter(({ record, sourceKind }) => {
      const category = textAt(record, ["category", "type", "source"], sourceKind).toLowerCase();
      const module = textAt(record, ["module", "product", "serviceLine"], sourceKind === "manual" ? "manual" : "platform").toLowerCase();
      const status = textAt(record, ["status", "paymentStatus", "reconciliationStatus"], "recorded").toLowerCase();
      const date = toDateValue(record);

      if (filters.category !== "all" && category !== filters.category.toLowerCase()) {
        return false;
      }

      if (filters.module !== "all" && module !== filters.module.toLowerCase()) {
        return false;
      }

      if (filters.status !== "all" && status !== filters.status.toLowerCase()) {
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
        category,
        module,
        status,
        textAt(record, ["counterparty", "patientName", "partnerName", "payerName", "investorName", "shareholderName"], ""),
        textAt(record, ["reference", "transactionReference", "externalReference", "id"], ""),
        textAt(record, ["description", "memo", "note"], ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [filters, ledgerRows]);

  const summary = useMemo(() => {
    const overview = state.overview;

    const grossRevenue =
      amountAt(overview, ["grossRevenue", "grossRevenueAmount", "totalGrossRevenue", "grossRevenueCents"]) ||
      sumAmounts(state.revenueEntries, ["grossAmount", "grossRevenue", "amount", "amountCents"]);

    const netPlatformRevenue =
      amountAt(overview, ["netPlatformRevenue", "netRevenue", "platformRevenue", "netPlatformRevenueCents"]) ||
      sumAmounts(state.revenueEntries, ["netPlatformRevenue", "netAmount", "platformFee", "platformFeeCents"]);

    const manualInflows =
      amountAt(overview, ["manualInflows", "manualRevenue", "manualInflowAmount", "manualInflowsCents"]) ||
      sumAmounts(state.manualInflows, ["amount", "amountCents", "value"]);

    const investmentInflows =
      amountAt(overview, ["investmentInflows", "investmentContributions", "capitalContributions", "investmentInflowsCents"]) ||
      state.manualInflows
        .filter((entry) => {
          const category = textAt(entry, ["category", "type"], "").toLowerCase();
          return category.includes("invest") || category.includes("capital") || category.includes("shareholder");
        })
        .reduce((total, entry) => total + amountAt(entry, ["amount", "amountCents", "value"]), 0);

    const refunds =
      amountAt(overview, ["refunds", "refundAmount", "refundsCents", "totalRefunds"]) ||
      ledgerRows
        .filter(({ record }) => {
          const category = textAt(record, ["category", "type", "source"], "").toLowerCase();
          return category.includes("refund");
        })
        .reduce((total, { record }) => total + amountAt(record, ["refundAmount", "amount", "amountCents"]), 0);

    const providerFees =
      amountAt(overview, ["providerFees", "providerFeeAmount", "providerFeesCents", "partnerFees"]) ||
      sumAmounts(state.revenueEntries, ["providerFee", "providerFees", "partnerFee", "providerFeeCents", "partnerFeeCents"]);

    return {
      grossRevenue,
      netPlatformRevenue,
      manualInflows,
      investmentInflows,
      refunds,
      providerFees,
    };
  }, [ledgerRows, state.manualInflows, state.overview, state.revenueEntries]);

  const groupedTotals = useMemo(() => {
    const operatingRevenue = filteredRows
      .filter(({ sourceKind, record }) => {
        const category = textAt(record, ["category", "type", "source"], sourceKind).toLowerCase();
        return sourceKind === "operating" && !category.includes("refund");
      })
      .reduce((total, { record }) => total + amountAt(record, ["grossAmount", "grossRevenue", "amount", "amountCents"]), 0);

    const manualRevenue = filteredRows
      .filter(({ record }) => textAt(record, ["category", "type"], "").toLowerCase().includes("manual"))
      .reduce((total, { record }) => total + amountAt(record, ["amount", "amountCents", "value"]), 0);

    const investmentAndContributions = filteredRows
      .filter(({ record }) => {
        const category = textAt(record, ["category", "type"], "").toLowerCase();
        return category.includes("invest") || category.includes("capital") || category.includes("shareholder");
      })
      .reduce((total, { record }) => total + amountAt(record, ["amount", "amountCents", "value"]), 0);

    return {
      operatingRevenue,
      manualRevenue,
      investmentAndContributions,
    };
  }, [filteredRows]);

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
          occurredAt: form.occurredAt || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      setForm(initialManualInflowForm);
      setSubmitMessage("Manual inflow submitted and revenue data refreshed.");
      await loadRevenueData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSubmitMessage(`Manual inflow could not be submitted yet: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function copyCsvExport() {
    setExportMessage(null);

    const headings = [
      "Date",
      "Kind",
      "Module",
      "Category",
      "Counterparty",
      "Reference",
      "Gross amount",
      "Net platform revenue",
      "Provider fees",
      "Status",
      "Description",
    ];

    const rows = filteredRows.map(({ sourceKind, record }) => [
      formatDate(valueAt(record, ["createdAt", "occurredAt", "date", "paidAt", "transactionDate", "postedAt"])),
      sourceKind,
      textAt(record, ["module", "product", "serviceLine"], sourceKind === "manual" ? "manual" : "platform"),
      textAt(record, ["category", "type", "source"], sourceKind),
      textAt(record, ["counterparty", "patientName", "partnerName", "payerName", "investorName", "shareholderName"], ""),
      textAt(record, ["reference", "transactionReference", "externalReference", "id"], ""),
      String(amountAt(record, ["grossAmount", "grossRevenue", "amount", "amountCents"])),
      String(amountAt(record, ["netPlatformRevenue", "netAmount", "platformFee", "platformFeeCents"])),
      String(amountAt(record, ["providerFee", "providerFees", "partnerFee", "providerFeeCents", "partnerFeeCents"])),
      textAt(record, ["status", "paymentStatus", "reconciliationStatus"], "recorded"),
      textAt(record, ["description", "memo", "note"], ""),
    ]);

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (!navigator.clipboard) {
      setExportMessage("CSV export is ready, but clipboard access is unavailable in this browser.");
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setExportMessage(`Copied ${rows.length} filtered revenue row(s) as CSV-ready text.`))
      .catch(() => setExportMessage("CSV export could not be copied to clipboard."));
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
                <StatusPill>Revenue ledger</StatusPill>
                <StatusPill tone={state.accessEnvelope ? "good" : "warn"}>{accessLabel}</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Revenue and Manual Inflows
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Accountant-facing revenue page for operating ledger entries, manual inflows,
                investment contributions, capital contributions, refunds and provider-fee visibility.
                This slice keeps the layout export-ready without introducing chart dependencies.
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
                onClick={copyCsvExport}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Copy CSV-ready export
              </button>
            </div>
          </div>

          {exportMessage ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {exportMessage}
            </div>
          ) : null}
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading revenue data from Enterprise Finance API…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Gross revenue"
            value={formatMoney(summary.grossRevenue)}
            helper="Total operating revenue before provider fees, refunds and adjustments."
            tone="good"
          />
          <MetricCard
            label="Net platform revenue"
            value={formatMoney(summary.netPlatformRevenue)}
            helper="Platform-retained revenue after recognised deductions."
            tone="good"
          />
          <MetricCard
            label="Manual inflows"
            value={formatMoney(summary.manualInflows)}
            helper="Accountant-entered inflows outside automated product transactions."
          />
          <MetricCard
            label="Investment inflows"
            value={formatMoney(summary.investmentInflows)}
            helper="Investment, capital and shareholder contribution inflows."
          />
          <MetricCard
            label="Refunds"
            value={formatMoney(summary.refunds)}
            helper="Refund-linked revenue adjustments requiring accountant visibility."
            tone="danger"
          />
          <MetricCard
            label="Provider fees"
            value={formatMoney(summary.providerFees)}
            helper="Provider/partner fees separated from net platform revenue."
            tone="warn"
          />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Filtered operating revenue</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{formatMoney(groupedTotals.operatingRevenue)}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Automated operating entries currently visible after filters.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Filtered manual revenue</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{formatMoney(groupedTotals.manualRevenue)}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Manual revenue entries currently visible after filters.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Filtered investments / contributions</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{formatMoney(groupedTotals.investmentAndContributions)}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Investment and contribution entries currently visible after filters.</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Manual inflow capture</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Submit manual revenue, investment, contribution, company debt or adjustment entries for accountant-controlled reporting.
            </p>

            <form onSubmit={submitManualInflow} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <FieldLabel>Category</FieldLabel>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {manualInflowCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <FieldLabel>Amount</FieldLabel>
                  <input
                    value={form.amount}
                    onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="grid gap-2">
                  <FieldLabel>Occurred date</FieldLabel>
                  <input
                    value={form.occurredAt}
                    onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))}
                    type="date"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <FieldLabel>Counterparty</FieldLabel>
                <input
                  value={form.counterparty}
                  onChange={(event) => setForm((current) => ({ ...current, counterparty: event.target.value }))}
                  placeholder="Investor, shareholder, customer, partner, funder or payer"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Reference</FieldLabel>
                <input
                  value={form.reference}
                  onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                  placeholder="Bank reference, invoice, transaction ID or accountant note"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Short finance description"
                  rows={4}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
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

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Control note</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Manual inflows are accountant/admin-controlled records. Staff self-service and shareholder portal views should not create
                or mutate these records.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Filters</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Filter by date, category, module, status or free-text search before copying an export-ready CSV view.
                </p>
              </div>
              <StatusPill>{filteredRows.length} visible row(s)</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <FieldLabel>Search</FieldLabel>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Counterparty, reference, status, description"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Category</FieldLabel>
                <select
                  value={filters.category}
                  onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All categories</option>
                  {filterOptions.categories.map((category) => (
                    <option key={category} value={category.toLowerCase()}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Module</FieldLabel>
                <select
                  value={filters.module}
                  onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All modules</option>
                  {filterOptions.modules.map((module) => (
                    <option key={module} value={module.toLowerCase()}>
                      {module}
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
                onClick={() => void loadRevenueData()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh data
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Operating</div>
                <p className="mt-2 text-sm font-semibold text-slate-900">CarePort, MedReach, consultations, devices and subscriptions.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual</div>
                <p className="mt-2 text-sm font-semibold text-slate-900">Accountant-entered revenue and adjustment inflows.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Capital</div>
                <p className="mt-2 text-sm font-semibold text-slate-900">Investment, shareholder and capital contribution records.</p>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Revenue ledger</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Combined export-ready view of operating revenue and manual inflow records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill>{state.revenueEntries.length} operating</StatusPill>
              <StatusPill>{state.manualInflows.length} manual</StatusPill>
            </div>
          </div>

          <div className="grid gap-3">
            <ErrorNote message={errors.overview} />

            {filteredRows.length === 0 ? (
              <EmptyState message="No revenue or manual inflow records match the current filters." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Date",
                          "Kind",
                          "Module",
                          "Category",
                          "Counterparty",
                          "Reference",
                          "Gross",
                          "Net platform",
                          "Provider fees",
                          "Status",
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
                      {filteredRows.map(({ sourceKind, record }, index) => (
                        <tr key={`${sourceKind}-${textAt(record, ["id", "reference"], String(index))}-${index}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {formatDate(valueAt(record, ["createdAt", "occurredAt", "date", "paidAt", "transactionDate", "postedAt"]))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            <StatusPill tone={sourceKind === "operating" ? "good" : "neutral"}>
                              {sourceKind === "operating" ? "Operating" : "Manual"}
                            </StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(record, ["module", "product", "serviceLine"], sourceKind === "manual" ? "manual" : "platform")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(record, ["category", "type", "source"], sourceKind)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(record, ["counterparty", "patientName", "partnerName", "payerName", "investorName", "shareholderName"], "—")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(record, ["reference", "transactionReference", "externalReference", "id"], "—")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatMoney(amountAt(record, ["grossAmount", "grossRevenue", "amount", "amountCents"]))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatMoney(amountAt(record, ["netPlatformRevenue", "netAmount", "platformFee", "platformFeeCents"]))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {formatMoney(amountAt(record, ["providerFee", "providerFees", "partnerFee", "providerFeeCents", "partnerFeeCents"]))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(record, ["status", "paymentStatus", "reconciliationStatus"], "recorded")}
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
          <h2 className="text-lg font-bold text-slate-950">Revenue controls and separation</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Operating revenue</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Intended for platform revenue from consultations, CarePort, MedReach, subscriptions, devices and training/onboarding flows.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual inflows</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Accountant-entered revenue, non-transaction income, corrections and controlled finance adjustments.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Investment / contribution</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Capital contributions and shareholder/investor inflows remain visible to accountant/admin reporting, not ordinary shareholder editing.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
