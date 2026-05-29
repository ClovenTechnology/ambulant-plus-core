import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  HeartPulse,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

const patientJourney = [
  "Create your Ambulant+ patient account.",
  "Complete your profile, contact details, allergies, conditions and medication history.",
  "Add medical-aid details where available or prepare card/cash payment pathways.",
  "Connect supported devices: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing.",
  "Book a clinician or join a scheduled consultation.",
  "Use CarePort for medicine fulfilment and MedReach for home diagnostics where appropriate.",
];

const patientCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Contactless Medicine",
    body:
      "Access clinician-led care supported by connected devices, structured profile data, reports and care-navigation workflows.",
    icon: Stethoscope,
  },
  {
    title: "Getting started",
    body:
      "Create an account, complete your profile, add relevant health information and prepare your payment or medical-aid pathway.",
    icon: Smartphone,
  },
  {
    title: "Booking a clinician",
    body:
      "Choose an available care pathway, confirm payment or medical-aid readiness, then join your virtual consultation.",
    icon: HeartPulse,
  },
  {
    title: "Devices and troubleshooting",
    body:
      "Connect supported devices, follow setup instructions and use device pathways only within their intended care context.",
    icon: CheckCircle2,
  },
  {
    title: "Use MedReach/CarePort",
    body:
      "Request home diagnostics or medicine fulfilment when clinically and operationally appropriate.",
    icon: ShieldCheck,
  },
  {
    title: "Wallet and plans",
    body:
      "Fund wallet, pay for consultations, buy devices, support diagnostics and access available care plans.",
    icon: WalletCards,
  },
];

const deviceNotes = [
  "Health Monitor supports blood pressure, SpO₂, temperature, glucose, heart-rate and ECG workflows.",
  "Digital Stethoscope supports heart and lung auscultation capture, playback and clinician review.",
  "HD Otoscope supports ear-imaging capture and review in supported remote assessment workflows.",
  "NexRing supports longitudinal signals such as readiness, sleep, recovery and fertility-relevant temperature variation.",
];

const medicalAidNotes = [
  "Patients can add medical-aid details to their profile where supported.",
  "Medical-aid readiness or payment preflight may be available before selected care journeys.",
  "Claims, reimbursement and cover depend on scheme rules, provider status and platform configuration.",
  "Patients may also use cash/card pathways where medical-aid claiming is unavailable or not applicable.",
];

export const metadata = {
  title: "Patients",
  description:
    "How patients use Ambulant+ Contactless Medicine, book clinicians, connect devices, use MedReach and CarePort, manage wallet funding and prepare medical-aid details.",
};

export default function PatientsPage() {
  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Patient App
          </div>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            Your protected workspace for Contactless Medicine.
          </h1>

          <p className="mt-6 text-lg leading-9 text-slate-600">
            Ambulant+ helps patients access clinician-led virtual care supported by
            connected devices, profile readiness, medical-aid or payment pathways,
            CarePort medicine fulfilment, MedReach home diagnostics and InsightCore-powered
            care visibility.
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

        <div className="glass-panel rounded-[38px] p-6">
          <div className="rounded-[30px] border border-cyan-100 bg-slate-950 p-6 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
              Patient journey
            </div>

            <div className="mt-6 grid gap-3">
              {patientJourney.map((item, index) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-300/20 text-xs font-bold text-cyan-100">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Patient capabilities"
        title="Everything patients need to begin safely."
        body="The patient experience is designed around readiness: profile completion, payment or medical-aid preparation, device connection, booking, diagnostics and medicine continuity."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patientCards.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Supported devices
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Connect devices that support the care journey.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
            Ambulant+ focuses on a defined device ecosystem rather than unsupported wearable
            sprawl. Device data supports clinician review but does not replace emergency care,
            in-person examination where required or professional clinical judgement.
          </p>
          <Link
            href="/devices"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
          >
            Explore devices <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-3">
          {deviceNotes.map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-3xl border border-white/70 bg-white/78 p-5 shadow-sm"
            >
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionShell
        eyebrow="Medical aid and payment readiness"
        title="Medical-aid readiness should happen before avoidable failed journeys."
        body="Patients can add medical-aid details to their profile, and where supported, Ambulant+ can help verify readiness before care workflows proceed."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {medicalAidNotes.map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-3xl border border-white/70 bg-white/78 p-5 shadow-sm"
            >
              <CreditCard className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
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