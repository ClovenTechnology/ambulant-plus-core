"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SPONSOR_PLANS,
  sponsorTypeLabel,
  type SponsorPlan,
  type SponsorType,
} from "@/lib/sponsorPlans";

type ProfilePayload = {
  ok?: boolean;
  patientId?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  dob?: string | null;
  address?: string | null;
  allergies?: string[];
  chronicConditions?: string[];
};

const PLANS = SPONSOR_PLANS;

function moneySafe(s: string) {
  return s || "Not published";
}

function consentDefaults() {
  return {
    eligibilityAndEnrollment: true,
    clinicalHistory: true,
    medicationAdherence: true,
    clinicalGradeVitals: true,
    wearableWellness: true,
    reproductiveHealth: false,
    antenatalAndBirthRecord: false,
    rewardsAndWellness: true,
    claimsAndAuthorizations: true,
    communications: true,
  };
}

export default function JoinSchemePage() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState(PLANS[0]?.id || "");
  const [compareIds, setCompareIds] = useState<string[]>([PLANS[0]?.id, PLANS[1]?.id].filter(Boolean));
  const [filter, setFilter] = useState<SponsorType | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [consent, setConsent] = useState(consentDefaults());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submittedRef, setSubmittedRef] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;

        const p = data?.ok === false ? null : data;
        setProfile(p);

        setFullName(p?.name || "");
        setEmail(p?.email || "");
        setPhone(p?.mobile || "");
        setDob(p?.dob || "");
        setAddress(p?.address || "");
      } catch {
        if (alive) setProfile(null);
      }
    }

    void loadProfile();

    return () => {
      alive = false;
    };
  }, []);

  const visiblePlans = useMemo(() => {
    const q = query.trim().toLowerCase();

    return PLANS.filter((p) => {
      const typeOk = filter === "ALL" || p.sponsorType === filter;
      const queryOk =
        !q ||
        p.sponsorName.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));

      return typeOk && queryOk;
    });
  }, [filter, query]);

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[0];

  const comparePlans = PLANS.filter((p) => compareIds.includes(p.id)).slice(0, 3);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [prev[1], prev[2], id].filter(Boolean);
      return [...prev, id];
    });
  }

  function setConsentKey(key: keyof ReturnType<typeof consentDefaults>, value: boolean) {
    setConsent((prev) => ({ ...prev, [key]: value }));
  }

  async function submitApplication() {
    setError("");
    setSubmittedRef("");

    if (!selectedPlan) {
      setError("Please select a plan.");
      return;
    }

    if (!profile?.patientId) {
      setError("Patient profile is not ready yet. Please refresh and try again.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !phone.trim() || !idNumber.trim()) {
      setError("Full name, email, phone and ID/passport number are required.");
      return;
    }

    if (!consent.eligibilityAndEnrollment || !consent.claimsAndAuthorizations || !consent.communications) {
      setError("Eligibility, claims/authorisations and communications consent are mandatory for scheme application.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/scheme-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId: profile.patientId,
          userId: profile.userId || null,
          sponsorType: selectedPlan.sponsorType,
          sponsorId: selectedPlan.sponsorId,
          sponsorName: selectedPlan.sponsorName,
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          applicant: {
            fullName,
            email,
            phone,
            dob,
            idNumber,
            address,
          },
          dependants: [],
          consent: {
            accepted: true,
            categories: consent,
          },
          profileContextSnapshot: {
            declaredAllergies: profile.allergies || [],
            declaredConditions: profile.chronicConditions || [],
          },
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not submit application.");
        return;
      }

      setSubmittedRef(data.item?.reference || "Submitted");
    } catch (err: any) {
      setError(err?.message || "Could not submit application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-p-ui="patient-join-scheme-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
              Ambulant+ Enterprise Enrollment
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              Join a Scheme
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Apply to a Medical Aid, HMO, or Corporate Sponsor using your Ambulant+ profile,
              payer-safe health context, and POPIA-controlled consent.
            </p>
          </div>

          <Link
            href="/medical-aids"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            View existing policies
          </Link>
        </header>

        {submittedRef ? (
          <section className="rounded-3xl border border-emerald-700 bg-emerald-950/50 p-5">
            <div className="text-sm font-semibold text-emerald-200">
              Application submitted: {submittedRef}
            </div>
            <div className="mt-1 text-sm text-emerald-100/80">
              Your application has been received and is ready for sponsor review from the client console.
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-3xl border border-rose-700 bg-rose-950/50 p-5 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search schemes, plans, sponsor types..."
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none"
              />

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none"
              >
                <option value="ALL">All sponsors</option>
                <option value="MEDICAL_AID">Medical Aid</option>
                <option value="HMO">HMO</option>
                <option value="CORPORATE_SPONSOR">Corporate Sponsor</option>
              </select>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {visiblePlans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    selectedPlanId === p.id
                      ? "border-sky-400 bg-sky-950/50"
                      : "border-slate-800 bg-slate-950 hover:border-slate-600"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {sponsorTypeLabel(p.sponsorType)}
                  </div>
                  <div className="mt-2 text-lg font-semibold">{p.sponsorName}</div>
                  <div className="mt-1 text-sm font-medium text-sky-200">{p.name}</div>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-300">{p.summary}</p>
                  <div className="mt-3 text-sm font-semibold text-slate-100">{moneySafe(p.priceLabel)}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleCompare(p.id)}
                    />
                    Compare
                  </label>
                </button>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <div className="text-sm font-semibold">Comparison</div>
            <div className="mt-3 space-y-3">
              {comparePlans.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{p.sponsorName}</div>
                  <div className="mt-2 text-xs text-slate-300">
                    Includes: {p.tags.join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-sm font-semibold text-slate-100">Application details</div>
            <div className="mt-1 text-xs text-slate-400">
              Prefilled from your profile where available. Please complete missing mandatory fields.
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
              </Field>
              <Field label="Email">
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={dob ? dob.slice(0, 10) : ""} onChange={(e) => setDob(e.target.value)} className="input" />
              </Field>
              <Field label="ID / Passport number">
                <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="input" />
              </Field>
              <Field label="Address">
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
              </Field>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-semibold">Selected plan</div>
              <div className="mt-2 text-lg font-semibold">{selectedPlan?.sponsorName}</div>
              <div className="text-sm text-sky-200">{selectedPlan?.name}</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{selectedPlan?.summary}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-sm font-semibold text-slate-100">POPIA consent bundle</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              Minimum required: eligibility/enrollment, claims/authorisations, and communications.
              Sensitive categories remain explicit and patient-controlled.
            </div>

            <div className="mt-4 grid gap-2">
              <ConsentRow required label="Eligibility and enrollment" checked={consent.eligibilityAndEnrollment} onChange={(v) => setConsentKey("eligibilityAndEnrollment", v)} />
              <ConsentRow label="Clinical history: allergies, conditions, operations, vaccinations" checked={consent.clinicalHistory} onChange={(v) => setConsentKey("clinicalHistory", v)} />
              <ConsentRow label="Medication adherence summaries" checked={consent.medicationAdherence} onChange={(v) => setConsentKey("medicationAdherence", v)} />
              <ConsentRow label="Clinical-grade vitals / Health Monitor spot checks" checked={consent.clinicalGradeVitals} onChange={(v) => setConsentKey("clinicalGradeVitals", v)} />
              <ConsentRow label="Wearable wellness / NexRing insights" checked={consent.wearableWellness} onChange={(v) => setConsentKey("wearableWellness", v)} />
              <ConsentRow label="Reproductive health visibility" checked={consent.reproductiveHealth} onChange={(v) => setConsentKey("reproductiveHealth", v)} />
              <ConsentRow label="Antenatal and birth-record visibility" checked={consent.antenatalAndBirthRecord} onChange={(v) => setConsentKey("antenatalAndBirthRecord", v)} />
              <ConsentRow label="Rewards and wellness programme evidence" checked={consent.rewardsAndWellness} onChange={(v) => setConsentKey("rewardsAndWellness", v)} />
              <ConsentRow required label="Claims and authorisations" checked={consent.claimsAndAuthorizations} onChange={(v) => setConsentKey("claimsAndAuthorizations", v)} />
              <ConsentRow required label="Application communications" checked={consent.communications} onChange={(v) => setConsentKey("communications", v)} />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={submitApplication}
              className="mt-5 w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Submitting..." : "Submit scheme application"}
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(51 65 85);
          background: rgb(2 6 23);
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
          color: white;
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ConsentRow({
  label,
  checked,
  onChange,
  required,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  required?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
      <span className="text-sm text-slate-200">
        {label}
        {required ? <span className="ml-2 text-xs text-sky-300">required</span> : null}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}