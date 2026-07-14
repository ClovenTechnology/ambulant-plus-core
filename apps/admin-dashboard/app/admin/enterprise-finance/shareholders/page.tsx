"use client";

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type LoadState = {
  accessEnvelope: JsonRecord | null;
  overview: JsonRecord | null;
  shareholders: JsonRecord[];
  accessGrants: JsonRecord[];
  documents: JsonRecord[];
  announcements: JsonRecord[];
};

type LoadErrors = Partial<Record<keyof LoadState, string>>;

type ShareholderFilters = {
  search: string;
  holderType: string;
  accessStatus: string;
  portalRole: string;
};

type AccessAction = "grant" | "revoke" | "permission_update";

const emptyState: LoadState = {
  accessEnvelope: null,
  overview: null,
  shareholders: [],
  accessGrants: [],
  documents: [],
  announcements: [],
};

const initialFilters: ShareholderFilters = {
  search: "",
  holderType: "all",
  accessStatus: "all",
  portalRole: "all",
};

const entitlementRows = [
  {
    label: "Investor only",
    access: "Shareholder portal only",
    notes: "Read-only shareholder documents, cap table snapshots, valuations, annual returns, share-sale notices and announcements.",
  },
  {
    label: "Staff only",
    access: "Staff / operations only",
    notes: "No shareholder portal access unless a shareholder access grant exists.",
  },
  {
    label: "Staff + shareholder",
    access: "Operations + shareholder portal",
    notes: "One login with separate operational role and shareholder access entitlement. Staff-shareholder single login is preserved.",
  },
  {
    label: "Accountant / Admin",
    access: "Enterprise Finance controls",
    notes: "Can manage finance surfaces subject to role guard, audit logs, idempotency keys and future write endpoints.",
  },
];

const portalPermissionRows = [
  {
    key: "cap_table_snapshot",
    label: "Cap table snapshots",
    defaultAccess: "Read-only",
    notes: "Shareholder-visible ownership snapshot only; no cap table mutation.",
  },
  {
    key: "valuation_snapshot",
    label: "Valuation snapshots",
    defaultAccess: "Read-only",
    notes: "Published valuation snapshots only; valuation approval remains accountant/admin controlled.",
  },
  {
    key: "annual_returns",
    label: "Annual returns",
    defaultAccess: "Read-only / download",
    notes: "Annual return documents can be exposed to approved shareholder portal users.",
  },
  {
    key: "agm_notices",
    label: "AGM notices and announcements",
    defaultAccess: "Read-only / download",
    notes: "AGM notices, announcements and circulars can be published to portal users.",
  },
  {
    key: "share_sale_notices",
    label: "Share-sale notices",
    defaultAccess: "Read-only",
    notes: "Share-sale notices and transfer-condition notices remain visible without mutation rights.",
  },
  {
    key: "shareholder_documents",
    label: "Shareholder documents",
    defaultAccess: "Read-only / download",
    notes: "Shareholder packs and documents can be downloaded when the access grant permits it.",
  },
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

  for (const key of [
    "items",
    "rows",
    "data",
    "results",
    "records",
    "shareholders",
    "registry",
    "accessGrants",
    "grants",
    "documents",
    "shareholderDocuments",
    "annualReturns",
    "announcements",
    "agmNotices",
    "notices",
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
  return textAt(record, ["id", "shareholderId", "grantId", "documentId", "reference"], fallback);
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function actionLabel(action: AccessAction) {
  if (action === "grant") {
    return "grant access";
  }

  if (action === "revoke") {
    return "revoke access";
  }

  return "update portal permissions";
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

export default function EnterpriseFinanceShareholdersPage() {
  const [state, setState] = useState<LoadState>(emptyState);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ShareholderFilters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeShareholder, setActiveShareholder] = useState<JsonRecord | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const loadShareholderData = useCallback(async () => {
    setLoading(true);
    setErrors({});

    const requests = {
      accessEnvelope: fetchJson("/api/enterprise-finance/access-envelope"),
      overview: fetchJson("/api/enterprise-finance/overview"),
      shareholders: fetchJson("/api/enterprise-finance/shareholders"),
      shareholderAccess: fetchJson("/api/enterprise-finance/shareholder-access"),
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

        if (key === "shareholders") {
          nextState.shareholders = arrayFrom(payload, ["shareholders", "registry", "items", "rows"]);
          nextState.documents = arrayFrom(payload, ["documents", "shareholderDocuments", "annualReturns"]);
          nextState.announcements = arrayFrom(payload, ["announcements", "agmNotices", "notices"]);
        }

        if (key === "shareholderAccess") {
          nextState.accessGrants = arrayFrom(payload, ["accessGrants", "grants", "items", "rows"]);
          nextState.documents = nextState.documents.length > 0
            ? nextState.documents
            : arrayFrom(payload, ["documents", "shareholderDocuments", "annualReturns"]);
          nextState.announcements = nextState.announcements.length > 0
            ? nextState.announcements
            : arrayFrom(payload, ["announcements", "agmNotices", "notices"]);
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
    void loadShareholderData();
  }, [loadShareholderData]);

  const filterOptions = useMemo(() => {
    const holderTypes = new Set<string>();
    const accessStatuses = new Set<string>();
    const portalRoles = new Set<string>();

    state.shareholders.forEach((holder) => {
      holderTypes.add(textAt(holder, ["holderType", "type", "category"], "shareholder"));
      accessStatuses.add(textAt(holder, ["accessStatus", "portalAccessStatus", "status"], "pending"));
      portalRoles.add(textAt(holder, ["portalRole", "shareholderRole", "role"], "shareholder"));
    });

    state.accessGrants.forEach((grant) => {
      accessStatuses.add(textAt(grant, ["status", "accessStatus", "grantStatus"], "active"));
      portalRoles.add(textAt(grant, ["portalRole", "role", "scope"], "shareholder"));
    });

    return {
      holderTypes: Array.from(holderTypes).filter(Boolean).sort(),
      accessStatuses: Array.from(accessStatuses).filter(Boolean).sort(),
      portalRoles: Array.from(portalRoles).filter(Boolean).sort(),
    };
  }, [state.accessGrants, state.shareholders]);

  const filteredShareholders = useMemo(() => {
    const search = filters.search.trim().toLowerCase();

    return state.shareholders.filter((holder) => {
      const holderType = textAt(holder, ["holderType", "type", "category"], "shareholder").toLowerCase();
      const accessStatus = textAt(holder, ["accessStatus", "portalAccessStatus", "status"], "pending").toLowerCase();
      const portalRole = textAt(holder, ["portalRole", "shareholderRole", "role"], "shareholder").toLowerCase();

      if (filters.holderType !== "all" && holderType !== filters.holderType.toLowerCase()) {
        return false;
      }

      if (filters.accessStatus !== "all" && accessStatus !== filters.accessStatus.toLowerCase()) {
        return false;
      }

      if (filters.portalRole !== "all" && portalRole !== filters.portalRole.toLowerCase()) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack = [
        textAt(holder, ["shareholderName", "name", "legalName", "displayName"], ""),
        textAt(holder, ["email", "shareholderEmail"], ""),
        textAt(holder, ["companyName", "organisation", "organization"], ""),
        textAt(holder, ["reference", "shareholderId", "id"], ""),
        holderType,
        accessStatus,
        portalRole,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [filters, state.shareholders]);

  const selectedShareholders = useMemo(() => {
    return filteredShareholders.filter((holder, index) => selectedIds.has(recordId(holder, String(index))));
  }, [filteredShareholders, selectedIds]);

  const summary = useMemo(() => {
    const totalShares = sumNumbers(state.shareholders, ["shares", "shareCount", "ordinaryShares", "allocatedShares"]);
    const capitalContributions = sumAmounts(state.shareholders, ["capitalContribution", "investmentAmount", "amountInvested", "amountCents"]);
    const activeAccessGrants = state.accessGrants.filter((grant) => {
      const status = textAt(grant, ["status", "accessStatus", "grantStatus"], "active").toLowerCase();
      return status.includes("active") || status.includes("granted") || status.includes("enabled");
    });

    const pendingAccess = state.shareholders.filter((holder) => {
      const status = textAt(holder, ["accessStatus", "portalAccessStatus", "status"], "").toLowerCase();
      return status.includes("pending") || status.includes("not") || status.includes("missing");
    });

    const staffShareholderRows = state.shareholders.filter((holder) => {
      const holderType = textAt(holder, ["holderType", "type", "category"], "").toLowerCase();
      const portalRole = textAt(holder, ["portalRole", "shareholderRole", "role"], "").toLowerCase();
      return holderType.includes("staff") || portalRole.includes("staff");
    });

    return {
      shareholderCount: state.shareholders.length,
      totalShares,
      capitalContributions,
      activeAccessGrantCount: activeAccessGrants.length,
      pendingAccessCount: pendingAccess.length,
      staffShareholderCount: staffShareholderRows.length,
      selectedCount: selectedShareholders.length,
      documentCount: state.documents.length,
      announcementCount: state.announcements.length,
    };
  }, [selectedShareholders.length, state.accessGrants, state.announcements.length, state.documents.length, state.shareholders]);

  function toggleSelected(holder: JsonRecord, index: number) {
    const id = recordId(holder, String(index));

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

  function copyShareholderRegistryExport() {
    setExportMessage(null);

    const headings = [
      "Shareholder",
      "Email",
      "Holder type",
      "Portal role",
      "Access status",
      "Shares",
      "Capital contribution",
      "Reference",
    ];

    const rows = filteredShareholders.map((holder) => [
      textAt(holder, ["shareholderName", "name", "legalName", "displayName"], "Shareholder"),
      textAt(holder, ["email", "shareholderEmail"], ""),
      textAt(holder, ["holderType", "type", "category"], "shareholder"),
      textAt(holder, ["portalRole", "shareholderRole", "role"], "shareholder"),
      textAt(holder, ["accessStatus", "portalAccessStatus", "status"], "pending"),
      String(numberAt(holder, ["shares", "shareCount", "ordinaryShares", "allocatedShares"])),
      String(amountAt(holder, ["capitalContribution", "investmentAmount", "amountInvested", "amountCents"])),
      textAt(holder, ["reference", "shareholderId", "id"], ""),
    ]);

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (!navigator.clipboard) {
      setExportMessage("Shareholder registry export is ready, but clipboard access is unavailable in this browser.");
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setExportMessage(`Copied ${rows.length} shareholder registry row(s) as CSV-ready text.`))
      .catch(() => setExportMessage("Shareholder registry export could not be copied to clipboard."));
  }

  function copyShareholderAccessPlan(records: JsonRecord[], action: AccessAction) {
    setAccessMessage(null);

    if (records.length === 0) {
      setAccessMessage(`Select at least one shareholder before preparing a ${actionLabel(action)} review plan.`);
      return;
    }

    const permissionScope = portalPermissionRows.map((row) => `${row.key}:${row.defaultAccess}`).join("; ");

    const headings = [
      "Action",
      "Shareholder",
      "Email",
      "Holder type",
      "Portal role",
      "Current access status",
      "Reference",
      "Permission scope",
      "Audit requirement",
    ];

    const rows = records.map((holder) => [
      action,
      textAt(holder, ["shareholderName", "name", "legalName", "displayName"], "Shareholder"),
      textAt(holder, ["email", "shareholderEmail"], ""),
      textAt(holder, ["holderType", "type", "category"], "shareholder"),
      textAt(holder, ["portalRole", "shareholderRole", "role"], "shareholder"),
      textAt(holder, ["accessStatus", "portalAccessStatus", "status"], "pending"),
      textAt(holder, ["reference", "shareholderId", "id"], ""),
      permissionScope,
      "future audited write endpoint with audit logs and idempotency keys",
    ]);

    const csv = [headings, ...rows].map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\n");

    if (!navigator.clipboard) {
      setAccessMessage(`${actionLabel(action)} review plan is ready, but clipboard access is unavailable in this browser.`);
      return;
    }

    void navigator.clipboard
      .writeText(csv)
      .then(() => setAccessMessage(`Copied ${rows.length} shareholder row(s) for ${actionLabel(action)} review.`))
      .catch(() => setAccessMessage(`${actionLabel(action)} review plan could not be copied to clipboard.`));
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
                <StatusPill>Shareholder access/admin controls</StatusPill>
                <StatusPill tone={state.accessEnvelope ? "good" : "warn"}>{accessLabel}</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Shareholder Registry and Access Controls
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Accountant/admin control surface for shareholder records, access-grant visibility,
                shareholder-only portal readiness, staff-shareholder single login review, portal
                permission scopes, annual returns, AGM notices, announcements and shareholder documents.
                Grant/revoke actions are prepared as audited review plans until write endpoints are added.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link
                href="/admin/enterprise-finance/cap-table"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to cap table
              </Link>
              <Link
                href="/admin/enterprise-finance"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to command centre
              </Link>
              <button
                type="button"
                onClick={copyShareholderRegistryExport}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Copy registry export
              </button>
              <button
                type="button"
                onClick={() => copyShareholderAccessPlan(selectedShareholders, "grant")}
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Prepare grant access
              </button>
            </div>
          </div>

          {exportMessage ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {exportMessage}
            </div>
          ) : null}

          {accessMessage ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {accessMessage}
            </div>
          ) : null}
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600 shadow-sm">
            Loading shareholder access data from Enterprise Finance API…
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Shareholders" value={String(summary.shareholderCount)} helper="Shareholder registry rows returned by backend." tone="good" />
          <MetricCard label="Total shares" value={formatNumber(summary.totalShares)} helper="Total share count from visible registry rows." />
          <MetricCard label="Capital contributions" value={formatMoney(summary.capitalContributions)} helper="Shareholder investment/capital contribution total from registry fields." tone="good" />
          <MetricCard label="Active access grants" value={String(summary.activeAccessGrantCount)} helper="Shareholder portal grants that look active or enabled." />
          <MetricCard label="Pending access review" value={String(summary.pendingAccessCount)} helper="Registry rows that may need access review later." tone="warn" />
          <MetricCard label="Staff-shareholder users" value={String(summary.staffShareholderCount)} helper="Rows that look like staff-shareholder single-login candidates." />
          <MetricCard label="Selected for access review" value={String(summary.selectedCount)} helper="Rows selected for grant/revoke/permission update planning." />
          <MetricCard label="Portal posture" value="Read-only" helper="Shareholder portal access remains read-only by default." tone="good" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Shareholder filters</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Filter shareholder rows by holder type, portal role, access status or free-text search.
                </p>
              </div>
              <StatusPill>{filteredShareholders.length} visible row(s)</StatusPill>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2">
                <FieldLabel>Search</FieldLabel>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Shareholder, email, company, reference"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
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
                <FieldLabel>Access status</FieldLabel>
                <select
                  value={filters.accessStatus}
                  onChange={(event) => setFilters((current) => ({ ...current, accessStatus: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All access states</option>
                  {filterOptions.accessStatuses.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <FieldLabel>Portal role</FieldLabel>
                <select
                  value={filters.portalRole}
                  onChange={(event) => setFilters((current) => ({ ...current, portalRole: event.target.value }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="all">All portal roles</option>
                  {filterOptions.portalRoles.map((role) => (
                    <option key={role} value={role.toLowerCase()}>
                      {role}
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
                onClick={() => void loadShareholderData()}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh shareholder data
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Shareholder access/admin controls</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Prepare grant, revoke and portal permission update plans. Actual mutation remains reserved for future audited write endpoints with audit logs and idempotency keys.
            </p>

            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => copyShareholderAccessPlan(selectedShareholders, "grant")}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                Prepare access grant
              </button>
              <button
                type="button"
                onClick={() => copyShareholderAccessPlan(selectedShareholders, "revoke")}
                className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                Prepare access revoke
              </button>
              <button
                type="button"
                onClick={() => copyShareholderAccessPlan(selectedShareholders, "permission_update")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Prepare permission update
              </button>
              <button
                type="button"
                onClick={() => copyShareholderAccessPlan(filteredShareholders, "permission_update")}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Copy filtered permission plan
              </button>
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Shareholder registry access table</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Registry rows with shares, capital contribution, portal role, access status and access-review selection.
              </p>
            </div>
            <StatusPill>{selectedShareholders.length} selected row(s)</StatusPill>
          </div>

          <div className="grid gap-3">
            <ErrorNote message={errors.overview} />

            {filteredShareholders.length === 0 ? (
              <EmptyState message="No shareholder registry rows match the current filters." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {[
                          "Select",
                          "Shareholder",
                          "Holder type",
                          "Portal role",
                          "Access status",
                          "Shares",
                          "Capital contribution",
                          "Reference",
                          "Action",
                        ].map((heading) => (
                          <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredShareholders.map((holder, index) => {
                        const id = recordId(holder, String(index));
                        const selected = selectedIds.has(id);

                        return (
                          <tr key={`${id}-holder-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelected(holder, index)}
                                className="h-4 w-4 rounded border-slate-300"
                                aria-label={`Select shareholder ${id}`}
                              />
                            </td>
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
                              {textAt(holder, ["portalRole", "shareholderRole", "role"], "shareholder")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <StatusPill>
                                {textAt(holder, ["accessStatus", "portalAccessStatus", "status"], "pending")}
                              </StatusPill>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatNumber(numberAt(holder, ["shares", "shareCount", "ordinaryShares", "allocatedShares"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {formatMoney(amountAt(holder, ["capitalContribution", "investmentAmount", "amountInvested", "amountCents"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(holder, ["reference", "shareholderId", "id"], "—")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              <button
                                type="button"
                                onClick={() => setActiveShareholder(holder)}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                              >
                                Review access
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

        {activeShareholder ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Shareholder access review card</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Individual shareholder access snapshot before grant, revoke or permission update is persisted by future write endpoints.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyShareholderAccessPlan([activeShareholder], "grant")}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Copy grant plan
                </button>
                <button
                  type="button"
                  onClick={() => copyShareholderAccessPlan([activeShareholder], "revoke")}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  Copy revoke plan
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Shareholder"
                value={textAt(activeShareholder, ["shareholderName", "name", "legalName", "displayName"], "Shareholder")}
                helper={textAt(activeShareholder, ["email", "shareholderEmail"], "No email returned")}
              />
              <MetricCard
                label="Portal role"
                value={textAt(activeShareholder, ["portalRole", "shareholderRole", "role"], "shareholder")}
                helper="Current backend-provided portal role."
              />
              <MetricCard
                label="Access status"
                value={textAt(activeShareholder, ["accessStatus", "portalAccessStatus", "status"], "pending")}
                helper="Current access status from registry fields."
                tone="warn"
              />
              <MetricCard
                label="Reference"
                value={textAt(activeShareholder, ["reference", "shareholderId", "id"], "—")}
                helper="Reference used for audited future grant/revoke write paths."
              />
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Portal permission matrix</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Permission scopes for shareholder-only and staff-shareholder portal access. These are read-only by default and should be persisted by future audited permission endpoints.
            </p>

            <div className="mt-4 grid gap-3">
              {portalPermissionRows.map((row) => (
                <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-950">{row.label}</div>
                      <div className="mt-1 text-xs font-mono text-slate-500">{row.key}</div>
                    </div>
                    <StatusPill>{row.defaultAccess}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{row.notes}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Entitlement model</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              One-login, multi-entitlement model for shareholder-only users, staff-only users, staff-shareholder users and accountant/admin users.
            </p>

            <div className="mt-4 grid gap-3">
              {entitlementRows.map((row) => (
                <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-bold text-slate-950">{row.label}</div>
                    <StatusPill>{row.access}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{row.notes}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Access grants preview</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Existing shareholder access grant rows from the backend. Grant, revoke and permission mutation remains intentionally reserved for audited API write endpoints.
            </p>

            <div className="mt-4">
              {state.accessGrants.length === 0 ? (
                <EmptyState message="No shareholder access grant records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["User", "Scope", "Status", "Granted at", "Reference"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.accessGrants.slice(0, 10).map((grant, index) => (
                          <tr key={`${recordId(grant, String(index))}-grant-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(grant, ["userName", "shareholderName", "name", "email"], "Portal user")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(grant, ["scope", "portalRole", "role"], "shareholder")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(grant, ["status", "accessStatus", "grantStatus"], "active")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(grant, ["grantedAt", "createdAt", "updatedAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(grant, ["reference", "grantId", "id"], "—")}
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
            <h2 className="text-lg font-bold text-slate-950">Admin control boundaries</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Grant / revoke</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Grant and revoke actions are represented as accountant/admin review plans in this slice. Future API mutation should persist them with audit logs and idempotency keys.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Portal permission scope</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Portal permissions cover cap table snapshots, valuation snapshots, annual returns, AGM notices, announcements, share-sale notices and shareholder document downloads.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Ordinary shareholder boundary</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Ordinary shareholder users must not edit finance, payroll, commission, cap table, valuation, annual return, share transfer or shareholder access records.
                </p>
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Annual returns and shareholder documents</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Annual returns, shareholder packs, cap table reports and downloadable document controls for future shareholder portal surfaces.
            </p>

            <div className="mt-4">
              {state.documents.length === 0 ? (
                <EmptyState message="No annual return or shareholder document records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Document", "Type", "Published", "Visibility"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.documents.slice(0, 10).map((document, index) => (
                          <tr key={`${recordId(document, String(index))}-document-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {textAt(document, ["name", "title", "fileName"], "Shareholder document")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(document, ["type", "documentType", "category"], "document")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(document, ["publishedAt", "createdAt", "date"]))}
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">AGM notices and announcements</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              AGM notices, shareholder announcements, valuation notices and share-sale notices for later portal publication.
            </p>

            <div className="mt-4">
              {state.announcements.length === 0 ? (
                <EmptyState message="No AGM notice or shareholder announcement records returned yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Notice", "Type", "Date", "Status"].map((heading) => (
                            <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {state.announcements.slice(0, 10).map((announcement, index) => (
                          <tr key={`${recordId(announcement, String(index))}-notice-${index}`}>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                              {textAt(announcement, ["name", "title", "subject"], "Shareholder notice")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(announcement, ["type", "noticeType", "category"], "notice")}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {formatDate(valueAt(announcement, ["date", "publishedAt", "createdAt"]))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                              {textAt(announcement, ["status", "publicationStatus"], "draft")}
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
