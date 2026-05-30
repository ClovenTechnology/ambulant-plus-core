import Link from "next/link";
import {
  ArrowRight,
  Baby,
  BellRing,
  CheckCircle2,
  FileHeart,
  HeartPulse,
  Pill,
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
  title: "Paediatric Centre",
  description:
    "Ambulant+ Paediatric Centre supports child health access, caregiver participation, virtual consultation, device-supported context, diagnostics and medicine fulfilment.",
};

const pathways: Array<{ title: string; body: string; icon: LucideIcon }> = [
  {
    title: "Caregiver-supported consultation",
    body:
      "Parents or caregivers can support the consultation, provide history and join remotely where permissions and workflow allow.",
    icon: Users,
  },
  {
    title: "Child health profile",
    body:
      "Allergies, immunisation context, medicines, conditions, reports and care history can be organised for clinician review.",
    icon: FileHeart,
  },
  {
    title: "Device-supported review",
    body:
      "Supported devices can provide vitals, auscultation or otoscopy context where clinically appropriate and properly supervised.",
    icon: HeartPulse,
  },
  {
    title: "Paediatric clinician access",
    body:
      "Families can access clinician-led virtual care, with escalation to urgent or in-person care where needed.",
    icon: Stethoscope,
  },
  {
    title: "Diagnostics and medicines",
    body:
      "MedReach and CarePort can support home diagnostics and medicine fulfilment where ordered, available and appropriate.",
    icon: TestTube2,
  },
  {
    title: "Reminders",
    body:
      "Medication, hydration, follow-up and appointment reminders can support care continuity for children and families.",
    icon: BellRing,
  },
];

const useCases = [
  "A parent at work can join a consultation for a child at home where permissions allow.",
  "Caregivers can prepare child history, allergies, medicines and reports before review.",
  "Digital stethoscope or otoscope workflows can support clinician review where clinically appropriate.",
  "Medication reminders and CarePort fulfilment can support child medicine continuity.",
  "MedReach can support selected diagnostics where ordered and operationally available.",
  "Clinicians can escalate to urgent or in-person paediatric care when remote review is insufficient.",
];

const safetyNotes = [
  "Young children can deteriorate quickly; urgent symptoms should not wait for routine virtual care.",
  "Breathing difficulty, blue lips, severe drowsiness, dehydration, seizures, severe pain or rapidly worsening symptoms require urgent assessment.",
  "Device readings should support clinician review, not replace parental concern, examination or emergency care.",
];

export default function PaediatricCentrePage() {
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
              Paediatric Centre
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Child health access with caregiver-supported Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ Paediatric Centre supports family-centred child health journeys through
              caregiver participation, structured profiles, device-supported context, clinician-led
              virtual review, MedReach diagnostics and CarePort medicine fulfilment where appropriate.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientSignupUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Create family account <ArrowRight className="h-4 w-4" />
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
                src="/visuals/centres/paediatric-centre.webp"
                alt="Ambulant+ Paediatric Centre"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Family-centred care
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Caregiver-supported virtual care, device context, diagnostics, medicine fulfilment
                  and safe escalation for child health journeys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Paediatric pathways"
        title="Designed for children, caregivers and clinical safety."
        body="The centre supports child health access while preserving urgent-care boundaries and paediatric escalation needs."
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
                Child health continuity
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Better paediatric care starts with the right family context.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Paediatric remote care needs caregiver participation, accurate history, safe device
                use, appropriate medication tracking and a low threshold for escalation when the
                child may need urgent or in-person assessment.
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
        title="Children should be escalated early when risk is unclear."
        body="The Paediatric Centre must support access without encouraging dangerous delay."
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