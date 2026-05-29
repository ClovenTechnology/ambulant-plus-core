import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

const workflow = [
  "Clinician-led virtual consultation supported by structured patient context.",
  "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows where available.",
  "eRx, CarePort medicine fulfilment, MedReach diagnostic requests and InsightCore intelligence.",
  "Clinical documentation, follow-up planning, escalation boundaries and governance-aware review.",
];

const startSteps = [
  "Create clinician account",
  "Complete profile and KYC",
  "Upload professional documents",
  "Choose training slot",
  "Make required payment",
  "Attend platform training",
  "Complete readiness checks",
  "Start consulting and earning",
];

const clinicianCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Onboarding criteria",
    body:
      "Professional registration where applicable, identity/KYC, qualification evidence, platform training and privacy acknowledgement.",
    icon: ClipboardCheck,
  },
  {
    title: "Working rules",
    body:
      "Private consultation space, clear documentation, emergency escalation, confidentiality and practice within competence.",
    icon: ShieldCheck,
  },
  {
    title: "Training",
    body:
      "Clinicians select a training slot, complete compulsory platform training and learn device-supported workflows.",
    icon: GraduationCap,
  },
  {
    title: "Payouts and fees",
    body:
      "Training/onboarding fees and payout schedules are managed according to platform rules and accepted payment terms.",
    icon: WalletCards,
  },
];

const complianceNotes = [
  "Professional registration/HPCSA or equivalent requirements must be respected where applicable.",
  "Practice-number and medical-aid claiming rules depend on clinician and platform readiness.",
  "Professional indemnity and PI cover must be understood before services are rendered.",
];

export const metadata = {
  title: "Clinicians",
  description:
    "How clinicians join Ambulant+, understand Contactless Medicine, complete onboarding and work safely within the platform.",
};

export default function CliniciansPage() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Clinician App
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            A governed clinical workspace for Contactless Medicine.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            Ambulant+ helps clinicians deliver remote care with objective device context,
            structured documentation, MedReach diagnostics, CarePort fulfilment and InsightCore
            intelligence — while preserving professional judgement, escalation boundaries and
            clinical governance.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={site.clinicianSignupUrl}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Start clinician signup <ArrowRight className="h-4 w-4" />
            </a>

            <Link
              href="/clinicians/onboarding"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              View onboarding guide <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-6 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
              Clinical command model
            </div>

            <div className="mt-6 grid gap-4">
              {workflow.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4"
                >
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="How clinicians start"
        title="From signup to first consultation."
        body="The clinician journey is structured so patients, clinicians and programme partners can trust the workflow."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {startSteps.map((item, index) => (
            <div key={item} className="glass-panel rounded-[30px] p-6">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                {index + 1}
              </div>
              <h3 className="mt-5 font-semibold text-slate-950">{item}</h3>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        {clinicianCards.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <SectionShell
        eyebrow="Compliance"
        title="Clinician responsibility remains central."
        body="Ambulant+ supports Contactless Medicine workflows; it does not remove professional responsibility, regulatory obligations, indemnity expectations, emergency boundaries or patient-safety duties."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {complianceNotes.map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-white/70 bg-white/78 p-5 text-sm leading-7 text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>
      </SectionShell>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}