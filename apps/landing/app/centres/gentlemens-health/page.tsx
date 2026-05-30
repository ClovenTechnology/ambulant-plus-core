import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Dumbbell,
  FileHeart,
  HeartPulse,
  Pill,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  UserRound,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Gentlemen’s Health",
  description:
    "Ambulant+ Gentlemen’s Health supports men’s health, vitality, screening, wellness, remote consultation, device context, diagnostics and medication-continuity workflows.",
};

const pathways: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Men’s health review",
    body:
      "Support for private clinician-led review of men’s health, vitality, lifestyle, risk factors and care-navigation needs.",
    icon: UserRound,
  },
  {
    title: "Cardiometabolic monitoring",
    body:
      "Vitals, activity, sleep and longitudinal trends can support prevention-focused review where devices are configured.",
    icon: HeartPulse,
  },
  {
    title: "Screening and diagnostics",
    body:
      "MedReach can support selected diagnostics where ordered, appropriate and operationally available.",
    icon: TestTube2,
  },
  {
    title: "Medication continuity",
    body:
      "CarePort and reminders can support medicine access, refill continuity and adherence behaviour where configured.",
    icon: Pill,
  },
  {
    title: "Fitness and recovery",
    body:
      "NexRing-linked sleep, readiness, activity and recovery signals can support wellness goals where available.",
    icon: Dumbbell,
  },
  {
    title: "Safe escalation",
    body:
      "Concerning symptoms should be escalated to urgent, in-person or specialist care where clinically indicated.",
    icon: ShieldCheck,
  },
];

const useCases = [
  "Blood pressure, glucose, sleep, activity and lifestyle review for prevention-focused care.",
  "Private virtual consultation for men’s health concerns, symptoms or screening questions.",
  "Medication reminders and CarePort fulfilment for chronic or prescribed medicines.",
  "MedReach diagnostics for selected tests where ordered and appropriate.",
  "NexRing-supported activity, sleep and recovery context for wellbeing and lifestyle improvement.",
  "Clinician-led escalation when symptoms suggest urgent or in-person assessment.",
];

const safetyNotes = [
  "Chest pain, severe breathlessness, stroke-like symptoms, collapse or severe sudden pain require emergency assessment.",
  "Men’s health symptoms should not be ignored because they are private or uncomfortable to discuss.",
  "Device trends support review but do not replace clinician assessment, diagnostics or urgent care.",
];

export default function GentlemensHealthPage() {
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
              Gentlemen’s Health
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Men’s health, screening and vitality support through Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ Gentlemen’s Health supports private clinician-led review, prevention-focused
              monitoring, wellness routines, diagnostics coordination, medicine continuity and safe
              escalation for men’s health journeys.
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
                src="/visuals/centres/gentlemens-health.webp"
                alt="Ambulant+ Gentlemen’s Health"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Men’s health pathway
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Screening, vitality, fitness, wellness, diagnostics, medication continuity and
                  private clinician-led care support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Men’s health pathways"
        title="Prevention-focused care, not delayed care."
        body="The centre supports privacy, access and continuity while encouraging early review and safe escalation."
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
                Prevention and continuity
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                The best time to act is before symptoms become expensive complications.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Men often delay care until symptoms interfere with daily life. Ambulant+ can help
                make review easier, more private and more continuous through remote access, supported
                monitoring, reminders and diagnostics coordination.
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
        title="Private symptoms still deserve early care."
        body="The centre should reduce barriers to seeking help while remaining clear about emergency and specialist escalation."
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