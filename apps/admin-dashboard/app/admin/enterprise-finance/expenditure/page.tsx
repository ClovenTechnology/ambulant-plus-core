"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type JsonRecord = Record<string, unknown>;

type ExpenditureForm = {
  expenditureType: string;
  category: string;
  subcategory: string;
  amount: string;
  currency: string;
  vendorId: string;
  narration: string;
  description: string;
  occurredAt: string;
  externalReference: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentReference: string;
  companyBankAccountReference: string;
  invoiceUrl: string;
  proofOfPaymentUrl: string;
};

type SettlementForm = {
  paymentMethod: string;
  paymentReference: string;
  companyBankAccountReference: string;
  proofOfPaymentUrl: string;
  paidAt: string;
};

const initialForm: ExpenditureForm = {
  expenditureType: "operating_expense",
  category: "operations",
  subcategory: "",
  amount: "",
  currency: "ZAR",
  vendorId: "",
  narration: "",
  description: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  externalReference: "",
  paymentStatus: "unpaid",
  paymentMethod: "bank_transfer",
  paymentReference: "",
  companyBankAccountReference: "",
  invoiceUrl: "",
  proofOfPaymentUrl: "",
};

const initialSettlement: SettlementForm = {
  paymentMethod: "bank_transfer",
  paymentReference: "",
  companyBankAccountReference: "",
  proofOfPaymentUrl: "",
  paidAt: new Date().toISOString().slice(0, 10),
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayFrom(value: unknown, keys: string[]) {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];

  for (const key of keys) {
    if (Array.isArray(value[key])) return (value[key] as unknown[]).filter(isRecord);
  }

  return [];
}

function textAt(record: JsonRecord | null | undefined, keys: string[], fallback = "—") {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
    }
  }

  return fallback;
}

function moneyFromCents(value: unknown, currency = "ZAR") {
  const cents = Number(value || 0);
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(cents) ? cents / 100 : 0);
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

async function requestJson(
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `${response.status} ${response.statusText}`);
  }

  return payload as unknown;
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "danger";
}) {
  const classes =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

export default function ExpenditurePage() {
  const [entries, setEntries] = useState<JsonRecord[]>([]);
  const [vendors, setVendors] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<ExpenditureForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [settling, setSettling] = useState<JsonRecord | null>(null);
  const [settlement, setSettlement] = useState<SettlementForm>(initialSettlement);
  const [settlementBusy, setSettlementBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const [entriesResult, vendorsResult] = await Promise.allSettled([
      requestJson("/api/enterprise-finance/expenditure?limit=250"),
      requestJson("/api/enterprise-finance/vendors?limit=250"),
    ]);

    if (entriesResult.status === "fulfilled") {
      setEntries(arrayFrom(entriesResult.value, ["entries", "items", "rows"]));
    } else {
      setEntries([]);
      setLoadError(entriesResult.reason instanceof Error ? entriesResult.reason.message : "Unable to load expenditure.");
    }

    if (vendorsResult.status === "fulfilled") {
      setVendors(arrayFrom(vendorsResult.value, ["vendors", "items", "rows"]));
    } else {
      // Manual non-vendor expenditure remains usable when the vendor registry is unavailable.
      setVendors([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeVendors = useMemo(
    () =>
      vendors
        .filter((vendor) => textAt(vendor, ["status"], "").toLowerCase() === "active")
        .sort((a, b) =>
          textAt(a, ["tradingName", "registeredName", "legalName", "name"], "").localeCompare(
            textAt(b, ["tradingName", "registeredName", "legalName", "name"], ""),
          ),
        ),
    [vendors],
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();

    return entries.filter((entry) => {
      const rowStatus = textAt(entry, ["status"], "").toLowerCase();
      if (status !== "all" && rowStatus !== status) return false;
      if (!q) return true;

      return [
        textAt(entry, ["narration"], ""),
        textAt(entry, ["description"], ""),
        textAt(entry, ["vendorName"], ""),
        textAt(entry, ["category"], ""),
        textAt(entry, ["subcategory"], ""),
        textAt(entry, ["externalReference"], ""),
        textAt(entry, ["paymentReference"], ""),
        textAt(entry, ["id"], ""),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, search, status]);

  const selectedVendor = activeVendors.find(
    (vendor) => textAt(vendor, ["id"], "") === form.vendorId,
  );

  async function submitExpenditure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("Enter a valid positive expenditure amount.");
      return;
    }

    const recordingPaid = form.paymentStatus === "paid";
    if (
      recordingPaid &&
      !form.paymentReference.trim() &&
      !form.companyBankAccountReference.trim()
    ) {
      setNotice("Paid expenditure requires a payment or company-bank reference.");
      return;
    }

    if (recordingPaid && !form.proofOfPaymentUrl.trim()) {
      setNotice("Paid expenditure requires proof of payment.");
      return;
    }

    setSubmitting(true);

    try {
      await requestJson("/api/enterprise-finance/expenditure", {
        method: "POST",
        headers: {
          "Idempotency-Key": `admin-exp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        },
        body: JSON.stringify({
          action: recordingPaid ? "record_paid_expenditure" : "create_expenditure",
          expenditureType: form.expenditureType,
          category: form.category,
          subcategory: form.subcategory.trim() || null,
          amount,
          currency: form.currency,
          vendorId: form.vendorId || null,
          vendorName: selectedVendor
            ? textAt(selectedVendor, ["tradingName", "registeredName", "legalName", "name"], "")
            : null,
          narration: form.narration.trim(),
          description: form.description.trim() || null,
          occurredAt: form.occurredAt || undefined,
          externalReference: form.externalReference.trim() || null,
          paymentStatus: form.paymentStatus,
          paymentMethod: recordingPaid ? form.paymentMethod : null,
          paymentReference: recordingPaid ? form.paymentReference.trim() || null : null,
          companyBankAccountReference: recordingPaid
            ? form.companyBankAccountReference.trim() || null
            : null,
          invoiceUrl: form.invoiceUrl.trim() || null,
          proofOfPaymentUrl: recordingPaid ? form.proofOfPaymentUrl.trim() : null,
        }),
      });

      setForm(initialForm);
      setNotice("Expenditure recorded successfully.");
      await load();
    } catch (error) {
      setNotice(
        `Expenditure could not be recorded: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function approve(entry: JsonRecord) {
    const id = textAt(entry, ["id"], "");
    if (!id) return;
    setNotice("");

    try {
      await requestJson("/api/enterprise-finance/expenditure", {
        method: "PATCH",
        headers: {
          "Idempotency-Key": `admin-exp-approve-${id}-${Date.now()}`,
        },
        body: JSON.stringify({ action: "approve_expenditure", id }),
      });
      setNotice("Expenditure approved.");
      await load();
    } catch (error) {
      setNotice(
        `Expenditure could not be approved: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  async function recordSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settling) return;

    const id = textAt(settling, ["id"], "");
    if (!id) return;

    if (
      !settlement.paymentReference.trim() &&
      !settlement.companyBankAccountReference.trim()
    ) {
      setNotice("A payment or company-bank reference is required.");
      return;
    }

    if (!settlement.proofOfPaymentUrl.trim()) {
      setNotice("Proof of payment is required before marking expenditure paid.");
      return;
    }

    setSettlementBusy(true);
    setNotice("");

    try {
      await requestJson("/api/enterprise-finance/expenditure", {
        method: "PATCH",
        headers: {
          "Idempotency-Key": `admin-exp-paid-${id}-${Date.now()}`,
        },
        body: JSON.stringify({
          action: "mark_expenditure_paid",
          id,
          paymentMethod: settlement.paymentMethod,
          paymentReference: settlement.paymentReference.trim() || null,
          companyBankAccountReference:
            settlement.companyBankAccountReference.trim() || null,
          proofOfPaymentUrl: settlement.proofOfPaymentUrl.trim(),
          paidAt: settlement.paidAt || undefined,
        }),
      });

      setSettling(null);
      setSettlement(initialSettlement);
      setNotice("Expenditure marked paid with reconciliation evidence.");
      await load();
    } catch (error) {
      setNotice(
        `Payment could not be recorded: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    } finally {
      setSettlementBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="good">Enterprise Finance</StatusPill>
                <StatusPill>Expenditure authority</StatusPill>
                <StatusPill>Manual + vendor-linked</StatusPill>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Expenditure Ledger
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Capture operating expenditure directly, link approved vendors when appropriate,
                and preserve approval, payment-reference and proof-of-payment controls without
                using a raw JSON action console.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/enterprise-finance"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Finance command centre
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {notice}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Record expenditure</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Vendor is optional for ordinary internal expenditure. Select a registered vendor
              when the entry is supplier-bound.
            </p>

            <form onSubmit={submitExpenditure} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Expenditure type">
                <select
                  value={form.expenditureType}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, expenditureType: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
                >
                  <option value="operating_expense">Operating expense</option>
                  <option value="capital_expenditure">Capital expenditure</option>
                  <option value="professional_service">Professional service</option>
                  <option value="staff_expense">Staff expense</option>
                  <option value="tax_or_duty">Tax / duty</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Category">
                <input
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                  placeholder="operations"
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Subcategory">
                <input
                  value={form.subcategory}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subcategory: event.target.value }))
                  }
                  placeholder="Optional"
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Amount (ZAR)">
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  placeholder="0.00"
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Registered vendor">
                <select
                  value={form.vendorId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, vendorId: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
                >
                  <option value="">No vendor / internal expenditure</option>
                  {activeVendors.map((vendor) => {
                    const id = textAt(vendor, ["id"], "");
                    return (
                      <option key={id} value={id}>
                        {textAt(vendor, ["tradingName", "registeredName", "legalName", "name"], id)}
                      </option>
                    );
                  })}
                </select>
              </Field>

              <Field label="Date incurred">
                <input
                  type="date"
                  value={form.occurredAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, occurredAt: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Narration">
                <input
                  value={form.narration}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, narration: event.target.value }))
                  }
                  placeholder="What was this expenditure for?"
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="External reference">
                <input
                  value={form.externalReference}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, externalReference: event.target.value }))
                  }
                  placeholder="Invoice / order / external reference"
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </label>

              <Field label="Invoice / evidence URL">
                <input
                  value={form.invoiceUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, invoiceUrl: event.target.value }))
                  }
                  placeholder="Optional evidence URL"
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Payment state">
                <select
                  value={form.paymentStatus}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, paymentStatus: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
                >
                  <option value="unpaid">Unpaid / to be settled</option>
                  <option value="paid">Already paid</option>
                </select>
              </Field>

              {form.paymentStatus === "paid" ? (
                <>
                  <Field label="Payment method">
                    <select
                      value={form.paymentMethod}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, paymentMethod: event.target.value }))
                      }
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
                    >
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="paystack_transfer">Paystack transfer</option>
                      <option value="card">Card</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>

                  <Field label="Payment reference">
                    <input
                      value={form.paymentReference}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, paymentReference: event.target.value }))
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                    />
                  </Field>

                  <Field label="Company bank reference">
                    <input
                      value={form.companyBankAccountReference}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          companyBankAccountReference: event.target.value,
                        }))
                      }
                      placeholder="Optional if payment reference supplied"
                      className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                    />
                  </Field>

                  <Field label="Proof-of-payment URL">
                    <input
                      value={form.proofOfPaymentUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, proofOfPaymentUrl: event.target.value }))
                      }
                      placeholder="Required for paid entry"
                      className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                    />
                  </Field>
                </>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting ? "Recording…" : "Record expenditure"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Ledger</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredEntries.length} of {entries.length} record(s) visible.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search narration, vendor, reference"
                  className="min-w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="voided">Voided</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                Loading expenditure ledger…
              </div>
            ) : loadError ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Live expenditure data unavailable: {loadError}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No expenditure records match the current filters.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Date", "Narration", "Vendor", "Amount", "Payment", "Status", "Actions"].map((heading) => (
                        <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map((entry) => {
                      const id = textAt(entry, ["id"], "");
                      const rowStatus = textAt(entry, ["status"], "pending").toLowerCase();
                      const paymentStatus = textAt(entry, ["paymentStatus"], "unpaid").toLowerCase();
                      const currency = textAt(entry, ["currency"], "ZAR");

                      return (
                        <tr key={id}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {formatDate(entry.occurredAt)}
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            <div className="font-semibold text-slate-900">
                              {textAt(entry, ["narration"], "Expenditure")}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-400">
                              {textAt(entry, ["externalReference", "id"], id)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {textAt(entry, ["vendorName"], "Internal / no vendor")}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">
                            {moneyFromCents(entry.amountCents, currency)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusPill tone={paymentStatus === "paid" ? "good" : "warn"}>
                              {paymentStatus}
                            </StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusPill tone={rowStatus === "approved" ? "good" : rowStatus === "voided" ? "danger" : "neutral"}>
                              {rowStatus}
                            </StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex gap-2">
                              {rowStatus === "pending" ? (
                                <button
                                  type="button"
                                  onClick={() => void approve(entry)}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Approve
                                </button>
                              ) : null}
                              {paymentStatus !== "paid" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettling(entry);
                                    setSettlement(initialSettlement);
                                    setNotice("");
                                  }}
                                  className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                                >
                                  Record payment
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>

        {settling ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Record completed expenditure payment
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {textAt(settling, ["narration"], "Selected expenditure")} ·{" "}
                  {moneyFromCents(settling.amountCents, textAt(settling, ["currency"], "ZAR"))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettling(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={recordSettlement} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Payment method">
                <select
                  value={settlement.paymentMethod}
                  onChange={(event) =>
                    setSettlement((current) => ({ ...current, paymentMethod: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal"
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="paystack_transfer">Paystack transfer</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Payment reference">
                <input
                  value={settlement.paymentReference}
                  onChange={(event) =>
                    setSettlement((current) => ({
                      ...current,
                      paymentReference: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Company bank reference">
                <input
                  value={settlement.companyBankAccountReference}
                  onChange={(event) =>
                    setSettlement((current) => ({
                      ...current,
                      companyBankAccountReference: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Proof-of-payment URL">
                <input
                  value={settlement.proofOfPaymentUrl}
                  onChange={(event) =>
                    setSettlement((current) => ({
                      ...current,
                      proofOfPaymentUrl: event.target.value,
                    }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <Field label="Paid date">
                <input
                  type="date"
                  value={settlement.paidAt}
                  onChange={(event) =>
                    setSettlement((current) => ({ ...current, paidAt: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
              </Field>

              <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                <button
                  type="submit"
                  disabled={settlementBusy}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {settlementBusy ? "Recording…" : "Mark paid"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
