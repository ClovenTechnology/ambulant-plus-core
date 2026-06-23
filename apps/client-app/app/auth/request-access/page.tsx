"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string; reference?: string }
  | { status: "error"; message: string };

export default function RequestAccessPage() {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "submitting" });

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setState({
          status: "error",
          message: json?.error || "Could not submit request.",
        });
        return;
      }

      setState({
        status: "success",
        message:
          json.message ||
          "Request received. Ambulant+ will review the organization before portal access is granted.",
        reference: json.item?.id,
      });
    } catch (error: any) {
      setState({
        status: "error",
        message: error?.message || "Could not submit request.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
            Ambulant+ Payer Portal
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
            Request medical aid access
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300 md:text-base">
            Medical aids, HMOs, corporate sponsors and wellness partners can request access here.
            Access is not automatic. Ambulant+ reviews and approves each organization before the
            first owner is invited into the client portal.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-white p-6 text-slate-950 shadow-xl">
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-1 text-sm font-semibold">
              Organization type
              <select
                name="orgType"
                className="rounded-xl border border-slate-300 px-3 py-2"
                defaultValue="MEDICAL_AID"
              >
                <option value="MEDICAL_AID">Medical Aid</option>
                <option value="HMO">HMO</option>
                <option value="CORPORATE_SPONSOR">Corporate Sponsor</option>
                <option value="WELLNESS_PARTNER">Wellness Partner</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm font-semibold">
              Organization name
              <input
                name="name"
                required
                className="rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Discovery Health, Bonitas, Medscheme, corporate sponsor..."
              />
            </label>

            <label className="grid gap-1 text-sm font-semibold">
              Legal name
              <input
                name="legalName"
                className="rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Registered legal entity name"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Contact name
                <input
                  name="ownerName"
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="Name / role"
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold">
                Work email
                <input
                  name="ownerEmail"
                  type="email"
                  required
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="owner@medicalaid.co.za"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Phone
                <input
                  name="contactPhone"
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="+27..."
                />
              </label>

              <label className="grid gap-1 text-sm font-semibold">
                Country
                <input
                  name="country"
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  defaultValue="ZA"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm font-semibold">
              Website
              <input
                name="website"
                className="rounded-xl border border-slate-300 px-3 py-2"
                placeholder="https://..."
              />
            </label>

            <label className="grid gap-1 text-sm font-semibold">
              Notes
              <textarea
                name="notes"
                rows={4}
                className="rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Tell us what you want to enable: member eligibility, claims, authorizations, sponsored programs, marketplace listing..."
              />
            </label>

            {state.status === "error" ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {state.message}
              </div>
            ) : null}

            {state.status === "success" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {state.message}
                {state.reference ? <div className="mt-1">Reference: {state.reference}</div> : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={state.status === "submitting"}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {state.status === "submitting" ? "Submitting..." : "Submit request"}
            </button>
          </form>

          <div className="mt-5 text-sm text-slate-600">
            Already invited?{" "}
            <Link href="/auth/login" className="font-semibold text-sky-700">
              Log in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}