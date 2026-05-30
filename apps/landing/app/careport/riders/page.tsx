import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  PackageCheck,
  ShieldCheck,
  Truck,
  WalletCards,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "CarePort for Riders",
  description:
    "CarePort gives riders a structured medicine-delivery workflow for identity verification, handover, route progression, patient updates, proof-of-delivery, safety and payout visibility.",
};

const onboarding = [
  "Complete rider onboarding, identity verification and operational readiness checks.",
  "Accept eligible delivery assignments through CarePort workflows.",
  "Follow pharmacy handover rules and keep medication packages secure.",
  "Use assigned route workflows and status updates through CarePort.",
  "Communicate only through approved patient-update and support channels.",
  "Capture proof-of-delivery according to platform rules.",
  "Review earnings, payout schedules, safety rules and escalation procedures.",
];

const workingRules = [
  "Confirm pickup details and package handover before leaving the pharmacy.",
  "Protect medicine packages and follow route and delivery instructions.",
  "Use only approved patient-update and support channels.",
  "Do not provide clinical or medication advice beyond approved delivery workflow.",
  "Capture proof-of-delivery and document delivery exceptions.",
  "Escalate failed delivery, safety, identity or package concerns immediately.",
];

const valueCards = [
  {
    title: "Structured assignments",
    body:
      "Receive pharmacy-to-patient medicine delivery assignments through an organised workflow.",
    icon: MapPinned,
  },
  {
    title: "Verified readiness",
    body:
      "Identity and readiness checks help protect patients, pharmacies and delivery teams.",
    icon: BadgeCheck,
  },
  {
    title: "Proof-of-delivery",
    body:
      "Capture delivery completion and exceptions according to CarePort rules.",
    icon: PackageCheck,
  },
  {
    title: "Earnings visibility",
    body:
      "Review delivery status, billable events, payout timing and operational support pathways.",
    icon: WalletCards,
  },
];

export default function CarePortRidersPage() {
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
              CarePort riders
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              A structured medicine-delivery workflow for verified riders.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              CarePort gives riders a governed delivery workflow for identity checks, pharmacy
              handover, route progression, patient updates, proof-of-delivery, safety escalation
              and earnings visibility.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.careportUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Open CarePort <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/careport/pharmacies"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                View pharmacy workflow <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/careport/careport-pharmacy-pickup.webp"
                alt="CarePort rider receiving medicine from pharmacy for delivery"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Delivery readiness
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Verified rider workflow with handover, route progression, delivery evidence and
                  payout visibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Rider onboarding"
        title="Every medicine delivery should start with verified readiness."
        body="CarePort onboarding should make identity, delivery rules, safety, patient communication and payment expectations clear before the first assignment."
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
                Last-mile medicine delivery is healthcare logistics, not ordinary courier work.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Riders are part of the medicine-continuity chain. CarePort supports professional
                handover, secure delivery, communication boundaries and exception escalation.
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
        title="Delivery exceptions must be visible."
        body="CarePort should protect patients, pharmacies, riders and programmes by making delivery exceptions easy to report and trace."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "If patient identity, address or handover details are unclear, delivery should pause until resolved.",
            "If the package is damaged, delayed or compromised, the exception should be documented immediately.",
            "If the rider encounters safety, access or patient concerns, the support and escalation pathway should be used.",
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