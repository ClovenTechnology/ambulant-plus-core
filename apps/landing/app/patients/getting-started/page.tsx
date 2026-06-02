import Link from "next/link";
import Script from "next/script";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileHeart,
  Fingerprint,
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
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = {
  title: "Getting Started as a Patient | Ambulant+ Patient Journey Guide",
  description:
    "A master Ambulant+ patient journey guide covering account access, profile readiness, doctor booking, symptom triage, appointment preparation, treatment plans, CarePort, MedReach, reminders, Health Passport and personal health management.",
  keywords: [
    "Ambulant+ patient setup",
    "how to use Ambulant+",
    "create patient account",
    "patient account access",
    "passkey sign in",
    "email OTP login",
    "book online doctor",
    "find a doctor",
    "virtual consultation preparation",
    "symptom triage",
    "remote vitals",
    "home vitals monitoring",
    "Health Passport",
    "personal health management",
    "medication reminders",
    "CarePort patient guide",
    "MedReach patient guide",
    "home diagnostics",
    "medicine delivery",
    "remote patient monitoring",
    "Contactless Medicine patient guide",
  ],
  alternates: {
    canonical: absoluteUrl("/patients/getting-started"),
  },
};

const lifecycleSteps: Array<{
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: LucideIcon;
}> = [
  {
    title: "Create and secure your account",
    body:
      "Choose standard or Premium signup, sign in with email/password or email OTP, then add a passkey from Security settings where supported.",
    href: "/resources/patient-account-access",
    cta: "Open account guide",
    icon: Fingerprint,
  },
  {
    title: "Complete your health profile",
    body:
      "Add contact details, allergies, medication, conditions, prior history, emergency contacts, medical-aid details and delivery information where available.",
    href: "/patients",
    cta: "View patient workspace",
    icon: FileHeart,
  },
  {
    title: "Find a doctor and book care",
    body:
      "Search available clinicians, choose the right appointment type, confirm time and prepare your care context before the session.",
    href: "/resources/find-a-doctor-and-book-appointment",
    cta: "Book better",
    icon: CalendarCheck2,
  },
  {
    title: "Prepare before the appointment",
    body:
      "Describe symptoms clearly, charge devices, test your connection, join on time and complete supported lobby vitals before clinician review.",
    href: "/resources/prepare-for-your-appointment",
    cta: "Prepare properly",
    icon: ClipboardCheck,
  },
  {
    title: "Attend the consultation",
    body:
      "Join from a private, quiet and well-lit setting. Keep devices and medicines nearby and follow clinician instructions during the virtual session.",
    href: "/resources/prepare-for-your-appointment",
    cta: "Review session readiness",
    icon: Stethoscope,
  },
  {
    title: "Continue care after the session",
    body:
      "Review treatment plans, follow reminders, use CarePort or MedReach where ordered, and book follow-up with the same or another clinician.",
    href: "/resources/after-your-consultation",
    cta: "Continue care",
    icon: ShieldCheck,
  },
];

const resourceCards: Array<{
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
  badge: string;
}> = [
  {
    title: "Patient account access",
    body:
      "Standard signup, Premium signup, password login, email OTP, passkey setup, recovery and biometric privacy explanation.",
    href: "/resources/patient-account-access",
    icon: Fingerprint,
    badge: "Secure access",
  },
  {
    title: "Find a doctor and book appointment",
    body:
      "How to search clinicians, select appointment types, confirm readiness and prepare useful care context.",
    href: "/resources/find-a-doctor-and-book-appointment",
    icon: CalendarCheck2,
    badge: "Booking",
  },
  {
    title: "Prepare for your appointment",
    body:
      "Symptom quality, triage details, lobby vitals, device charging, camera/audio checks and being on time.",
    href: "/resources/prepare-for-your-appointment",
    icon: ClipboardCheck,
    badge: "Appointment prep",
  },
  {
    title: "After your consultation",
    body:
      "Treatment plans, prescriptions, MedReach orders, reminders, follow-up booking and escalation instructions.",
    href: "/resources/after-your-consultation",
    icon: ShieldCheck,
    badge: "Care continuity",
  },
  {
    title: "Personal health management",
    body:
      "Health Passport, reminders, self-checks, home vitals, family care and longitudinal trend guidance.",
    href: "/resources/personal-health-management",
    icon: HeartPulse,
    badge: "Longitudinal care",
  },
  {
    title: "CarePort patient guide",
    body:
      "eRx routing, pharmacy preparation, dispatch updates, delivery tracking, proof-of-delivery and medication continuity.",
    href: "/resources/careport-patient-guide",
    icon: Pill,
    badge: "Medicines",
  },
  {
    title: "MedReach patient guide",
    body:
      "Lab orders, home blood draws, phlebotomist preparation, specimen handling, laboratory handover and results.",
    href: "/resources/medreach-patient-guide",
    icon: TestTube2,
    badge: "Diagnostics",
  },
];

const profileChecklist = [
  "Full name, contact details and preferred communication route.",
  "Date of birth, demographic information and identity details where required.",
  "Emergency contact and relationship.",
  "Allergies, medicine reactions and important safety alerts.",
  "Current medicines, doses, frequency and adherence challenges.",
  "Known medical conditions, previous operations and major hospital admissions.",
  "Medical-aid, sponsor, wallet, card or other supported payment details.",
  "Default delivery address for CarePort medicine fulfilment where available.",
];

const triageQuality = [
  {
    weak: "I have chest pain.",
    strong:
      "Central chest tightness for two days, worse when walking upstairs, associated with sweating and shortness of breath.",
  },
  {
    weak: "My child has fever.",
    strong:
      "Fever since yesterday evening, highest 39°C, reduced briefly after paracetamol, now with poor feeding and reduced wet nappies.",
  },
  {
    weak: "I feel dizzy.",
    strong:
      "Dizziness when standing for three days, worse in the morning, associated with palpitations and home BP readings around 95/60.",
  },
];

const deviceGuides: Array<{
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "Health Monitor",
    body:
      "Prepare blood pressure, oxygen saturation, temperature, glucose, heart-rate and ECG workflows where supported.",
    href: "/resources/health-monitor-setup",
    icon: HeartPulse,
  },
  {
    title: "Digital Stethoscope",
    body:
      "Prepare heart and lung sound capture, playback and follow-up comparison where clinician-led review supports it.",
    href: "/resources/digital-stethoscope-workflow",
    icon: Stethoscope,
  },
  {
    title: "HD Otoscope",
    body:
      "Prepare safe remote image capture for selected ear, nose, throat or skin workflows where appropriate.",
    href: "/resources/hd-otoscope-workflow",
    icon: UserRoundCheck,
  },
  {
    title: "NexRing",
    body:
      "Understand sizing, wearing position, trend generation and longitudinal wellness context.",
    href: "/resources/nexring-setup",
    icon: Watch,
  },
];

const afterCareTasks = [
  "Read your consultation summary and treatment instructions.",
  "Check whether prescriptions were routed to CarePort where available.",
  "Check whether lab orders or home blood draw workflows were routed to MedReach where available.",
  "Set or confirm medication reminders and care-plan tasks.",
  "Book follow-up with the same clinician if continuity is important, or another clinician if needed.",
  "Escalate urgently if symptoms worsen or clinician safety-net instructions are triggered.",
];

const faqItems = [
  {
    question: "What is the best first step for a new Ambulant+ patient?",
    answer:
      "Create a patient account, complete your health profile, prepare payment or medical-aid details, then review the patient account access and booking guides before your first consultation.",
  },
  {
    question: "Can I use passkey sign-in immediately?",
    answer:
      "No. You first sign in with email and password or email OTP, then add a passkey from Security settings. After that, supported devices can use passkey sign-in.",
  },
  {
    question: "What should I write in my symptom description?",
    answer:
      "Include when symptoms started, severity, progression, associated symptoms, triggers, medicines tried, home vitals and any red flags.",
  },
  {
    question: "Should I take vitals before my appointment?",
    answer:
      "Where supported and appropriate, take requested lobby vitals before the session so the clinician has better context.",
  },
  {
    question: "What happens after a consultation?",
    answer:
      "You should review your treatment plan, follow reminders, check prescription or diagnostic workflows, and book follow-up if advised.",
  },
];

const pageJsonLd = {
  "@context": "https://schema.org",
  "@type": "Guide",
  name: "Getting Started as an Ambulant+ Patient",
  headline: "Getting Started as an Ambulant+ Patient",
  description: metadata.description,
  url: absoluteUrl("/patients/getting-started"),
  publisher: {
    "@type": "Organization",
    name: site.name,
    url: site.url,
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Patients",
      item: absoluteUrl("/patients"),
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Getting Started",
      item: absoluteUrl("/patients/getting-started"),
    },
  ],
};

export default function PatientGettingStartedPage() {
  return (
    <main>
      <Script
        id="patient-getting-started-guide-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      <Script
        id="patient-getting-started-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="patient-getting-started-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Patient journey
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Getting started as an Ambulant+ patient.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              This is the master patient journey guide for Ambulant+. Use it to create your
              account, secure access, complete your profile, book a clinician, prepare for your
              session, follow treatment plans, use CarePort or MedReach, and turn Ambulant+ into a
              personal health management suite.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientSignupUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Create patient account <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/resources/patient-account-access"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Review account access <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="rounded-[34px] border border-cyan-100 bg-white p-6 shadow-2xl shadow-cyan-950/10">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                Patient lifecycle
              </div>

              <div className="mt-5 grid gap-3">
                {["Access", "Profile", "Book", "Prepare", "Attend", "Continue"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4"
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-950 text-xs font-bold text-white">
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{item}</span>
                    </div>
                  ),
                )}
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-600">
                Follow this sequence to reduce failed bookings, weak triage, missed prescriptions,
                delayed tests and poor follow-up.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Lifecycle sequence"
        title="Follow the journey from first login to continuous care."
        body="Ambulant+ works best when patients move through account access, profile readiness, booking, preparation, consultation and post-care continuity as one connected workflow."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lifecycleSteps.map(({ title, body, href, cta, icon: Icon }, index) => (
            <Link
              key={title}
              href={href}
              className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="flex items-center justify-between gap-4">
                <Icon className="h-7 w-7 text-cyan-700" />
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                  {index + 1}
                </div>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                {cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Core patient resources"
        title="Everything important now links from one place."
        body="These resources expand the patient journey into focused operational guides for secure access, booking, preparation, after-care, CarePort, MedReach and ongoing health management."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceCards.map(({ title, body, href, icon: Icon, badge }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-[30px] border border-cyan-100 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800">
                  {badge}
                </span>
                <Icon className="h-6 w-6 text-cyan-700" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Open guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-2">
        <div className="glass-panel rounded-[34px] p-7">
          <FileHeart className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Profile readiness checklist
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            A complete profile helps clinicians prepare faster and reduces avoidable delays.
          </p>
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
          <ClipboardCheck className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Better symptom descriptions
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Strong triage helps the clinician understand risk, urgency and what to prepare before the session.
          </p>
          <div className="mt-5 grid gap-4">
            {triageQuality.map((item) => (
              <div key={item.weak} className="rounded-3xl border border-cyan-100 bg-cyan-50/70 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Weak
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.weak}</p>
                <div className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                  Better
                </div>
                <p className="mt-1 text-sm leading-7 text-slate-800">{item.strong}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Supported devices"
        title="Prepare devices before the clinician needs them."
        body="Device-supported care works best when the patient has charged, tested and understood the relevant device workflow before the appointment begins."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {deviceGuides.map(({ title, body, href, icon: Icon }) => (
            <Link
              key={title}
              href={href}
              className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Setup guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                After-care continuity
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                The care loop continues after the consultation.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                A strong patient journey does not end with the video call. Ambulant+ should help
                patients move from clinician advice into prescriptions, diagnostics, reminders,
                follow-up and long-term health management.
              </p>
              <Link
                href="/resources/after-your-consultation"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-950"
              >
                Read after-care guide <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-3">
              {afterCareTasks.map((item) => (
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
        eyebrow="Personal health management"
        title="Use Ambulant+ beyond one-off consultations."
        body="Ambulant+ should feel like a personal health management suite: reminders, home vitals, self-checks, Health Passport, trend context, family care and prevention-focused follow-up."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Health Passport",
              body:
                "Keep health context, vitals, records, summaries and care readiness easier to review over time.",
              icon: FileHeart,
            },
            {
              title: "Reminders",
              body:
                "Use medication, hydration, appointment, follow-up and care-plan reminders where configured.",
              icon: BellRing,
            },
            {
              title: "Home monitoring",
              body:
                "Use supported readings and self-checks to prepare better reviews and recognise concerning changes earlier.",
              icon: HeartPulse,
            },
          ].map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

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
              <AlertTriangle className="h-7 w-7 text-amber-600" />
              <p className="mt-5 text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Common questions"
        title="Patient journey FAQ."
        body="Short answers to the questions patients are likely to ask before their first Ambulant+ consultation."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <div key={item.question} className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5">
              <h3 className="text-lg font-semibold text-slate-950">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
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
