import Link from "next/link";
import {
  ArrowRight,
  Baby,
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
  UserRoundCheck,
  WalletCards,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Patients",
  description:
    "Ambulant+ helps patients access Contactless Medicine, complete their health profile, connect supported devices, book clinicians, use MedReach diagnostics, CarePort fulfilment, reminders, wallet and medical-aid pathways.",
  keywords: [
    "patient health app South Africa",
    "personal health management software",
    "virtual doctor consultation",
    "online doctor South Africa",
    "doctor booking platform",
    "find a doctor online",
    "book a doctor online",
    "instant care",
    "instant consultation",
    "primary care app",
    "remote consultation with vitals",
    "remote vitals",
    "home vitals monitoring",
    "patient health passport",
    "daily health score",
    "home monitoring app",
    "connected medical devices at home",
    "IoMT patient app",
    "iomt patient app",
    "clinical data for patients",
    "health records app",
    "medication reminders",
    "camera verified medication adherence",
    "CarePort medicine delivery",
    "MedReach home diagnostics",
    "medical aid readiness",
    "wallet health app",
  ],
};

const patientJourney = [
  {
    title: "Create account",
    body: "Open a protected Ambulant+ patient account and begin your health profile.",
  },
  {
    title: "Complete profile",
    body: "Add contact details, allergies, conditions, current medication, medical history and emergency contacts.",
  },
  {
    title: "Prepare payment or medical aid",
    body: "Add medical-aid information where supported, or prepare wallet, card or cash payment options.",
  },
  {
    title: "Connect devices",
    body: "Set up supported devices such as Health Monitor, Digital Stethoscope, HD Otoscope and NexRing.",
  },
  {
    title: "Book care",
    body: "Book an available clinician, confirm readiness and join your virtual care session.",
  },
  {
    title: "Continue care",
    body: "Use reminders, reports, MedReach diagnostics, CarePort fulfilment and follow-up pathways where appropriate.",
  },
];

const patientCapabilities: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Contactless Medicine",
    body:
      "Access clinician-led virtual care supported by structured profile data, device context, reports and care-continuity workflows.",
    icon: Stethoscope,
  },
  {
    title: "Health profile",
    body:
      "Keep allergies, conditions, medicines, emergency contacts, reports and care history ready before consultations.",
    icon: FileHeart,
  },
  {
    title: "Device-supported review",
    body:
      "Use supported devices to provide vitals, auscultation, otoscopy and longitudinal trend context where clinically appropriate.",
    icon: HeartPulse,
  },
  {
    title: "Medical aid readiness",
    body:
      "Add medical-aid details where available and allow supported preflight checks before eligible care workflows proceed.",
    icon: CreditCard,
  },
  {
    title: "Wallet and payments",
    body:
      "Fund wallet, pay for consultations, support diagnostics, buy devices where available and manage payment pathways.",
    icon: WalletCards,
  },
  {
    title: "Care continuity",
    body:
      "Use MedReach for home diagnostics and CarePort for medicine fulfilment where clinically and operationally appropriate.",
    icon: ShieldCheck,
  },
];

const deviceNotes = [
  {
    title: "Health Monitor",
    body:
      "Supports blood pressure, oxygen saturation, temperature, glucose, heart-rate and ECG screening workflows where available.",
  },
  {
    title: "Digital Stethoscope",
    body:
      "Supports heart and lung sound capture, playback and clinician review in device-supported consultations.",
  },
  {
    title: "HD Otoscope",
    body:
      "Supports ear-imaging capture and review for selected remote-assessment workflows where appropriate.",
  },
  {
    title: "NexRing",
    body:
      "Supports longitudinal signals such as sleep, readiness, recovery, activity and temperature-variation context.",
  },
];

const reminderCapabilities = [
  {
    title: "Medication reminders",
    body:
      "Medication reminders can sync from eRx workflows where configured, helping patients keep track of dose timing and medicine continuity.",
    icon: Pill,
  },
  {
    title: "Camera verification",
    body:
      "Where enabled, camera-supported verification can help strengthen adherence evidence and build medication behaviour scores.",
    icon: UserRoundCheck,
  },
  {
    title: "Hydration, sleep and activity",
    body:
      "Daily health routines can connect to supported reminders and NexRing-linked wellness signals where the patient grants permission.",
    icon: BellRing,
  },
  {
    title: "Daily health passport",
    body:
      "Patients can use structured daily scores and self-check context to understand readiness, risk prompts and care-navigation needs.",
    icon: FileHeart,
  },
];

const medicalAidNotes = [
  "Patients can add medical-aid details to their profile where supported.",
  "Medical-aid readiness or payment preflight may be available before selected care journeys.",
  "Claims, reimbursement and cover depend on scheme rules, provider status and platform configuration.",
  "Patients may also use wallet, card or cash pathways where medical-aid claiming is unavailable or not applicable.",
  "Participating medical aids, HMOs, employers or sponsors may make products or benefits discoverable inside Ambulant+ where configured.",
];

const familyUseCases = [
  "A parent at work can join a consultation for a sick child at home where permissions and workflow allow it.",
  "Couples can attend fertility consultations together even when they are in different locations.",
  "Multiple clinicians can participate in selected multidisciplinary sessions where clinically useful.",
  "Care partners can support a patient journey only where permissions, role boundaries and privacy rules allow it.",
];

const safetyBoundaries = [
  "Ambulant+ is not an emergency service.",
  "Device data supports clinician review; it does not create automatic diagnosis.",
  "Some symptoms still require urgent, emergency or in-person care.",
  "Patients should follow clinician advice, prescription instructions and local emergency guidance.",
];

export default function PatientsPage() {
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
              Patient App
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Your protected workspace for Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ helps patients access clinician-led virtual care supported by profile
              readiness, connected devices, medical-aid or payment pathways, MedReach home
              diagnostics, CarePort medicine fulfilment and InsightCore-powered care visibility.
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
                View getting-started guide <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/patients/ami-care-companion.webp"
                alt="Ambulant+ patient care companion interface"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Patient command centre
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Profile, vitals, medicines, appointments, reports, device context, care journeys
                  and payment readiness in one protected workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Patient journey"
        title="From account creation to continuous care."
        body="The patient experience is designed around readiness: complete profile, payment or medical-aid preparation, device connection, booking, diagnostics, medicine fulfilment and follow-up."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patientJourney.map((step, index) => (
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

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-3">
        {patientCapabilities.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/patients/patient-device-setup.webp"
              alt="Patient setting up Ambulant+ connected devices before a virtual consultation"
              className="h-80 w-full object-cover"
            />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Device setup
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Better remote care starts before the consultation begins.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              Ambulant+ focuses on a defined connected-device ecosystem rather than unsupported
              wearable sprawl. Device data gives clinicians additional context where remote review
              is appropriate.
            </p>

            <div className="mt-6 grid gap-3">
              {deviceNotes.map((item) => (
                <div key={item.title} className="rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>

            <Link
              href="/devices"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Explore devices <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Reminders and adherence"
        title="Care does not end when the prescription is written."
        body="Ambulant+ connects medication reminders, adherence scoring, eRx-linked medicine continuity and daily lifestyle prompts into the patient journey."
      >
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/reminders/pills-camera-verification.webp"
              alt="Ambulant+ medication reminders and camera verification"
              className="h-80 w-full object-cover"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {reminderCapabilities.map(({ title, body, icon: Icon }) => (
              <div key={title} className="glass-panel rounded-[30px] p-6">
                <Icon className="h-7 w-7 text-cyan-700" />
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Medical aid and payment readiness
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Avoid failed care journeys by preparing payment before care begins.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Patients can add medical-aid information, use wallet or card pathways where
                available, and prepare consultation, diagnostics, device or pharmacy fulfilment
                payments before the workflow fails at the last step.
              </p>
            </div>

            <div className="grid gap-3">
              {medicalAidNotes.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4">
                  <CreditCard className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Family and multi-user care"
        title="Real healthcare often involves more than one person."
        body="Ambulant+ can support family, couple and multidisciplinary care sessions where permission, workflow and clinical appropriateness allow it."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {familyUseCases.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <Baby className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Daily health passport
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              A clearer view of everyday health readiness.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              The Health Passport concept helps patients organise daily health context, self-check
              prompts, device signals, medication behaviour and care readiness into a more useful
              health picture.
            </p>
          </div>

          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/self-check/health-passport-dashboard.webp"
              alt="Ambulant+ health passport and daily score dashboard"
              className="h-80 w-full object-cover"
            />
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Clinical safety"
        title="Remote care still needs clear boundaries."
        body="Ambulant+ should support patients without encouraging unsafe delay, overreliance on device readings or misunderstanding of emergency risk."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {safetyBoundaries.map((item) => (
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