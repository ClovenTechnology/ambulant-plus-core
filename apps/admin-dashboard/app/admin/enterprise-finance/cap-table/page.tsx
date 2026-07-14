"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type LoadState = {
  accessEnvelope: JsonRecord | null;
  overview: JsonRecord | null;
  capTable: JsonRecord | null;
  shareClasses: JsonRecord[];
  shareholders: JsonRecord[];
  rounds: JsonRecord[];
  valuations: JsonRecord[];
  transfers: JsonRecord[];
  notices: JsonRecord[];
  documents: JsonRecord[];
};

type LoadErrors = Partial<Record<keyof LoadState, string>>;

type CapTableFilters = {
  search: string;
  shareClass: string;
  holderType: string;
  status: string;
};

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  capTable: null,
  shareClasses: [],
  shareholders: [],
  rounds: [],
  valuations: [],
  transfers: [],
  notices: [],
  documents: [],
};

const initialFilters: CapTableFilters = {
  search: "",
  shareClass: "all",
  holderType: "all",
  status: "all",
};

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

  for (const key of [
    "items",
    "rows",
    "data",
    "results",
    "records",
    "shareClasses",
    "shareholders",
    "registry",
    "rounds",
    "investmentRounds",
    "valuations",
    "valuationSnapshots",
    "transfers",
    "shareTransfers",
    "notices",
    "shareSaleNotices",
    "documents",
  ]) {
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
  if (!record) {
    return 0;
  }

  for (const key of keys) {
    const value = valueAt(record, [key]);

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
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

function sumNumbers(records: JsonRecord[], keys: string[]) {
  return records.reduce((total, record) => total + numberAt(record, keys), 0);
}

function sumAmounts(records: JsonRecord[], keys: string[]) {
  return records.reduce((total, record) => total + amountAt(record, keys), 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatMoney(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
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
  return textAt(record, ["id", "shareholderId", "shareClassId", "roundId", "valuationId", "reference"], fallback);
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

export default function EnterpriseFinanceCapTablePage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CapTableFilters>(initialFilters);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const loadCapTableData = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const requests = {
      accessEnvelope: fetchJson("/api/enterprise-finance/access-envelope"),
      overview: fetchJson("/api/enterprise-finance/overview"),
      capTable: fetchJson("/api/enterprise-finance/cap-table"),
      shareholders: fetchJson("/api/enterprise-finance/shareholders"),
    };

    const settled = await Promise.allSettled(
      Object.entries(requests).map(async ([key, request]) => [key, await request] as const),
    );

    const nextState: LoadState = { ...emptyState };
    const nextErrors: LoadErrors = {};

    settled.forEach((result) => {
      if (result.status === "fulfilled") {
        const [key, payload] = result.value;

        if (key === "accessEnvelope") {
          nextState.accessEnvelope = isRecord(payload) ? payload : null;
        }

        if (key === "overview") {
          nextState.overview = isRecord(payload) ? payload : null;
        }

        if (key === "capTable") {
          nextState.capTable = isRecord(payload) ? payload : null;
          nextState.shareClasses = arrayFrom(payload, ["shareClasses", "classes", "equityClasses"]);
          nextState.rounds = arrayFrom(payload, ["investmentRounds", "rounds", "fundingRounds"]);
          nextState.valuations = arrayFrom(payload, ["valuationSnapshots", "valuations"]);
          nextState.transfers = arrayFrom(payload, ["shareTransfers", "transfers"]);
          nextState.notices = arrayFrom(payload, ["shareSaleNotices", "notices"]);
          nextState.documents = arrayFrom(payload, ["documents", "shareholderDocuments", "annualReturns"]);
        }

        if (key === "shareholders") {
          nextState.shareholders = arrayFrom(payload, ["shareholders", "registry", "items", "rows"]);
          nextState.documents = nextState.documents.length > 0
            ? nextState.documents
            : arrayFrom(payload, ["documents", "shareholderDocuments", "annualReturns"]);
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
    void loadCapTableData();
  }, [loadCapTableData]);

  const filterOptions = useMemo(() => {
    const shareClasses = new Set<string>();
    const holderTypes = new Set<string>();
    const statuses = new Set<string>();

    state.shareholders.forEach((holder) => {
      shareClasses.add(textAt(holder, ["shareClass", "className", "equityClass"], "ordinary"));
      holderTypes.add(textAt(holder, ["holderType", "type", "category"], "shareholder"));
      statuses.add(textAt(holder, ["status", "registryStatus", "accessStatus"], "active"));
    });

    state.shareClasses.forEach((shareClass) => {
      shareClasses.add(textAt(shareClass, ["name", "className", "code"], "ordinary"));
    });

    return {
      shareClasses: Array.from(shareClasses).filter(Boolean).sort(),
      holderTypes: Array.from(holderTypes).filter(Boolean).sort(),
      statuses: Array.from(statuses).filter(Boolean).sort(),
    };
  }, [state.shareClasses, state.shareholders]);

  const filteredShareholders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return state.shareholders.filter((holder) => {
      const shareClass = textAt(holder, ["shareClass", "className", "equityClass"], "ordinary").toLowerCase();
      const holderType = textAt(holder, ["holderType", "type", "category"], "shareholder").toLowerCase();
      const status = textAt(holder, ["status", "registryStatus", "accessStatus"], "active").toLowerCase();

      if (filters.shareClass !== "all" && shareClass !== filters.shareClass.toLowerCase()) {
        return false;
      }

      if (filters.holderType !== "all" && holderType !== filters.holderType.toLowerCase()) {
        return false;
      }

      if (filters.status !== "all" && status !== filters.status.toLowerCase()) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        textAt(holder, ["shareholderName", "name", "legalName", "displayName"], ""),
        textAt(holder, ["email", "shareholderEmail"], ""),
        shareClass,
        holderType,
        status,
        textAt(holder, ["reference", "shareholderId", "id"], ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [filters, state.shareholders]);

  const summary = useMemo(() => {
    const authorisedShares =
      numberAt(state.capTable, ["authorisedShares", "authorizedShares", "totalAuthorisedShares"]) ||
      sumNumbers(state.shareClasses, ["authorisedShares", "authorizedShares"]);

    const issuedShares =
      numberAt(state.capTable, ["issuedShares", "totalIssuedShares"]) ||
      sumNumbers(state.shareClasses, ["issuedShares", "allocatedShares"]) ||
      sumNumbers(state.shareholders, ["shares", "issuedShares", "shareCount", "ordinaryShares"]);

    const allocatedShares =
      numberAt(state.capTable, ["allocatedShares", "totalAllocatedShares"]) ||
      sumNumbers(state.shareholders, ["shares", "allocatedShares", "shareCount", "ordinaryShares"]);

    const fullyDilutedShares =
      numberAt(state.capTable, ["fullyDilutedShares", "fullyDilutedShareCount"]) ||
      Math.max(issuedShares, allocatedShares);

    const unallocatedShares =
      numberAt(state.capTable, ["unallocatedShares", "remainingShares"]) ||
      Math.max(authorisedShares - allocatedShares, 0);

    const totalCapitalRaised =
      amountAt(state.capTable, ["totalCapitalRaised", "capitalRaised", "capitalRaisedCents"]) ||
      sumAmounts(state.rounds, ["amountRaised", "amount", "investmentAmount", "amountCents"]);

    const latestValuation = state.valuations[0]
      ? amountAt(state.valuations[0], ["valuation", "postMoneyValuation", "companyValuation", "amount", "amountCents"])
      : amountAt(state.capTable, ["latestValuation", "companyValuation", "postMoneyValuation"]);

    return {
      authorisedShares,
      issuedShares,
      allocatedShares,
      unallocatedShares,
      fullyDilutedShares,
      totalCapitalRaised,
      latestValuation,
      shareholderCount: state.shareholders.length,
    };
  }, [state.capTable, state.rounds, state.shareClasses, state.shareholders, state.valuations]);

  function ownershipPercent(holder: JsonRecord) {
    const explicit = numberAt(holder, ["ownershipPercent", "ownershipPercentage", "percentage", "fullyDilutedPercent"]);
    if (explicit > 0) {
      return explicit;
    }

    const shares = numberAt(holder, ["shares", "shareCount", "ordinaryShares", "allocatedShares"]);
    const denominator = summary.fullyDilutedShares || summary.issuedShares || summary.allocatedShares;

    if (denominator <= 0) {
      return 0;
    }

    return (shares / denominator) * 100;
  }

  function copyCapTableExport() {
    setExportMessage(null);

    const headings = [
      "Shareholder",
      "Email",
      "Holder type",
      "Share class",
      "Shares",
      "Ownership percent",
      "Voting rights",
      "Dividend rights",
      "Status",
      "Reference",
    ];

    const rows = filteredShareholders.map((holder) => [
      textAt(holder, ["shareholderName", "name", "legalName", "displayName"], "Shareholder"),
      textAt(holder, ["email", "shareholderEmail"], ""),
      textAt(holder, ["holderType", "type", "category"], "shareholder"),
      textAt(holder, ["shareClass", "className", "equityClass"], "ordinary"),
      String(numberAt(holder, ["shares", "shareCount", "ordinaryShares", "allocatedShares"])),
      String(ownershipPercent(holder)),
      textAt(holder, ["votingRights", "votes", "voting"], ""),
      textAt(holder, ["dividendRights", "dividends", "dividend"], ""),
      textAt(holder, ["status", "registryStatus", "accessStatus"], "active"),
      textAt(holder, ["reference", "shareholderId", "id"], ""),
    ]);

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (!navigator.clipboard) {
      setExportMessage("Cap table export is ready, but clipboard access is unavailable in this browser.");
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setExportMessage(`Copied ${rows.length} cap table row(s) as CSV-ready text.`))
      .catch(() => setExportMessage("Cap table export could not be copied to clipboard."));
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
                <StatusPill>Cap table</StatusPill>
                <StatusPill tone={state.accessEnvelope ? "good" : "warn"}>{accessLabel}</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Cap Table and Equity Structure
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Accountant/admin cap table page for share classes, authorised shares, issued shares,
                allocated shares, unallocated shares, fully diluted ownership, investment rounds,
                valuation snapshots, share transfers and share-sale notices.
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
                href="/admin/enterprise-finance/shareholders"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Open shareholder registry
              </Link>
              <button
                type="button"
                onClick={copyCapTableExport}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Copy cap table export
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
            Loading cap table data from Enterprise Finance API…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Authorised shares" value={formatNumber(summary.authorisedShares)} helper="Maximum authorised share pool from cap table/share-class records." />
          <MetricCard label="Issued shares" value={formatNumber(summary.issuedShares)} helper="Issued share count from cap table, classes or registry rows." tone="good" />
          <MetricCard label="Allocated shares" value={formatNumber(summary.allocatedShares)} helper="Shares currently allocated to shareholders." tone="good" />
          <MetricCard label="Unallocated shares" value={formatNumber(summary.unallocatedShares)} helper="Remaining authorised shares not yet allocated." tone="warn" />
          <MetricCard label="Fully diluted shares" value={formatNumber(summary.fullyDilutedShares)} helper="Fully diluted denominator for ownership review." />
          <MetricCard label="Shareholders" value={String(summary.shareholderCount)} helper="Shareholder registry rows returned by backend." />
          <MetricCard label="Capital raised" value={formatMoney(summary.totalCapitalRaised)} helper="Investment/capital contribution total from funding rounds." tone="good" />
          <MetricCard label="Latest valuation" value={formatMoney(summary.latestValuation)} helper="Latest valuation snapshot or company valuation field." />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Cap table filters</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Filter shareholder ownership rows by name, class, holder type and registry status.
                </p>
              </div>
              <StatusPill>{filteredShareholders.length} visible holder(s)</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <FieldLabel>Search</FieldLabel>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Shareholder, email, class, reference"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="grid gap-2">
                <FieldLabel>Share class</FieldLabel>
                <select
                  value={filters.shareClass}
                  onChange={(event) => setFilters((current) => ({ ...current, shareClass: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All classes</option>
                  {filterOptions.shareClasses.map((shareClass) => (
                    <option key={shareClass} value={shareClass.toLowerCase()}>
                      {shareClass}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Holder type</FieldLabel>
                <select
                  value={filters.holderType}
                  onChange={(event) => setFilters((current) => ({ ...current, holderType: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All holder types</option>
                  {filterOptions.holderTypes.map((type) => (
                    <option key={type} value={type.toLowerCase()}>
                      {type}
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
                onClick={() => void loadCapTableData()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh cap table data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Cap table controls</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              This slice presents accountant/admin cap table visibility only. Share-class editing,
              issuance, transfers, valuation approval and shareholder access grants should use later audited write endpoints.
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Voting / dividend rights</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Voting rights, dividend rights, liquidation preference and transfer restrictions are displayed from backend fields where available.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Shareholder boundary</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Shareholder portal users should receive read-only snapshots. They must not mutate cap table, valuation or annual return records.
                </p>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Share classes</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Share classes with rights, restrictions, authorised shares and issued shares.
              </p>
            </div>
            <StatusPill>{state.shareClasses.length} class record(s)</StatusPill>
          </div>

          {state.shareClasses.length === 0 ? (
            <EmptyState message="No share class records returned yet." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Class", "Authorised", "Issued", "Voting rights", "Dividend rights", "Liquidation / transfer terms", "Status"].map((heading) => (
                        <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {state.shareClasses.map((shareClass, index) => (
                      <tr key={`${recordId(shareClass, String(index))}-class-${index}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                          {textAt(shareClass, ["name", "className", "code"], "Share class")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatNumber(numberAt(shareClass, ["authorisedShares", "authorizedShares"]))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatNumber(numberAt(shareClass, ["issuedShares", "allocatedShares"]))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(shareClass, ["votingRights", "votes", "voting"], "—")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(shareClass, ["dividendRights", "dividends", "dividend"], "—")}
                        </td>
                        <td className="max-w-md px-4 py-3 text-slate-700">
                          {textAt(shareClass, ["liquidationPreference", "transferRestrictions", "terms", "conditions"], "—")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {textAt(shareClass, ["status", "classStatus"], "active")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Ownership registry</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Shareholder ownership rows with issued shares, fully diluted percentage, voting rights and dividend rights.
              </p>
            </div>
            <StatusPill>{state.shareholders.length} shareholder row(s)</StatusPill>
          </div>

          <div className="grid gap-3">
            <ErrorNote message={errors.overview} />

            {filteredShareholders.length === 0 ? (
              <EmptyState message="No shareholder ownership rows match the current filters." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Shareholder", "Holder type", "Class", "Shares", "Ownership", "Voting", "Dividend", "Status", "Reference"].map((heading) => (
                          <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredShareholders.map((holder, index) => (
                        <tr key={`${recordId(holder, String(index))}-holder-${index}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            <div className="font-semibold text-slate-900">
                              {textAt(holder, ["shareholderName", "name", "legalName", "displayName"], "Shareholder")}
                            </div>
                            <div className="text-xs text-slate-500">
                              {textAt(holder, ["email", "shareholderEmail"], "—")}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(holder, ["holderType", "type", "category"], "shareholder")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(holder, ["shareClass", "className", "equityClass"], "ordinary")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatNumber(numberAt(holder, ["shares", "shareCount", "ordinaryShares", "allocatedShares"]))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {formatPercent(ownershipPercent(holder))}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(holder, ["votingRights", "votes", "voting"], "—")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(holder, ["dividendRights", "dividends", "dividend"], "—")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(holder, ["status", "registryStatus", "accessStatus"], "active")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {textAt(holder, ["reference", "shareholderId", "id"], "—")}
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

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Investment rounds and capital contributions</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Funding rounds, investment inflows and capital contribution records linked to equity reporting.
            </p>

            <div className="mt-4">
              {state.rounds.length === 0 ? (
                <EmptyState message="No investment round records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Round", "Date", "Amount", "Share price", "Status"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.rounds.slice(0, 8).map((round, index) => (
                          <tr key={`${recordId(round, String(index))}-round-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {textAt(round, ["name", "roundName", "title"], "Investment round")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(round, ["date", "closedAt", "createdAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(amountAt(round, ["amountRaised", "amount", "investmentAmount", "amountCents"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatMoney(amountAt(round, ["sharePrice", "pricePerShare", "sharePriceCents"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(round, ["status", "roundStatus"], "recorded")}
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
            <h2 className="text-lg font-bold text-slate-950">Valuation snapshots</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Company valuation snapshots prepared for accountant/admin and future shareholder portal read-only reporting.
            </p>

            <div className="mt-4">
              {state.valuations.length === 0 ? (
                <EmptyState message="No valuation snapshot records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Snapshot", "Date", "Valuation", "Method", "Status"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.valuations.slice(0, 8).map((valuation, index) => (
                          <tr key={`${recordId(valuation, String(index))}-valuation-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {textAt(valuation, ["name", "title", "snapshotName"], "Valuation snapshot")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(valuation, ["date", "valuationDate", "createdAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(amountAt(valuation, ["valuation", "postMoneyValuation", "companyValuation", "amount", "amountCents"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(valuation, ["method", "valuationMethod"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(valuation, ["status", "approvalStatus"], "recorded")}
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
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Share transfers and sale notices</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Share transfer records and share-sale notices for transfer conditions and shareholder notice tracking.
            </p>

            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Share transfers</div>
                <p className="mt-2 text-2xl font-bold text-slate-950">{state.transfers.length}</p>
                <p className="mt-1 text-sm text-slate-600">Transfer records returned by cap table endpoint.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Share-sale notices</div>
                <p className="mt-2 text-2xl font-bold text-slate-950">{state.notices.length}</p>
                <p className="mt-1 text-sm text-slate-600">Share-sale notice records returned for future shareholder visibility.</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Shareholder documents and annual returns</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Document counts for annual returns, shareholder packs, AGM notices and cap table reports.
            </p>

            <div className="mt-4">
              {state.documents.length === 0 ? (
                <EmptyState message="No shareholder document or annual return records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Document", "Type", "Date", "Visibility"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.documents.slice(0, 8).map((document, index) => (
                          <tr key={`${recordId(document, String(index))}-document-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {textAt(document, ["name", "title", "fileName"], "Shareholder document")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(document, ["type", "documentType", "category"], "document")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(document, ["date", "createdAt", "publishedAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(document, ["visibility", "portalVisibility", "accessScope"], "admin")}
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
        </section>
      </div>
    </main>
  );
}

