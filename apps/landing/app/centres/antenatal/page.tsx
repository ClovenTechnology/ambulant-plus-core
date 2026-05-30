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
  TestTube2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Antenatal Centre",
  description:
    "Ambulant+ Antenatal Centre supports pregnancy care navigation, virtual consultation, reminders, reports, diagnostics coordination and safe escalation boundaries.",
};

const pathways: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Pregnancy profile",
    body:
      "Organise pregnancy history, reports, medicines, allergies, previous births, risk notes and emergency contacts for care review.",
    icon: FileHeart,
  },
  {
    title: "Antenatal consultations",
    body:
      "Access clinician-led virtual review and care navigation where remote care is appropriate.",
    icon: Stethoscope,
  },
  {
    title: "Partner participation",
    body:
      "Partners can join appropriate sessions remotely where permissions and workflow allow.",
    icon: Users,
  },
  {
    title: "Reminders and milestones",
    body:
      "Support appointment reminders, medicine or supplement reminders, hydration prompts and antenatal milestone planning.",
    icon: CalendarCheck2,
  },
  {
    title: "Diagnostics coordination",
    body:
      "MedReach can support selected home or coordinated diagnostics where ordered and available.",
    icon: TestTube2,
  },
  {
    title: "Escalation safety",
    body:
      "Pregnancy symptoms may require urgent or in-person assessment. The centre must support safe escalation.",
    icon: ShieldCheck,
  },
];

const careMoments = [
  "Early pregnancy information gathering and profile readiness.",
  "Routine antenatal check-in where virtual care is appropriate.",
  "Medication, supplement, hydration and appointment reminders.",
  "Lab request coordination where home diagnostics are appropriate and available.",
  "Partner-supported consultation sessions from different locations.",
  "Care navigation when symptoms require urgent or in-person review.",
];

const safetyNotes = [
  "Bleeding, severe abdominal pain, severe headache, visual disturbance, collapse, breathlessness, seizures or reduced fetal movements require urgent assessment.",
  "Antenatal remote care should not replace scans, examinations, emergency maternity care or clinician-directed in-person review.",
  "Device readings and self-reported symptoms are supportive context, not automatic diagnosis.",
];

export default function AntenatalCentrePage() {
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
              Antenatal Centre
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Pregnancy care navigation with safe remote support.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ Antenatal Centre supports pregnancy journeys through profile readiness,
              virtual care navigation, reminders, partner participation, diagnostics coordination,
              report organisation and clear escalation boundaries.
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
                src="/visuals/centres/antenatal-centre.webp"
                alt="Ambulant+ Antenatal Centre"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Antenatal support
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Pregnancy profile, reminders, report organisation, diagnostics coordination and
                  escalation-aware virtual care support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Pregnancy pathways"
        title="Support the journey without weakening safety boundaries."
        body="The Antenatal Centre is designed for care navigation and continuity, while preserving urgent maternity-care escalation."
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
                Care moments
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Pregnancy support needs continuity, documentation and escalation clarity.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Antenatal care is not a single appointment. Ambulant+ can help patients organise
                information, prepare for reviews, manage reminders and navigate the right level of
                care when symptoms or risk factors change.
              </p>
            </div>

            <div className="grid gap-3">
              {careMoments.map((item) => (
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
        title="Antenatal symptoms should be escalated early when concerning."
        body="Remote support must never delay urgent maternity assessment."
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