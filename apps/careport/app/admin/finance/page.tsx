"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

function money(cents: number, currency = "ZAR") {
  return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartYmd() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export default function CarePortAdminFinancePage() {
  const [from, setFrom] = useState(monthStartYmd());
  const [to, setTo] = useState(todayYmd());
  const [includePaid, setIncludePaid] = useState(false);
  const [payload, setPayload] = useState<any>(null);
  const [policyPayload, setPolicyPayload] = useState<any>(null);
  const [policy, setPolicy] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currency = payload?.policy?.policy?.currency || policy?.currency || "ZAR";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      if (includePaid) qs.set("includePaid", "1");

      const [financeRes, policyRes] = await Promise.all([
        fetch(`/api/careport/admin/finance?${qs.toString()}`, { cache: "no-store" }),
        fetch("/api/careport/admin/commercial-policy", { cache: "no-store" }),
      ]);

      const finance = await financeRes.json().catch(() => ({}));
      const pol = await policyRes.json().catch(() => ({}));

      if (!financeRes.ok || !finance?.ok) throw new Error(finance?.error || `finance_http_${financeRes.status}`);
      setPayload(finance);
      setPolicyPayload(pol);
      setPolicy(pol?.policy || finance?.policy?.policy || {});
    } catch (err: any) {
      setError(humanErrorMessage(err, "Unable to load CarePort finance."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const fields = useMemo(() => [
    ["platformCommissionBps", "Platform commission, bps"],
    ["paymentProviderFeeBps", "Payment provider fee, bps"],
    ["paymentProviderFixedFeeCents", "Payment provider fixed fee, cents"],
    ["pharmacyMonthlyPlatformFeeCents", "Monthly pharmacy platform fee, cents"],
    ["pharmacyInventoryHostingFeeCents", "Inventory hosting fee, cents"],
    ["riderDeliveryShareBps", "Rider delivery share, bps"],
    ["pharmacyOnboardingFeeCents", "One-off pharmacy onboarding fee, cents"],
    ["pharmacyPayoutHoldDays", "Pharmacy payout hold days"],
    ["riderPayoutHoldDays", "Rider payout hold days"],
  ], []);

  async function savePolicy() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/careport/admin/commercial-policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ policy }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(humanErrorMessage(js?.message || js?.error, `policy_http_${res.status}`));
      setMessage("Commercial policy saved.");
      await load();
    } catch (err: any) {
      setError(humanErrorMessage(err, "Could not save commercial policy."));
    } finally {
      setBusy(false);
    }
  }

  async function generatePayouts(dryRun: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/careport/admin/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, includePaid, dryRun }),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(humanErrorMessage(js?.error, `settlement_http_${res.status}`));
      setPayload(js);
      setMessage(dryRun ? "Settlement preview refreshed." : `Payout batch generated for ${js?.payouts?.length || 0} recipients.`);
    } catch (err: any) {
      setError(humanErrorMessage(err, "Could not generate payout batch."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">CarePort finance</p>
          <h1 className="text-2xl font-semibold text-slate-950">Commercial policy, settlements and payouts</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Configure pharmacy fees, payment-provider treatment, platform commission, rider payout share, and generate pharmacy/rider payout batches.
          </p>
        </div>
        <Link href="/admin" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Admin home</Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{humanErrorMessage(message, "Request completed.")}</div>}

      {policyPayload?.persistence === "missing_model" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Commercial policy is currently using defaults because the CarePortOperationalSetting model is not configured yet. Add the schema model before saving settings persistently.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Orders", payload?.summary?.orders || 0],
          ["Gross", money(payload?.summary?.grossCents || 0, currency)],
          ["Platform fees", money(payload?.summary?.platformFeesCents || 0, currency)],
          ["Rider payout", money(payload?.summary?.riderPayoutCents || 0, currency)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Commercial policy</h2>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">Currency<input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={policy.currency || "ZAR"} onChange={(e) => setPolicy((p: any) => ({ ...p, currency: e.target.value.toUpperCase().slice(0, 3) }))} /></label>
              <label className="text-xs text-slate-500">Settlement cycle<select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={policy.settlementCycle || "monthly"} onChange={(e) => setPolicy((p: any) => ({ ...p, settlementCycle: e.target.value }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            </div>
            {fields.map(([key, label]) => (
              <label key={key} className="text-xs text-slate-500">
                {label}
                <input
                  type="number"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  value={policy[key] ?? 0}
                  onChange={(e) => setPolicy((p: any) => ({ ...p, [key]: Number(e.target.value || 0) }))}
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={Boolean(policy.passPaymentProviderFeeToPharmacy)} onChange={(e) => setPolicy((p: any) => ({ ...p, passPaymentProviderFeeToPharmacy: e.target.checked }))} />
              Deduct payment-provider fees from pharmacy payout
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={policy.medicalAidEnabled !== false} onChange={(e) => setPolicy((p: any) => ({ ...p, medicalAidEnabled: e.target.checked }))} />
              Enable medical-aid/sponsor payment path
            </label>
            <button disabled={busy} onClick={() => void savePolicy()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {busy ? "Saving…" : "Save commercial policy"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Settlement preview</h2>
              <p className="mt-1 text-xs text-slate-500">Only completed/delivered orders are payout-eligible unless “include paid” is enabled.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input type="date" className="rounded-xl border px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className="rounded-xl border px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
              <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={() => void load()}>Load</button>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={includePaid} onChange={(e) => setIncludePaid(e.target.checked)} />
            Include paid/in-progress orders in preview
          </label>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Pharmacy payout</div>
              <div className="mt-1 text-lg font-semibold">{money(payload?.summary?.pharmacyPayoutCents || 0, currency)}</div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Payment-provider fees</div>
              <div className="mt-1 text-lg font-semibold">{money(payload?.summary?.paymentProviderFeesCents || 0, currency)}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button disabled={busy} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50" onClick={() => void generatePayouts(true)}>Refresh preview</button>
            <button disabled={busy} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" onClick={() => void generatePayouts(false)}>Generate payout batch</button>
          </div>

          <div className="mt-5 space-y-2">
            {[...(payload?.pharmacy || []), ...(payload?.riders || [])].map((row: any) => (
              <div key={`${row.role}:${row.entityId}`} className="rounded-2xl border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{row.name || row.entityId}</div>
                    <div className="text-xs text-slate-500">{row.role} · {row.orders || row.trips || 0} item(s)</div>
                  </div>
                  <div className="font-semibold">{money(row.netCents || 0, currency)}</div>
                </div>
              </div>
            ))}
            {!loading && !payload?.pharmacy?.length && !payload?.riders?.length && (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">No payout-eligible CarePort activity for this period.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}