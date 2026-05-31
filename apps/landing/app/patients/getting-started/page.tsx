import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  CreditCard,
  FileHeart,
  HeartPulse,
  Pill,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  TestTube2,
  WalletCards,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Getting Started as a Patient",
  description:
    "A practical patient guide for creating an Ambulant+ account, completing profile information, adding medical aid, connecting devices, booking clinicians, funding wallet and using CarePort or MedReach.",
  keywords: [
    "Ambulant+ patient setup",
    "how to use Ambulant+",
    "create patient account",
    "connect health devices",
    "connect IoMT devices",
    "link medical hardware",
    "book virtual doctor",
    "book online doctor",
    "find a doctor",
    "doctor booking",
    "patient onboarding",
    "medical aid setup",
    "wallet setup",
    "device setup",
    "Health Monitor setup",
    "Digital Stethoscope setup",
    "HD Otoscope setup",
    "NexRing setup",
    "remote vitals setup",
    "home monitoring setup",
    "CarePort setup",
    "MedReach setup",
  ],
};

const setupSteps = [
  {
    title: "Create your account",
    body:
      "Start by creating your protected Ambulant+ patient account using the patient signup route.",
    icon: Smartphone,
  },
  {
    title: "Complete your profile",
    body:
      "Add contact details, allergies, current conditions, medicines, previous history and emergency contacts.",
    icon: FileHeart,
  },
  {
    title: "Add payment or medical aid",
    body:
      "Add medical-aid details where supported, or prepare wallet, card or cash payment options.",
    icon: CreditCard,
  },
  {
    title: "Connect devices",
    body:
      "Set up Health Monitor, Digital Stethoscope, HD Otoscope or NexRing according to the device pathway available to you.",
    icon: Watch,
  },
  {
    title: "Book a clinician",
    body:
      "Choose an available clinician or care pathway, confirm readiness and join your scheduled session.",
    icon: CalendarCheck2,
  },
  {
    title: "Continue care",
    body:
      "Use MedReach, CarePort, reminders, reports and follow-up workflows where clinically and operationally appropriate.",
    icon: ShieldCheck,
  },
];

const profileChecklist = [
  "Full name and contact details",
  "Date of birth and demographic details where required",
  "Emergency contact",
  "Allergies and medication reactions",
  "Current medication list",
  "Known medical conditions",
  "Past operations or major hospital admissions",
  "Medical-aid or sponsor information where supported",
];

const consultationPrep = [
  "Join from a private, safe and well-lit environment.",
  "Keep your supported devices charged and nearby.",
  "Complete requested vitals or device checks before the consultation where applicable.",
  "Have current medicines, recent reports and medical-aid card details ready.",
  "Use emergency services immediately if symptoms are urgent or severe.",
];

const connectedPathways: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Clinician booking",
    body:
      "Book a clinician, prepare profile context, complete payment readiness and join the consultation.",
    icon: Stethoscope,
  },
  {
    title: "Device readings",
    body:
      "Use supported devices to capture vitals, auscultation, otoscopy or longitudinal wellness context where appropriate.",
    icon: HeartPulse,
  },
  {
    title: "Medication reminders",
    body:
      "Use eRx-linked reminders, camera verification where enabled and adherence scoring to support medicine behaviour.",
    icon: Pill,
  },
  {
    title: "MedReach diagnostics",
    body:
      "Use home diagnostics and phlebotomy workflows where ordered, available and clinically appropriate.",
    icon: TestTube2,
  },
  {
    title: "CarePort fulfilment",
    body:
      "Use pharmacy fulfilment and last-mile medicine delivery where available and appropriate.",
    icon: BellRing,
  },
  {
    title: "Wallet and plans",
    body:
      "Use wallet funding, payment pathways, medical-aid readiness and available care plans.",
    icon: WalletCards,
  },
];

const troubleshooting = [
  "If a device will not connect, check battery, Bluetooth, internet connection and device pairing instructions.",
  "If a reading looks unusual, repeat the measurement correctly and discuss it with a clinician where appropriate.",
  "If you cannot join a consultation, check your internet connection, login status, camera and microphone permissions.",
  "If payment or medical-aid readiness fails, use the available support route or alternative payment pathway where available.",
  "If symptoms are severe, worsening or urgent, do not wait for platform support; contact emergency services immediately.",
];

export default function PatientGettingStartedPage() {
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
              Patients
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Getting started as an Ambulant+ patient.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              This guide helps patients prepare for Contactless Medicine: create an account,
              complete a health profile, add medical-aid or payment details, connect supported
              devices, book clinicians, fund wallet, and use MedReach or CarePort where available.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientSignupUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Create patient account <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/patients"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Back to patient page <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/patients/patient-device-setup.webp"
                alt="Patient setting up Ambulant+ connected devices at home"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Setup readiness
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Profile completion, device setup, medical-aid or payment readiness and booking
                  preparation before consultation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Step-by-step"
        title="A safer care journey starts with proper setup."
        body="Ambulant+ works best when patients complete profile, payment, device and booking preparation before care begins."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {setupSteps.map(({ title, body, icon: Icon }, index) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <div className="flex items-center justify-between gap-4">
                <Icon className="h-7 w-7 text-cyan-700" />
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                  {index + 1}
                </div>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-2">
        <div className="glass-panel rounded-[34px] p-7">
          <FileHeart className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Profile checklist
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {profileChecklist.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <CalendarCheck2 className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Consultation preparation
          </h2>
          <div className="mt-5 grid gap-3">
            {consultationPrep.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Connected pathways"
        title="The patient app connects care, diagnostics, medicine and payment readiness."
        body="The goal is to avoid fragmented patient journeys where consultation, vitals, diagnostics, pharmacy and payment all happen in separate places."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connectedPathways.map(({ title, body, icon: Icon }) => (
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
                Troubleshooting
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Small setup issues should not become failed care journeys.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Patients should prepare devices, connectivity, profile details and payment readiness
                before the consultation. Urgent symptoms should always bypass routine troubleshooting.
              </p>
            </div>

            <div className="grid gap-3">
              {troubleshooting.map((item) => (
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
        eyebrow="Safety"
        title="Know when not to wait."
        body="Ambulant+ supports structured remote care, but emergency symptoms and certain clinical situations still require urgent or in-person assessment."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Call local emergency services immediately for severe, life-threatening or rapidly worsening symptoms.",
            "Follow clinician instructions if you are advised to attend urgent or in-person care.",
            "Do not rely on device readings alone if you feel seriously unwell.",
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