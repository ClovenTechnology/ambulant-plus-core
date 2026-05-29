import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  HeartPulse,
  Microscope,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";

const researchStreams = [
  {
    title: "Clinical workflow design",
    body:
      "Mapping real consultation behaviour into remote pathways that remain clinician-led, documented, consent-aware and escalation-ready.",
  },
  {
    title: "Device-supported consultation",
    body:
      "Studying how Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows can provide useful clinical context without overstating device capability.",
  },
  {
    title: "Diagnostics operations",
    body:
      "Designing MedReach workflows for home phlebotomy, specimen labelling, custody, transport readiness, laboratory handover and result routing.",
  },
  {
    title: "Medication continuity",
    body:
      "Connecting eRx, reminders, camera-supported verification, adherence trends and fulfilment visibility into one safer medication journey.",
  },
  {
    title: "Fertility and longitudinal signals",
    body:
      "Exploring individual-baseline biometric modelling, including temperature variation signals where NexRing workflows are available.",
  },
  {
    title: "Multi-user care architecture",
    body:
      "Supporting couples, caregivers, parents, children and multi-specialty teams in the same virtual care event when the clinical context requires it.",
  },
  {
    title: "Medical-aid and payment preflight",
    body:
      "Reducing failed care journeys by checking medical-aid readiness and payment pathway status before workflows proceed.",
  },
  {
    title: "Governance and safety research",
    body:
      "Maintaining privacy, consent, auditability, clinical disclaimers, emergency boundaries and responsible claim control across every product surface.",
  },
];

const pipeline: Array<{
  title: string;
  body: string;
}> = [
  {
    title: "Observe",
    body:
      "Identify where existing video-only, clinic-only or paper-heavy workflows fail patients and care teams.",
  },
  {
    title: "Model",
    body:
      "Translate the workflow into device-supported, operationally traceable contactless-care pathways.",
  },
  {
    title: "Prototype",
    body:
      "Build working product surfaces across patient, clinician, MedReach, CarePort and InsightCore modules.",
  },
  {
    title: "Review",
    body:
      "Evaluate safety boundaries, data minimisation, escalation language, governance and operational accountability.",
  },
  {
    title: "Deploy",
    body:
      "Move validated workflows into controlled platform environments with support, audit trails and role boundaries.",
  },
];

const implementationChecks: Array<{
  title: string;
  body: string;
}> = [
  {
    title: "Clinical fit",
    body:
      "Does the workflow support professional review without pretending to automate diagnosis?",
  },
  {
    title: "Operational fit",
    body:
      "Can the workflow be executed by real teams across diagnostics, pharmacy and support?",
  },
  {
    title: "Patient fit",
    body:
      "Does the journey reduce confusion, failed bookings and avoidable care delays?",
  },
  {
    title: "Governance fit",
    body:
      "Are consent, privacy, emergency boundaries and claims language protected?",
  },
];

const researchSummaryCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Clinical workflow",
    body:
      "Designed around consultation, documentation, review and escalation.",
    icon: ClipboardCheck,
  },
  {
    title: "Device research",
    body:
      "Focused on defined device pathways and careful interpretation boundaries.",
    icon: Microscope,
  },
  {
    title: "Care operations",
    body:
      "Built to connect diagnostics, fulfilment, patient navigation and governance.",
    icon: HeartPulse,
  },
];

const overclaimingControls = [
  "Device-supported care must remain subject to device limitations, intended use and clinician interpretation.",
  "InsightCore should support aggregated and governance-aware visibility without inappropriate patient-level disclosure.",
  "Clinical workflows must preserve emergency boundaries and clear escalation language.",
  "Partnership, regulatory and approval claims should be published only where documentation and permissions support them.",
];

export const metadata = {
  title: "Research & Development",
  description:
    "Ambulant+ R&D direction across clinical workflow design, device-supported care, diagnostics operations, fulfilment logistics, patient navigation and governance.",
};

export default function ResearchAndDevelopmentPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[10%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Research & Development
            </div>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
              Turning clinical workflows into governed contactless-care systems.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ R&D focuses on clinical workflow design, device-supported consultation,
              home diagnostics, medication continuity, fulfilment logistics, patient navigation
              and governance infrastructure.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/innovation"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                View innovation thesis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Request platform walkthrough <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-8">
            <div className="rounded-[34px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-6">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                R&D command model
              </div>
              <div className="mt-6 grid gap-4">
                {pipeline.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-950">{item.title}</div>
                        <p className="mt-1 text-sm leading-7 text-slate-600">{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Research streams"
        title="A disciplined R&D programme for real-world care pathways."
        body="The research direction is practical: define the clinical problem, map the care operation, protect governance boundaries, then translate the workflow into a deployable platform surface."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {researchStreams.map((item) => (
            <div key={item.title} className="glass-panel rounded-[30px] p-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                <FlaskConical className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Implementation science
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                R&D is measured against deployable healthcare operations.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Contactless Medicine succeeds only if the workflow can function safely outside
                the clinic: the patient understands the journey, the clinician receives useful
                context, the diagnostic or pharmacy operation is traceable, and the governance
                boundary remains visible.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {implementationChecks.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <div className="font-semibold">{item.title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6">
        {researchSummaryCards.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[34px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] border border-emerald-200 bg-emerald-50 p-6 md:p-10">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <ShieldCheck className="h-8 w-8 text-emerald-700" />
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                Research without overclaiming.
              </h2>
            </div>
            <div className="grid gap-3">
              {overclaimingControls.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-emerald-200 bg-white/80 p-5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}