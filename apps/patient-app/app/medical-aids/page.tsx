"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import MedicalAidManager from "@/components/MedicalAidManager";

type ProfilePayload = {
  ok?: boolean;
  patientId?: string | null;
  id?: string | null;
  name?: string | null;
};

export default function MedicalAidsPage() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        setProfile(data?.ok === false ? null : data);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  const patientId = profile?.patientId || profile?.id || "";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
              Ambulant+ Medical Aid
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
              Medical Aid / Sponsor Profile
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
              Manage your existing policy details, Certificate of Membership, claim-critical fields,
              and payer-safe adherence visibility.
            </p>
          </div>

          <Link
            href="/join-scheme"
            className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Join a Scheme
          </Link>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-white p-5 text-slate-900">
          {loading ? (
            <div className="text-sm text-slate-500">Loading profile…</div>
          ) : patientId ? (
            <MedicalAidManager patientId={patientId} />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Could not resolve your patient profile. Please refresh or complete your profile first.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}