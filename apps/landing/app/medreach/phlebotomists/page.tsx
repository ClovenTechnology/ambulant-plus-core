import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  ShieldCheck,
  Syringe,
  TestTube2,
  WalletCards,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "MedReach for Phlebotomists",
  description:
    "MedReach gives phlebotomists a structured home-draw workflow for onboarding, identity verification, patient verification, specimen labelling, custody, handover and earnings.",
};

const onboarding = [
  "Complete phlebotomist onboarding, identity/KYC and qualification checks.",
  "Accept eligible home-draw assignments through MedReach workflows.",
  "Verify patient identity, order details, consent and collection requirements.",
  "Follow safe home-collection procedures and escalation rules.",
  "Label specimens, document collection and preserve chain-of-custody requirements.",
  "Prepare specimens for laboratory handover or transport workflow.",
  "Review earnings, payout timing, safety guidance and support channels.",
];

const workingRules = [
  "Confirm patient identity and assignment details before collection.",
  "Collect only within approved scope, training and assignment instructions.",
  "Use correct tubes, labels, packaging and specimen-handling steps.",
  "Document collection time, exceptions and handover readiness.",
  "Escalate safety, identity, access, clinical or specimen concerns immediately.",
  "Protect confidentiality and communicate only through approved channels.",
];

const valueCards = [
  {
    title: "Structured assignments",
    body:
      "Receive organised home-draw assignments rather than informal, disconnected requests.",
    icon: MapPinned,
  },
  {
    title: "Professional verification",
    body:
      "Use onboarding and qualification checks to build confidence for patients, laboratories and payer-funded programmes.",
    icon: BadgeCheck,
  },
  {
    title: "Specimen discipline",
    body:
      "Follow structured labelling, collection documentation and handover requirements.",
    icon: TestTube2,
  },
  {
    title: "Earnings visibility",
    body:
      "Review assignment status, billable events, payout timing and operational support pathways.",
    icon: WalletCards,
  },
];

export default function MedReachPhlebotomistsPage() {
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
              MedReach phlebotomists
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              A professional home-draw workflow for verified phlebotomists.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              MedReach gives phlebotomists a structured workflow for onboarding, identity checks,
              patient verification, home collection, specimen labelling, custody, laboratory
              handover, safety escalation and earnings visibility.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.medreachUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Open MedReach <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/medreach/labs"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                View lab workflow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/medreach/phlebotomist-home-draw.webp"
                alt="MedReach phlebotomist preparing specimen during a home draw"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Home draw readiness
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Verified phlebotomy workflow with patient checks, specimen handling, laboratory
                  handover and earnings visibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Onboarding"
        title="Every home draw should start with verified readiness."
        body="MedReach onboarding should make identity, qualification, assignment rules, safety and payment expectations clear before the first collection."
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
        {valueCards.map(({ title, body, icon: Icon }) => (
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
                Working rules
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Specimen quality begins at the patient’s door.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Phlebotomists are the operational bridge between the patient, laboratory and care
                team. MedReach supports professional behaviour, documented collection and safe
                handover.
              </p>
            </div>

            <div className="grid gap-3">
              {workingRules.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                  <ClipboardCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Safety and escalation"
        title="Home collection needs clear boundaries."
        body="MedReach should protect patients, phlebotomists, laboratories and clinicians by making escalation routes explicit."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "If identity, consent or order details are unclear, the draw should not proceed until resolved.",
            "If the patient appears acutely unwell, the workflow should support escalation to appropriate urgent care.",
            "If specimen integrity is compromised, collection and handover exceptions should be documented clearly.",
          ].map((item) => (
            <div key={item} className="glass-panel rounded-[30px] p-6">
              <ShieldCheck className="h-7 w-7 text-cyan-700" />
              <p className="mt-5 text-sm leading-7 text-slate-600">{item}</p>
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