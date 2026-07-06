"use client";

import { useEffect, useMemo, useState } from "react";

type Claim = {
  id: string;
  claimNumber: string;
  orgId: string;
  clientId?: string | null;
  clientMemberId?: string | null;
  patientSponsorLinkId?: string | null;
  patientId: string;
  userId?: string | null;
  appointmentId?: string | null;
  encounterId?: string | null;
  paymentRef?: string | null;
  originalPaymentMethod?: string | null;
  providerAlreadyPaid?: boolean | null;
  status: string;
  reason?: string | null;
  currency?: string | null;
  requestedAmountMinor: number;
  approvedAmountMinor: number;
  paidAmountMinor: number;
  memberResponsibilityMinor?: number;
  policySnapshot?: any;
  appointmentSnapshot?: any;
  evidenceJson?: any;
  reviewPayload?: any;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  paidAt?: string | null;
  remittanceRef?: string | null;
};

function money(value: unknown, currency = "ZAR") {
  const n = Number(value || 0) / 100;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(n);
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function statusTone(status?: string) {
  const s = String(status || "").toUpperCase();

  if (s === "PAID") return "bg-emerald-950 border-emerald-700 text-emerald-200";
  if (s === "APPROVED" || s === "PARTIALLY_APPROVED" || s === "READY_FOR_PAYMENT") {
    return "bg-sky-950 border-sky-700 text-sky-200";
  }
  if (s === "SUBMITTED" || s === "UNDER_REVIEW" || s === "REQUEST_INFO") {
    return "bg-amber-950 border-amber-700 text-amber-200";
  }
  if (s === "DENIED" || s === "CANCELLED") return "bg-rose-950 border-rose-700 text-rose-200";

  return "bg-slate-800 border-slate-700 text-slate-200";
}

function normalizeItems(payload: any): Claim[] {
  return Array.isArray(payload?.items) ? payload.items : [];
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-700 bg-emerald-950/60 text-emerald-100 hover:bg-emerald-900"
      : tone === "warn"
      ? "border-amber-700 bg-amber-950/60 text-amber-100 hover:bg-amber-900"
      : tone === "bad"
      ? "border-rose-700 bg-rose-950/60 text-rose-100 hover:bg-rose-900"
      : "border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export default function MemberReimbursementsPage() {
  const [items, setItems] = useState<Claim[]>([]);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const params = new URLSearchParams({
        limit: "200",
      });

      if (status) params.set("status", status);

      const res = await fetch(`/api/member-reimbursement-claims?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Could not load reimbursement queue.");
      }

      setItems(normalizeItems(data));
    } catch (e: any) {
      setErr(e?.message || "Could not load reimbursement queue.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateClaim(
    claim: Claim,
    nextStatus: string,
    extras: Record<string, any> = {},
  ) {
    setBusyId(claim.id);

    try {
      const res = await fetch("/api/member-reimbursement-claims", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: claim.id,
          status: nextStatus,
          ...extras,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Could not update claim.");
      }

      await load();
    } catch (e: any) {
      alert(e?.message || "Could not update claim.");
    } finally {
      setBusyId("");
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  const summary = useMemo(() => {
    const submitted = items.filter((x) => x.status === "SUBMITTED").length;
    const review = items.filter((x) => x.status === "UNDER_REVIEW").length;
    const info = items.filter((x) => x.status === "REQUEST_INFO").length;
    const approved = items.filter((x) =>
      ["APPROVED", "PARTIALLY_APPROVED", "READY_FOR_PAYMENT"].includes(x.status),
    ).length;
    const paid = items.filter((x) => x.status === "PAID").length;

    const requested = items.reduce((sum, x) => sum + Number(x.requestedAmountMinor || 0), 0);
    const approvedAmount = items.reduce((sum, x) => sum + Number(x.approvedAmountMinor || 0), 0);
    const paidAmount = items.reduce((sum, x) => sum + Number(x.paidAmountMinor || 0), 0);

    return { submitted, review, info, approved, paid, requested, approvedAmount, paidAmount };
  }, [items]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
            PayerOps member reimbursement
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Member Reimbursement Queue
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
            Review patient-submitted claim-back requests for card-paid services. This lane is separate from provider claims and does not affect clinician payout.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Claims loaded</div>
            <div className="mt-2 text-3xl font-semibold">{items.length}</div>
            <div className="mt-1 text-xs text-slate-500">
              {summary.submitted} submitted · {summary.review} under review
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Requested</div>
            <div className="mt-2 text-3xl font-semibold">{money(summary.requested)}</div>
            <div className="mt-1 text-xs text-slate-500">Patient-paid reimbursement exposure</div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Approved</div>
            <div className="mt-2 text-3xl font-semibold">{money(summary.approvedAmount)}</div>
            <div className="mt-1 text-xs text-slate-500">
              {summary.approved} approved / ready
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-xs text-slate-400">Paid</div>
            <div className="mt-2 text-3xl font-semibold">{money(summary.paidAmount)}</div>
            <div className="mt-1 text-xs text-slate-500">{summary.paid} remitted</div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 md:flex-row md:items-center md:justify-between">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="REQUEST_INFO">Request info</option>
            <option value="APPROVED">Approved</option>
            <option value="PARTIALLY_APPROVED">Partially approved</option>
            <option value="READY_FOR_PAYMENT">Ready for payment</option>
            <option value="PAID">Paid</option>
            <option value="DENIED">Denied</option>
          </select>

          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </section>

        {err ? (
          <div className="rounded-2xl border border-rose-800 bg-rose-950/50 p-4 text-sm text-rose-100">
            {err}
          </div>
        ) : null}

        <section className="space-y-4">
          {items.length === 0 && !loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
              No member reimbursement claims found yet.
            </div>
          ) : null}

          {items.map((claim) => {
            const busy = busyId === claim.id;
            const currency = claim.currency || "ZAR";
            const policy = claim.policySnapshot || {};
            const appt = claim.appointmentSnapshot || {};
            const evidence = claim.evidenceJson || {};
            const evidenceFiles = Array.isArray(evidence.files)
              ? evidence.files
              : Array.isArray(evidence.evidenceFiles)
              ? evidence.evidenceFiles
              : [];

            return (
              <article key={claim.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{claim.claimNumber}</h2>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(claim.status)}`}>
                        {claim.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      Patient: {claim.patientId} · Appointment: {claim.appointmentId || "—"} · Encounter: {claim.encounterId || "—"}
                      <br />
                      Submitted: {fmtDate(claim.submittedAt)} · Payment ref: {claim.paymentRef || "—"}
                    </div>
                  </div>

                  <div className="grid min-w-[280px] gap-2 text-sm">
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Requested</div>
                      <div className="font-semibold">{money(claim.requestedAmountMinor, currency)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Approved</div>
                      <div className="font-semibold">{money(claim.approvedAmountMinor, currency)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <div className="text-xs text-slate-500">Paid</div>
                      <div className="font-semibold">{money(claim.paidAmountMinor, currency)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                    <div className="font-semibold text-slate-100">Policy evidence</div>
                    <div className="mt-2 space-y-1">
                      <div>Client: {claim.clientId || policy?.clientId || "—"}</div>
                      <div>Policy link: {claim.patientSponsorLinkId || policy?.patientSponsorLinkId || "—"}</div>
                      <div>Sponsor decision: {policy?.sponsor?.decision || "—"}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                    <div className="font-semibold text-slate-100">Appointment evidence</div>
                    <div className="mt-2 space-y-1">
                      <div>Clinician: {appt?.clinicianId || "—"}</div>
                      <div>Payment method: {appt?.paymentMethod || "CARD"}</div>
                      <div>Payment status: {appt?.paymentStatus || "—"}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300 md:col-span-2">
                    <div className="font-semibold text-slate-100">Uploaded reimbursement evidence</div>

                    {evidenceFiles.length === 0 ? (
                      <div className="mt-2 text-slate-500">
                        No member-uploaded proof of payment, invoice, statement, or supporting document has been attached yet.
                      </div>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {evidenceFiles.map((file: any, idx: number) => (
                          <div
                            key={`${file.sha256 || file.hash || file.fileName || idx}`}
                            className="rounded-lg border border-slate-800 bg-slate-900 p-2"
                          >
                            <div className="font-semibold text-slate-100">
                              {file.originalName || file.fileName || file.name || `Evidence ${idx + 1}`}
                            </div>
                            <div className="mt-1 text-slate-400">
                              Type: {file.mimeType || file.type || "—"} · Size:{" "}
                              {file.sizeBytes ? `${Math.round(Number(file.sizeBytes) / 1024)} KB` : "—"}
                            </div>
                            <div className="mt-1 break-all text-slate-500">
                              SHA-256: {file.sha256 || file.hash || "—"}
                            </div>
                            <div className="mt-1 text-slate-500">
                              Uploaded: {fmtDate(file.uploadedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {claim.reason ? (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
                    Reason: {claim.reason}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    disabled={busy}
                    onClick={() => updateClaim(claim, "UNDER_REVIEW")}
                  >
                    Start review
                  </ActionButton>

                  <ActionButton
                    disabled={busy}
                    tone="warn"
                    onClick={() => {
                      const reason = window.prompt("Information required from member?", "Please upload proof of payment / invoice.");
                      if (reason === null) return;
                      void updateClaim(claim, "REQUEST_INFO", { reason });
                    }}
                  >
                    Request info
                  </ActionButton>

                  <ActionButton
                    disabled={busy}
                    tone="good"
                    onClick={() =>
                      updateClaim(claim, "APPROVED", {
                        approvedAmountMinor: claim.requestedAmountMinor,
                        reason: "Approved for reimbursement.",
                      })
                    }
                  >
                    Approve full
                  </ActionButton>

                  <ActionButton
                    disabled={busy}
                    tone="good"
                    onClick={() => {
                      const raw = window.prompt(
                        "Approved amount in cents/minor units",
                        String(claim.requestedAmountMinor),
                      );
                      if (raw === null) return;
                      const approvedAmountMinor = Math.max(0, Math.round(Number(raw || 0)));
                      if (!Number.isFinite(approvedAmountMinor)) return;
                      void updateClaim(claim, "PARTIALLY_APPROVED", {
                        approvedAmountMinor,
                        reason: "Partially approved after benefit review.",
                      });
                    }}
                  >
                    Partial approve
                  </ActionButton>

                  <ActionButton
                    disabled={busy}
                    tone="bad"
                    onClick={() => {
                      const reason = window.prompt("Denial reason", "Not eligible for reimbursement.");
                      if (reason === null) return;
                      void updateClaim(claim, "DENIED", { reason });
                    }}
                  >
                    Deny
                  </ActionButton>

                  <ActionButton
                    disabled={busy}
                    tone="good"
                    onClick={() => {
                      const ref = window.prompt("Remittance/payment reference", `MR-PAY-${Date.now()}`);
                      if (ref === null) return;
                      const amount = claim.approvedAmountMinor || claim.requestedAmountMinor;
                      void updateClaim(claim, "PAID", {
                        paidAmountMinor: amount,
                        approvedAmountMinor: claim.approvedAmountMinor || amount,
                        remittanceRef: ref,
                        reason: "Marked paid/remitted.",
                      });
                    }}
                  >
                    Mark paid
                  </ActionButton>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}