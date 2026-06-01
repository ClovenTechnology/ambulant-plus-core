import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  HeartPulse,
  Search,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";
import CTA from "@/components/CTA";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Find a Doctor and Book an Appointment | Ambulant+ Resources",
  description:
    "Learn how patients can find a doctor online, book an Ambulant+ virtual consultation, prepare supported devices, complete payment or medical-aid readiness and understand when remote consultation is appropriate.",
  keywords: [
    "find a doctor online",
    "book doctor online",
    "book doctor appointment South Africa",
    "online doctor South Africa",
    "virtual doctor consultation",
    "remote consultation",
    "doctor booking app",
    "Ambulant+ doctor booking",
    "Contactless Medicine appointment",
    "telemedicine appointment",
    "virtual care appointment",
    "book a clinician online",
  ],
  alternates: {
    canonical:
      "https://ambulantplus.co.za/resources/find-a-doctor-and-book-appointment",
  },
};

const bookingSteps = [
  {
    title: "Create or access your patient workspace",
    body:
      "Use the protected Ambulant+ patient app to manage your profile, contact details, care context, medical-aid information where supported and appointment history.",
    icon: Smartphone,
  },
  {
    title: "Find a suitable clinician",
    body:
      "Browse available doctors or clinicians by specialty, appointment type, profile information, availability and care pathway where these options are available.",
    icon: Search,
  },
  {
    title: "Choose your appointment time",
    body:
      "Open the clinician’s calendar, choose an available consultation slot and confirm the booking details before proceeding.",
    icon: CalendarCheck,
  },
  {
    title: "Complete payment or readiness checks",
    body:
      "Depending on the care pathway, you may complete card payment, wallet use, cash/card route, medical-aid readiness or sponsor-linked access where supported.",
    icon: CreditCard,
  },
  {
    title: "Prepare your care context",
    body:
      "Add relevant symptoms, medication history, allergies, prior reports, connected-device readings or care notes so the clinician has better context.",
    icon: ClipboardCheck,
  },
  {
    title: "Join the consultation",
    body:
      "Join at the scheduled time, follow clinician instructions and use supported devices only where appropriate for your care pathway.",
    icon: Stethoscope,
  },
];

const preparationTips = [
  "Charge supported devices before the appointment.",
  "Check that your phone, tablet or computer has internet access.",
  "Prepare a quiet, private space for the consultation.",
  "Keep medication names, allergies and previous reports nearby.",
  "Wear the blood-pressure cuff correctly if using the Health Monitor.",
  "Connect the NexRing early enough for meaningful trend data where relevant.",
  "Use the Digital Stethoscope or HD Otoscope only as guided by the clinician or workflow.",
  "Seek urgent or emergency care instead of booking remote consultation when symptoms are severe.",
];

const whenRemoteHelps = [
  "Follow-up review for stable or improving symptoms.",
  "Medication review and treatment-plan discussion.",
  "Chronic-care monitoring where remote vitals can support review.",
  "Fertility, wellness, lifestyle or preventive-care consultations where appropriate.",
  "Device-supported review using Health Monitor, Digital Stethoscope, HD Otoscope or NexRing workflows.",
  "Care coordination involving diagnostics, pharmacy fulfilment, summaries or programme follow-up.",
];

const whenNotToUse = [
  "Chest pain, severe shortness of breath, stroke symptoms or collapse.",
  "Severe bleeding, major injury, poisoning or suspected emergency.",
  "Severe abdominal pain, severe allergic reaction or rapidly worsening illness.",
  "A child or adult who is very drowsy, confused, blue, fitting or difficult to wake.",
  "Any situation where in-person examination or emergency care is clearly required.",
  "Any symptom that your clinician or local guidance says requires urgent assessment.",
];

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700"
        >
          Back to resources <ArrowRight className="h-4 w-4 rotate-180" />
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Patient booking guide
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
              Find a doctor and book an Ambulant+ appointment.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ helps patients move from search to scheduled consultation
              through a protected patient workspace, where clinician discovery,
              appointment booking, payment or medical-aid readiness, care context
              and supported device preparation can be organised.
            </p>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              This guide explains how to prepare for a better remote consultation
              while keeping clear boundaries around urgent care and in-person
              assessment.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientAppUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Access Patient App <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/patients/getting-started"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                View patient getting started guide <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[36px] bg-slate-950 p-6 text-white shadow-glow">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
              Booking flow
            </div>

            <div className="mt-6 space-y-3">
              {[
                "Access your protected patient workspace.",
                "Search for a suitable clinician or care pathway.",
                "Choose a time and confirm appointment details.",
                "Complete payment, wallet or medical-aid readiness where supported.",
                "Prepare symptoms, history, reports and connected devices.",
                "Join the consultation and follow clinician guidance.",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            How booking works
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            A simple patient journey with clinical context behind it.
          </h2>
          <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
            A good virtual consultation starts before the video call. Ambulant+
            helps organise the information, readiness and workflow around the visit.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bookingSteps.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[34px] bg-cyan-50/70 p-6 md:p-8">
            <UserRoundCheck className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              Prepare before your consultation.
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              Preparation improves the quality of a remote review. Keep your care
              context ready and use supported devices only where appropriate.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {preparationTips.map((item) => (
              <div key={item} className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-cyan-700" />
                <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-panel rounded-[34px] p-6 md:p-8">
            <HeartPulse className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              When remote consultation can be useful.
            </h2>
            <div className="mt-6 space-y-3">
              {whenRemoteHelps.map((item) => (
                <div key={item} className="rounded-2xl bg-cyan-50/70 p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
            <AlertTriangle className="h-8 w-8 text-cyan-200" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              When not to use remote consultation.
            </h2>
            <div className="mt-6 space-y-3">
              {whenNotToUse.map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4">
                  <AlertTriangle className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <ShieldCheck className="h-7 w-7 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Booking is access. Clinical judgement remains central.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
            Ambulant+ helps patients access care, organise consultation context
            and prepare supported device readings. It does not replace emergency
            medical services, in-person examination where required or the judgement
            of a qualified clinician.
          </p>
        </div>

        <div className="mt-8">
          <CTA />
        </div>
      </section>
    </main>
  );
}