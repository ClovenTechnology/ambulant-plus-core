"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useMemo, useState } from "react";

type FieldType = "text" | "number" | "date" | "textarea" | "checkbox" | "select";

type FieldDef = {
  name: string;
  label: string;
  type?: FieldType;
  helper?: string;
  options?: string[];
};

type FormValues = Record<string, string | boolean>;

type SubmitState = {
  ok: boolean;
  message: string;
  detail?: string;
};

const CAP_TABLE_ENDPOINT = "/api/enterprise-finance/cap-table";
const SHAREHOLDERS_ENDPOINT = "/api/enterprise-finance/shareholders";

const ACTIONS = {
  snapshot: "create_snapshot",
  valuation: "create_valuation",
  shareSaleNotice: "create_share_sale_notice",
  shareClass: "create_share_class",
};

function apiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function asNumber(value: FormValues[string]) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const parsed = Number(String(value || "").replace(/,/g, ""));

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function asCents(value: FormValues[string]) {
  return Math.round(asNumber(value) * 100);
}

function asText(value: FormValues[string]) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value || "").trim();
}

function idempotencyKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postJson(path: string, body: Record<string, unknown>, keyPrefix: string): Promise<SubmitState> {
  try {
    const response = await fetch(apiPath(path), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey(keyPrefix),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let payload: unknown = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      return {
        ok: false,
        message: `${response.status} ${response.statusText}`,
        detail: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      };
    }

    return {
      ok: true,
      message: "Saved successfully through Enterprise Finance API.",
      detail: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Request failed",
    };
  }
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

function ResultNote({ result }: { result: SubmitState | null }) {
  if (!result) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        result.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      <div className="font-bold">{result.message}</div>
      {result.detail ? (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-xs">
          {result.detail}
        </pre>
      ) : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | boolean;
  onChange: (name: string, value: string | boolean) => void;
}) {
  const type = field.type || "text";

  if (type === "textarea") {
    return (
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">{field.label}</span>
        <textarea
          value={String(value || "")}
          onChange={(event) => onChange(field.name, event.target.value)}
          className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
        />
        {field.helper ? <span className="text-xs leading-5 text-slate-500">{field.helper}</span> : null}
      </label>
    );
  }

  if (type === "checkbox") {
    return (
      <label className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(field.name, event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-700">{field.label}</span>
          {field.helper ? <span className="block text-xs leading-5 text-slate-500">{field.helper}</span> : null}
        </span>
      </label>
    );
  }

  if (type === "select") {
    return (
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-slate-700">{field.label}</span>
        <select
          value={String(value || "")}
          onChange={(event) => onChange(field.name, event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
        >
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {field.helper ? <span className="text-xs leading-5 text-slate-500">{field.helper}</span> : null}
      </label>
    );
  }

  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700">{field.label}</span>
      <input
        type={type}
        value={String(value || "")}
        onChange={(event) => onChange(field.name, event.target.value)}
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
      />
      {field.helper ? <span className="text-xs leading-5 text-slate-500">{field.helper}</span> : null}
    </label>
  );
}

function FormCard({
  title,
  subtitle,
  badge,
  endpoint,
  action,
  fields,
  initialValues,
  buildPayload,
  keyPrefix,
}: {
  title: string;
  subtitle: string;
  badge: string;
  endpoint: string;
  action?: string;
  fields: FieldDef[];
  initialValues: FormValues;
  buildPayload: (values: FormValues) => Record<string, unknown>;
  keyPrefix: string;
}) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [result, setResult] = useState<SubmitState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payloadCopied, setPayloadCopied] = useState(false);

  const previewPayload = useMemo(() => buildPayload(values), [buildPayload, values]);

  function onChange(name: string, value: string | boolean) {
    setPayloadCopied(false);
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setPayloadCopied(false);

    const nextResult = await postJson(endpoint, previewPayload, keyPrefix);
    setResult(nextResult);
    setSubmitting(false);
  }

  async function copyPayload() {
    setPayloadCopied(false);

    if (!navigator.clipboard) {
      setResult({
        ok: false,
        message: "Clipboard is not available in this browser.",
      });
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(previewPayload, null, 2));
    setPayloadCopied(true);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusPill>{badge}</StatusPill>
            {action ? <StatusPill tone="good">action: {action}</StatusPill> : <StatusPill tone="good">direct POST</StatusPill>}
          </div>
          <h2 className="mt-3 text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map((field) => (
            <FieldInput key={field.name} field={field} value={values[field.name] ?? ""} onChange={onChange} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save to Enterprise Finance"}
          </button>

          <button
            type="button"
            onClick={copyPayload}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Copy JSON payload
          </button>

          <button
            type="button"
            onClick={() => {
              setValues(initialValues);
              setResult(null);
              setPayloadCopied(false);
            }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Reset form
          </button>
        </div>
      </form>

      {payloadCopied ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          JSON payload copied for accountant review or API troubleshooting.
        </div>
      ) : null}

      <div className="mt-4">
        <ResultNote result={result} />
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-bold text-slate-700">Preview request payload</summary>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
          {JSON.stringify(previewPayload, null, 2)}
        </pre>
      </details>
    </section>
  );
}

const snapshotFields: FieldDef[] = [
  { name: "label", label: "Snapshot label", helper: "Example: Founder baseline, Seed round post-money, Q1 cap table." },
  { name: "snapshotDate", label: "Snapshot date", type: "date" },
  { name: "authorisedShares", label: "Authorised shares", type: "number" },
  { name: "issuedShares", label: "Issued shares", type: "number" },
  { name: "allocatedShares", label: "Allocated shares", type: "number" },
  { name: "unallocatedShares", label: "Unallocated shares", type: "number" },
  { name: "fullyDilutedShares", label: "Fully diluted shares", type: "number" },
  { name: "currency", label: "Currency", type: "select", options: ["ZAR", "GBP", "USD"] },
  { name: "publishedToShareholders", label: "Publish read-only snapshot to shareholders", type: "checkbox" },
  { name: "notes", label: "Accountant notes", type: "textarea", helper: "Internal audit context, board approval note, or source document reference." },
];

const shareClassFields: FieldDef[] = [
  { name: "name", label: "Share class name", helper: "Example: Ordinary shares, Preference A." },
  { name: "code", label: "Class code", helper: "Example: ORD, PREF-A." },
  { name: "authorisedShares", label: "Authorised shares", type: "number" },
  { name: "issuedShares", label: "Issued shares", type: "number" },
  { name: "parValue", label: "Par value / nominal value", type: "number" },
  { name: "currency", label: "Currency", type: "select", options: ["ZAR", "GBP", "USD"] },
  { name: "votingRights", label: "Voting rights", helper: "Example: 1 vote per share, non-voting." },
  { name: "dividendRights", label: "Dividend rights", helper: "Example: pari passu, fixed preference." },
  { name: "liquidationPreference", label: "Liquidation preference", helper: "Example: none, 1x non-participating." },
  { name: "transferRestrictions", label: "Transfer restrictions", type: "textarea", helper: "Pre-emption, board approval, lock-up, ROFR, etc." },
  { name: "active", label: "Share class active", type: "checkbox" },
];

const shareholderFields: FieldDef[] = [
  { name: "legalName", label: "Legal shareholder name" },
  { name: "displayName", label: "Display name" },
  { name: "email", label: "Email" },
  { name: "shareholderType", label: "Holder type", type: "select", options: ["individual", "company", "trust", "staff", "founder", "investor"] },
  { name: "investorStatus", label: "Investor status", type: "select", options: ["active", "approved", "pending_review", "archived"] },
  { name: "shares", label: "Shares held", type: "number" },
  { name: "shareClassId", label: "Share class ID/reference", helper: "Use the actual ShareClass ID when available." },
  { name: "capitalContribution", label: "Capital contribution amount", type: "number" },
  { name: "reference", label: "Shareholder reference / certificate number" },
  { name: "portalEnabled", label: "Enable shareholder portal posture", type: "checkbox" },
  { name: "staffShareholder", label: "Staff-shareholder single-login candidate", type: "checkbox" },
  { name: "notes", label: "Accountant notes", type: "textarea" },
];

const valuationFields: FieldDef[] = [
  { name: "label", label: "Valuation label" },
  { name: "valuationDate", label: "Valuation date", type: "date" },
  { name: "valuationType", label: "Valuation type", type: "select", options: ["internal", "external", "fundraise", "board_approved", "409a_like", "other"] },
  { name: "preMoneyValuation", label: "Pre-money valuation", type: "number" },
  { name: "postMoneyValuation", label: "Post-money valuation", type: "number" },
  { name: "currency", label: "Currency", type: "select", options: ["ZAR", "GBP", "USD"] },
  { name: "publishedToShareholders", label: "Publish valuation snapshot to shareholders", type: "checkbox" },
  { name: "notes", label: "Valuation notes", type: "textarea" },
];

const shareSaleFields: FieldDef[] = [
  { name: "title", label: "Notice title" },
  { name: "sellerShareholderId", label: "Seller shareholder ID/reference" },
  { name: "shareClassId", label: "Share class ID/reference" },
  { name: "sharesOffered", label: "Shares offered", type: "number" },
  { name: "askingPrice", label: "Asking price / consideration", type: "number" },
  { name: "currency", label: "Currency", type: "select", options: ["ZAR", "GBP", "USD"] },
  { name: "noticeStatus", label: "Notice status", type: "select", options: ["draft", "pending_review", "approved", "published", "withdrawn"] },
  { name: "visibleToShareholders", label: "Visible to shareholders", type: "checkbox" },
  { name: "notes", label: "Notice notes", type: "textarea" },
];

export default function EnterpriseFinanceCapTableInputPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="good">Enterprise Finance</StatusPill>
                <StatusPill tone="good">Accountant cap table input</StatusPill>
                <StatusPill>Source-of-truth management</StatusPill>
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Cap Table Data Input and Accountant Source-of-Truth Management
              </h1>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                This is the accountant/admin input surface for feeding cap table data into Enterprise Finance.
                It uses the existing audited backend write routes where available, sends credentialed POST requests,
                includes an idempotency key, and keeps ordinary shareholder users on a read-only portal boundary.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link
                href="/admin/enterprise-finance/cap-table"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to cap table view
              </Link>
              <Link
                href="/admin/enterprise-finance/shareholders"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Open shareholder registry
              </Link>
              <Link
                href="/admin/enterprise-finance"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to command centre
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Write boundary</div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Accountant/Admin</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              Backend route should enforce requireEnterpriseFinanceAdmin and audit logging.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Portal posture</div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Read-only</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              Published snapshots can be visible to shareholders without mutation rights.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Idempotency</div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Header sent</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              Each write request includes an Idempotency-Key for later backend hardening.
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Input coverage</div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Core cap table</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">
              Snapshot, share class, shareholder, valuation and share-sale notice entry.
            </div>
          </div>
        </section>

        <FormCard
          title="Company equity baseline / cap table snapshot"
          subtitle="Feed authorised shares, issued shares, allocated/unallocated shares and fully diluted shares as an auditable cap table snapshot."
          badge="CapTableSnapshot"
          endpoint={CAP_TABLE_ENDPOINT}
          action={ACTIONS.snapshot}
          keyPrefix="cap-table-snapshot"
          fields={snapshotFields}
          initialValues={{
            label: "Current cap table baseline",
            snapshotDate: new Date().toISOString().slice(0, 10),
            authorisedShares: "",
            issuedShares: "",
            allocatedShares: "",
            unallocatedShares: "",
            fullyDilutedShares: "",
            currency: "ZAR",
            publishedToShareholders: false,
            notes: "",
          }}
          buildPayload={(values) => ({
            action: ACTIONS.snapshot,
            label: asText(values.label),
            snapshotDate: asText(values.snapshotDate),
            authorisedShares: asNumber(values.authorisedShares),
            issuedShares: asNumber(values.issuedShares),
            allocatedShares: asNumber(values.allocatedShares),
            unallocatedShares: asNumber(values.unallocatedShares),
            fullyDilutedShares: asNumber(values.fullyDilutedShares),
            currency: asText(values.currency),
            publishedToShareholders: Boolean(values.publishedToShareholders),
            snapshotMeta: {
              source: "admin_cap_table_input",
              accountantSourceOfTruth: true,
              notes: asText(values.notes),
            },
          })}
        />

        <FormCard
          title="Share class input"
          subtitle="Create or seed ordinary/preference share classes with rights, restrictions, issued shares and nominal/par value data."
          badge="ShareClass"
          endpoint={CAP_TABLE_ENDPOINT}
          action={ACTIONS.shareClass}
          keyPrefix="share-class"
          fields={shareClassFields}
          initialValues={{
            name: "Ordinary shares",
            code: "ORD",
            authorisedShares: "",
            issuedShares: "",
            parValue: "",
            currency: "ZAR",
            votingRights: "1 vote per share",
            dividendRights: "pari passu",
            liquidationPreference: "none",
            transferRestrictions: "",
            active: true,
          }}
          buildPayload={(values) => ({
            action: ACTIONS.shareClass,
            name: asText(values.name),
            code: asText(values.code),
            authorisedShares: asNumber(values.authorisedShares),
            issuedShares: asNumber(values.issuedShares),
            parValueCents: asCents(values.parValue),
            currency: asText(values.currency),
            votingRights: asText(values.votingRights),
            dividendRights: asText(values.dividendRights),
            liquidationPreference: asText(values.liquidationPreference),
            transferRestrictions: asText(values.transferRestrictions),
            active: Boolean(values.active),
            shareClassMeta: {
              source: "admin_cap_table_input",
              accountantSourceOfTruth: true,
            },
          })}
        />

        <FormCard
          title="Shareholder registry input"
          subtitle="Create source-of-truth shareholder rows, including shareholder-only users, staff-shareholder candidates, share counts, contribution values and certificate/reference numbers."
          badge="Shareholder"
          endpoint={SHAREHOLDERS_ENDPOINT}
          keyPrefix="shareholder"
          fields={shareholderFields}
          initialValues={{
            legalName: "",
            displayName: "",
            email: "",
            shareholderType: "individual",
            investorStatus: "active",
            shares: "",
            shareClassId: "",
            capitalContribution: "",
            reference: "",
            portalEnabled: false,
            staffShareholder: false,
            notes: "",
          }}
          buildPayload={(values) => ({
            legalName: asText(values.legalName),
            displayName: asText(values.displayName) || asText(values.legalName),
            email: asText(values.email),
            shareholderType: asText(values.shareholderType),
            investorStatus: asText(values.investorStatus),
            shares: asNumber(values.shares),
            shareCount: asNumber(values.shares),
            shareClassId: asText(values.shareClassId) || null,
            capitalContributionCents: asCents(values.capitalContribution),
            reference: asText(values.reference),
            portalEnabled: Boolean(values.portalEnabled),
            staffShareholder: Boolean(values.staffShareholder),
            shareholderMeta: {
              source: "admin_cap_table_input",
              accountantSourceOfTruth: true,
              staffShareholder: Boolean(values.staffShareholder),
              notes: asText(values.notes),
            },
          })}
        />

        <FormCard
          title="Valuation snapshot input"
          subtitle="Record valuation snapshots for board, investor, fundraise or internal reporting use, with optional shareholder publication."
          badge="CompanyValuationSnapshot"
          endpoint={CAP_TABLE_ENDPOINT}
          action={ACTIONS.valuation}
          keyPrefix="valuation"
          fields={valuationFields}
          initialValues={{
            label: "Internal valuation snapshot",
            valuationDate: new Date().toISOString().slice(0, 10),
            valuationType: "internal",
            preMoneyValuation: "",
            postMoneyValuation: "",
            currency: "ZAR",
            publishedToShareholders: false,
            notes: "",
          }}
          buildPayload={(values) => ({
            action: ACTIONS.valuation,
            label: asText(values.label),
            valuationDate: asText(values.valuationDate),
            valuationType: asText(values.valuationType),
            currency: asText(values.currency),
            preMoneyValuationCents: asCents(values.preMoneyValuation),
            postMoneyValuationCents: asCents(values.postMoneyValuation),
            publishedToShareholders: Boolean(values.publishedToShareholders),
            valuationMeta: {
              source: "admin_cap_table_input",
              accountantSourceOfTruth: true,
              notes: asText(values.notes),
            },
          })}
        />

        <FormCard
          title="Share-sale notice input"
          subtitle="Record share-sale notices, seller references, shares offered, asking price, status and shareholder visibility."
          badge="ShareSaleNotice"
          endpoint={CAP_TABLE_ENDPOINT}
          action={ACTIONS.shareSaleNotice}
          keyPrefix="share-sale-notice"
          fields={shareSaleFields}
          initialValues={{
            title: "Share-sale notice",
            sellerShareholderId: "",
            shareClassId: "",
            sharesOffered: "",
            askingPrice: "",
            currency: "ZAR",
            noticeStatus: "draft",
            visibleToShareholders: false,
            notes: "",
          }}
          buildPayload={(values) => ({
            action: ACTIONS.shareSaleNotice,
            title: asText(values.title),
            sellerShareholderId: asText(values.sellerShareholderId) || null,
            shareClassId: asText(values.shareClassId) || null,
            sharesOffered: asNumber(values.sharesOffered),
            askingPriceCents: asCents(values.askingPrice),
            currency: asText(values.currency),
            noticeStatus: asText(values.noticeStatus),
            visibleToShareholders: Boolean(values.visibleToShareholders),
            noticeMeta: {
              source: "admin_cap_table_input",
              accountantSourceOfTruth: true,
              notes: asText(values.notes),
            },
          })}
        />

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="warn">Backend follow-up</StatusPill>
            <StatusPill>Archive/void and edit paths</StatusPill>
          </div>
          <h2 className="mt-3 text-lg font-bold text-amber-950">Remaining cap table write-path hardening</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            This page gives the accountant/admin a real input surface for existing create paths. The next backend hardening
            slice should add explicit edit, archive/void, allocation, investment-round, share-transfer, annual-return and
            shareholder-document write paths where the API does not already expose them. ordinary shareholder users must
            remain unable to mutate finance, payroll, commission, cap table, valuation, annual return, share transfer or
            shareholder access records.
          </p>
        </section>
      </div>
    </main>
  );
}

