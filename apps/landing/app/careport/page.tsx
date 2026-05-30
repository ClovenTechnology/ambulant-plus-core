import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  Pill,
  ShieldCheck,
  Store,
  Truck,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "CarePort Pharmacy Fulfilment Operations",
  description:
    "CarePort is the Ambulant+ pharmacy fulfilment and rider operations layer for eRx continuity, medicine preparation, dispatch, delivery tracking, proof-of-delivery and payout visibility.",
};

const fulfilmentFlow = [
  {
    title: "eRx or medicine order",
    body:
      "A prescription, refill, care-programme order or medicine-continuity workflow enters the CarePort fulfilment pathway.",
  },
  {
    title: "Pharmacy readiness",
    body:
      "The pharmacy receives order context, checks catalogue/SKU availability, prepares medication and updates fulfilment status.",
  },
  {
    title: "Dispatch handover",
    body:
      "Medication is packaged and handed over to the assigned delivery workflow with the required handover evidence.",
  },
  {
    title: "Rider progression",
    body:
      "The rider follows assigned route status, patient-update rules, safety boundaries and delivery instructions.",
  },
  {
    title: "Proof-of-delivery",
    body:
      "Delivery completion is captured according to CarePort rules, creating an auditable fulfilment event.",
  },
  {
    title: "Settlement visibility",
    body:
      "Billable pharmacy, delivery and fulfilment events can be surfaced for payer, sponsor, pharmacy and rider settlement workflows.",
  },
];

const carePortRoles: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "For pharmacies",
    body:
      "Onboarding KYC, medicine catalogue/SKU management, prescription handling, dispatch readiness, proof-of-handover, fees and payout visibility.",
    icon: Store,
    href: "/careport/pharmacies",
  },
  {
    title: "For riders",
    body:
      "Identity verification, handover workflow, route progression, patient-update boundaries, proof-of-delivery and earnings visibility.",
    icon: Truck,
    href: "/careport/riders",
  },
  {
    title: "For payers and care programmes",
    body:
      "Support medicine-continuity programmes, chronic-adherence pathways, last-mile fulfilment and payer/sponsor reporting.",
    icon: ShieldCheck,
    href: "/clients",
  },
];

const operationalCapabilities = [
  "eRx-linked fulfilment and medicine-continuity workflows.",
  "Pharmacy onboarding, KYC and operational readiness.",
  "Catalogue/SKU visibility, medication availability and preparation status.",
  "Rider assignment, dispatch handover and route progression.",
  "Patient updates through approved communication boundaries.",
  "Proof-of-delivery, exception handling and audit visibility.",
  "Billable pharmacy, delivery and fulfilment events.",
  "Payout, settlement and operational reporting for pharmacies and riders.",
];

const payerUseCases = [
  "Medical aids funding chronic-medicine access and reducing refill disruption.",
  "Employers sponsoring medication-delivery benefits for covered staff.",
  "Clinicians prescribing after Contactless Medicine consultation and needing last-mile fulfilment.",
  "Patients with transport, mobility, work or geography barriers to pharmacy collection.",
  "Care programmes using adherence, eRx and delivery evidence to intervene earlier.",
  "Chronic-condition pathways where medicine continuity prevents avoidable complications.",
];

const trustBoundaries = [
  {
    title: "Not a pharmacy replacement",
    body:
      "CarePort coordinates fulfilment operations. Dispensing, medication counselling and pharmacy obligations remain subject to the participating pharmacy and applicable regulation.",
    icon: Store,
  },
  {
    title: "Medicine handling matters",
    body:
      "Medication handover, route progression, delivery conditions, patient confirmation and proof-of-delivery must be documented carefully.",
    icon: ClipboardCheck,
  },
  {
    title: "Adherence needs continuity",
    body:
      "Medication reminders are strongest when connected to eRx, pharmacy fulfilment, refill behaviour and proof-of-delivery signals.",
    icon: Pill,
  },
];

export default function CarePortPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[20%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              CarePort
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              The pharmacy fulfilment layer for Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              CarePort connects eRx, pharmacy preparation, SKU readiness, rider dispatch,
              patient updates, proof-of-delivery and settlement visibility into one governed
              medicine-continuity pathway.
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
                For pharmacies <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/careport/riders"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                For riders <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/careport/careport-erx-delivery.webp"
                alt="CarePort eRx delivery and medicine continuity workflow"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Medicine continuity
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Connect prescriptions, pharmacy readiness, dispatch, delivery and adherence
                  evidence into a single operational pathway.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Fulfilment workflow"
        title="From prescription to proof-of-delivery."
        body="CarePort is designed to make medicine access operationally visible, auditable and connected to the wider Ambulant+ care journey."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fulfilmentFlow.map((step, index) => (
            <div key={step.title} className="glass-panel rounded-[30px] p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/careport/careport-pharmacy-pickup.webp"
              alt="CarePort pharmacy handover and rider pickup workflow"
              className="h-80 w-full object-cover"
            />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Pharmacy-to-rider bridge
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              The delivery journey starts before the rider leaves the pharmacy.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              Medicine continuity fails when pharmacy preparation, rider pickup, patient updates
              and proof-of-delivery are disconnected. CarePort connects these events into a
              governed fulfilment chain.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "Pharmacy preparation and SKU readiness.",
                "Dispatch handover and rider assignment.",
                "Route progression and patient updates.",
                "Proof-of-delivery and exception capture.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="CarePort roles"
        title="Built for pharmacies, riders and payer-funded medicine programmes."
        body="CarePort keeps pharmacy operations and rider operations distinct while preserving one accountable medicine-continuity pathway."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {carePortRoles.map(({ title, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Operating capabilities
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Medicine access should not collapse after the consultation.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                CarePort is the operations layer that connects prescriptions, pharmacies, riders,
                patients, payers and adherence workflows after care has been prescribed.
              </p>
            </div>

            <div className="grid gap-3">
              {operationalCapabilities.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Why it matters"
        title="Medication continuity is a prevention lever."
        body="For medical aids, employers and care programmes, prescription access and adherence are central to chronic-care economics."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {payerUseCases.map((item) => (
            <div key={item} className="rounded-3xl border border-white/70 bg-white/78 p-5 text-sm leading-7 text-slate-600 shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6 md:py-16">
        {trustBoundaries.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}