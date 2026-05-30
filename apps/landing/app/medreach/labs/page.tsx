import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  ShieldCheck,
  TestTube2,
  WalletCards,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "MedReach for Laboratories",
  description:
    "MedReach helps laboratories participate in home diagnostics through onboarding, test catalogue setup, specimen acceptance, result readiness, result routing and operational support.",
};

const onboarding = [
  "Complete laboratory onboarding, KYC and verification checks.",
  "Configure supported tests, panels, specimen requirements and service coverage.",
  "Set specimen acceptance rules, turnaround expectations and operational availability.",
  "Enable laboratory handover status and processing visibility where configured.",
  "Support result readiness, result routing and clinical-workflow integration.",
  "Review billing, service-level, settlement and support requirements.",
];

const operatingModel = [
  {
    title: "Catalogue and panels",
    body:
      "Define available tests, panels, sample types, acceptance criteria, pricing rules and operational coverage.",
    icon: ClipboardList,
  },
  {
    title: "Specimen acceptance",
    body:
      "Receive structured specimen handover information, collection metadata and custody context before processing.",
    icon: TestTube2,
  },
  {
    title: "Result readiness",
    body:
      "Update result status and make result-routing workflows available to clinicians, patients or programmes where appropriate.",
    icon: FileCheck2,
  },
  {
    title: "Billing visibility",
    body:
      "Support billable diagnostic events, payer-funded pathways, service rules and settlement visibility.",
    icon: WalletCards,
  },
];

const governance = [
  "Laboratory participation depends on appropriate registration, operational readiness and contractual terms.",
  "Result-routing must follow consent, role permissions and applicable legal requirements.",
  "Specimen handling remains subject to laboratory standards, sample integrity and clinical requirements.",
  "MedReach should not override laboratory judgement, quality-control processes or result-release rules.",
];

export default function MedReachLabsPage() {
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
              MedReach labs
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Extend laboratory access into governed home diagnostics.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              MedReach helps laboratories participate in home diagnostics through onboarding,
              test catalogue setup, specimen acceptance, result readiness, result routing, billing
              and operational support.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.medreachUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Open MedReach <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/medreach/phlebotomists"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                View phlebotomist workflow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/medreach/lab-specimen-dashboard.webp"
                alt="MedReach laboratory specimen dashboard"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Lab operations
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Test catalogue, specimen handover, processing status, result readiness and billing
                  visibility for organised laboratory participation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Laboratory onboarding"
        title="The lab journey should be precise before the first specimen arrives."
        body="MedReach onboarding should make laboratory scope, specimen rules, supported tests and result workflow clear from the beginning."
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
        {operatingModel.map(({ title, body, icon: Icon }) => (
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
                Laboratory value
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Meet patients where collection-room access fails.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Laboratory networks gain a structured pathway for home diagnostics, payer-funded
                test access, clinician-requested collections and programme-driven diagnostics
                without losing specimen discipline.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "Reach patients with transport, mobility, work or geography barriers.",
                "Support payer-funded screening and chronic monitoring programmes.",
                "Receive better-structured collection and specimen context.",
                "Improve result-routing into connected clinical and programme workflows.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                  <FlaskConical className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Governance"
        title="Home diagnostics must remain laboratory-grade."
        body="MedReach should extend access without weakening the standards expected of diagnostic collection, processing and result release."
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