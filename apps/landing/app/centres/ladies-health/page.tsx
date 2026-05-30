import Link from "next/link";
import {
  ArrowRight,
  Baby,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  FileHeart,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Ladies’ Health Centre",
  description:
    "Ambulant+ Ladies’ Health Centre supports women’s health, fertility, cycle tracking, wellness, device-supported context, virtual consultation and care-navigation pathways.",
};

const pathways: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Cycle and fertility support",
    body:
      "Support for cycle history, fertility goals, symptom tracking and clinician-guided care planning where appropriate.",
    icon: CalendarCheck2,
  },
  {
    title: "NexRing trend context",
    body:
      "NexRing-supported temperature variation and longitudinal signals can strengthen fertility-context review beyond calendar-only estimation where configured.",
    icon: Watch,
  },
  {
    title: "Virtual Ob/Gyn sessions",
    body:
      "Women and couples can access structured virtual consultations, including multi-user sessions where permissions and workflow allow.",
    icon: Stethoscope,
  },
  {
    title: "Medication and reminders",
    body:
      "Reminders can support supplements, prescribed medicines, appointments, wellness actions and care-plan adherence.",
    icon: BellRing,
  },
  {
    title: "Reports and care history",
    body:
      "Relevant results, prior history, symptoms, medications and care notes can be organised for better continuity.",
    icon: FileHeart,
  },
  {
    title: "Safe escalation",
    body:
      "Ambulant+ should guide patients to urgent, in-person or specialist care where symptoms or findings require it.",
    icon: ShieldCheck,
  },
];

const useCases = [
  "Fertility planning with both partners attending a virtual session from different locations.",
  "Cycle irregularity or symptom review with clinician-led assessment and appropriate follow-up.",
  "Wellness, sleep, activity and temperature-variation context where NexRing is configured.",
  "Medication, supplement, hydration and appointment reminders to support daily routines.",
  "Home diagnostics through MedReach where ordered and clinically appropriate.",
  "Medication fulfilment through CarePort where prescription and pharmacy workflows are available.",
];

const safetyNotes = [
  "Fertility prediction should not rely on calendar calculation alone where richer device and clinical context is available.",
  "Device signals are supportive context and do not replace clinician review, laboratory testing or urgent care.",
  "Severe pain, heavy bleeding, collapse, suspected ectopic pregnancy, severe infection symptoms or pregnancy emergency symptoms require urgent assessment.",
];

export default function LadiesHealthCentrePage() {
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
              Ladies’ Health Centre
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Women’s health, fertility and wellness pathways with richer remote-care context.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ Ladies’ Health Centre supports women’s health journeys through clinician-led
              virtual care, profile readiness, fertility and cycle context, NexRing-supported trends,
              reminders, MedReach diagnostics and CarePort fulfilment where appropriate.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientSignupUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Create patient account <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/patients/getting-started"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Getting started <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/centres/ladies-health-centre.webp"
                alt="Ambulant+ Ladies’ Health Centre"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Women’s health pathway
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Fertility, cycle, wellness, reminders, diagnostics and virtual consultation support
                  within a governed Contactless Medicine environment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Care pathways"
        title="A more complete women’s health experience."
        body="The centre is designed to support women’s health needs without reducing care to a simple calendar, chatbot or generic video consultation."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pathways.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Fertility intelligence
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Fertility support should be trend-aware, not calendar-only.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Where configured, NexRing-supported temperature variation and individual baseline
                trends can add context to fertility review, while clinicians remain responsible for
                interpretation, counselling and appropriate investigation.
              </p>
            </div>

            <div className="grid gap-3">
              {useCases.map((item) => (
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
        eyebrow="Safety boundaries"
        title="Women’s health support must stay clinically safe."
        body="The centre supports access and continuity, but urgent symptoms and complex presentations still need appropriate escalation."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {safetyNotes.map((item) => (
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