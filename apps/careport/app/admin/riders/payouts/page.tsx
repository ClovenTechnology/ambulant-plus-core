"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function RiderPayoutsPage() {
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/careport/riders/me/payouts", { cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(humanErrorMessage(js?.error, `payouts_http_${res.status}`));
      setPayload(js);
    } catch (err: any) {
      setError(humanErrorMessage(err, "Unable to load rider payouts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const currency = payload?.items?.[0]?.currency || "ZAR";

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Rider payouts</p>
          <h1 className="text-2xl font-semibold text-slate-950">Trips, account status and earnings</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Track CarePort delivery jobs, payout batches, pending earnings, and account state.
          </p>
        </div>
        <Link href="/rider/jobs" className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">Open jobs</Link>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{humanErrorMessage(error, "Unable to complete this request. Please try again.")}</div>}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-xs uppercase tracking-wide text-slate-500">Account</div><div className="mt-2 text-xl font-semibold">{payload?.account?.status || "—"}</div></div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-xs uppercase tracking-wide text-slate-500">Trips</div><div className="mt-2 text-xl font-semibold">{payload?.summary?.tripCount || 0}</div></div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-xs uppercase tracking-wide text-slate-500">Pending</div><div className="mt-2 text-xl font-semibold">{money(payload?.summary?.pendingCents || 0, currency)}</div></div>
        <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="text-xs uppercase tracking-wide text-slate-500">Paid</div><div className="mt-2 text-xl font-semibold">{money(payload?.summary?.paidCents || 0, currency)}</div></div>
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-950">Payout history</h2>
        <div className="mt-4 space-y-2">
          {(payload?.items || []).map((item: any) => (
            <div key={item.id} className="rounded-2xl border p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-semibold">{money(item.amountCents, item.currency)}</div>
                  <div className="text-xs text-slate-500">{new Date(item.periodStart).toLocaleDateString()} – {new Date(item.periodEnd).toLocaleDateString()}</div>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs">{item.status}</span>
              </div>
            </div>
          ))}
          {!loading && !(payload?.items || []).length && <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">No rider payout batch has been generated yet.</div>}
        </div>
      </section>
    </main>
  );
}