import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  PackageCheck,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "CarePort for Pharmacies",
  description:
    "CarePort helps pharmacies participate in accountable medicine fulfilment through onboarding, KYC, SKU management, prescription handling, dispatch readiness, proof-of-handover, fees and payouts.",
};

const onboarding = [
  "Complete pharmacy onboarding, KYC and relevant licensing or registration checks.",
  "Configure medicine catalogue, SKU availability and fulfilment coverage.",
  "Receive eligible eRx, prescription or order workflows through CarePort.",
  "Prepare medicines for dispatch and document readiness.",
  "Handover medication to authorised delivery workflows with required evidence.",
  "Track fulfilment status, operational exceptions and proof-of-delivery outcome.",
  "Review fees, payout rules, settlement timelines and support pathways.",
];

const pharmacyModel = [
  {
    title: "Catalogue and SKU readiness",
    body:
      "Maintain fulfilment visibility around available medicines, stock posture, package readiness and pharmacy operating coverage.",
    icon: ClipboardList,
  },
  {
    title: "Prescription handling",
    body:
      "Receive eRx-linked or eligible medicine orders and process them according to pharmacy, programme and regulatory requirements.",
    icon: FileCheck2,
  },
  {
    title: "Dispatch handover",
    body:
      "Prepare medicine for dispatch and document the handover from pharmacy to authorised rider workflow.",
    icon: PackageCheck,
  },
  {
    title: "Payout visibility",
    body:
      "Track billable pharmacy events, settlement posture, payout timing and operational reporting.",
    icon: WalletCards,
  },
];

const governance = [
  "Pharmacy participation depends on appropriate registration, licensing, readiness and contractual terms.",
  "Dispensing decisions, counselling obligations and pharmacy duties remain with the participating pharmacy.",
  "CarePort supports fulfilment workflow visibility; it does not replace professional pharmacy judgement.",
  "Medicine handover, patient identity, delivery constraints and exceptions should be documented clearly.",
];

export default function CarePortPharmaciesPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              CarePort pharmacies
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Turn pharmacy fulfilment into a visible care-continuity operation.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              CarePort helps pharmacies participate in accountable medicine fulfilment through
              onboarding, KYC, catalogue/SKU management, eRx handling, dispatch readiness, proof
              of handover, fees, settlements and support.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.careportUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Open CarePort <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/careport/riders"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                View rider workflow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/careport/pharmacy-operations-dashboard.webp"
                alt="CarePort pharmacy operations dashboard"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Pharmacy operations
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  SKU readiness, prescription handling, handover events, fulfilment status,
                  exceptions and payout visibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Pharmacy onboarding"
        title="The pharmacy journey should be ready before the first order."
        body="CarePort onboarding should make scope, catalogue, readiness, handover rules and settlement expectations clear from the beginning."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {onboarding.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        {pharmacyModel.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Pharmacy value
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Participate in Contactless Medicine without losing pharmacy discipline.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                CarePort can help pharmacies receive fulfilment demand from clinicians, patients,
                medical aids, employers and care programmes while maintaining professional dispensing
                boundaries and operational visibility.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "Receive eligible prescription and fulfilment workflows.",
                "Make medicine availability and preparation status visible.",
                "Coordinate delivery handover with authorised rider workflows.",
                "Support payer-funded medication continuity and chronic programmes.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                  <Store className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Governance"
        title="Medicine fulfilment must remain pharmacy-grade."
        body="CarePort should extend medicine access without weakening the professional standards expected of medication preparation, counselling and dispensing."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {governance.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}