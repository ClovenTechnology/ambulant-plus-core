import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BriefcaseMedical,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  HeartPulse,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  TestTube2,
  Truck,
  Users,
  Video,
  Watch,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Ambulant+ Resources | Contactless Medicine Guides and Knowledge Library",
  description:
    "Ambulant+ resources for Contactless Medicine, remote patient monitoring, IoMT device setup, Health Monitor workflows, Digital Stethoscope auscultation, NexRing guidance, MedReach diagnostics, CarePort medicine fulfilment, medical aids, clinicians and patients.",
  keywords: [
    "Contactless Medicine resources",
    "remote patient monitoring guides",
    "IoMT device setup guide",
    "Health Monitor setup",
    "Digital Stethoscope workflow",
    "digital auscultation guide",
    "NexRing setup guide",
    "remote vitals monitoring",
    "virtual consultation device workflow",
    "medical aid remote monitoring guide",
    "CarePort medicine delivery guide",
    "MedReach home phlebotomy guide",
    "clinician onboarding Contactless Medicine",
    "remote care training South Africa",
  ],
};

const resourceCollections: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Patient guides",
    body:
      "Account setup, profile completion, medical-aid readiness, device setup, doctor booking, wallet, reminders, family access, MedReach diagnostics and CarePort medicine delivery guidance.",
    icon: HeartPulse,
    href: "/patients/getting-started",
  },
  {
    title: "Clinician resources",
    body:
      "Onboarding, Contactless Medicine training, device-supported consultation, documentation, escalation, compliance, professional boundaries and remote practice readiness.",
    icon: Stethoscope,
    href: "/clinicians/onboarding",
  },
  {
    title: "Device workflow guides",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows mapped to safe Contactless Medicine use cases, remote patient monitoring and clinical follow-up.",
    icon: Watch,
    href: "/devices",
  },
  {
    title: "Medical-aid and sponsor resources",
    body:
      "Programme visibility, eligibility, benefit activation, payment preflight, claims, rewards, adherence, remote monitoring and InsightCore payer intelligence use cases.",
    icon: Building2,
    href: "/clients",
  },
  {
    title: "MedReach resources",
    body:
      "Home phlebotomy, specimen collection, laboratory handover, chain-of-custody, result routing, diagnostics coordination and patient-facing lab workflows.",
    icon: TestTube2,
    href: "/medreach",
  },
  {
    title: "CarePort resources",
    body:
      "eRx fulfilment, pharmacy SKU readiness, rider dispatch, patient updates, proof-of-delivery, medication continuity, adherence support and last-mile medicine delivery.",
    icon: Pill,
    href: "/careport",
  },
];

const audienceGuides: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "For patients",
    body:
      "Prepare your profile, connect supported devices, book doctors, manage reminders, review reports and continue care safely from home, work or supported access points.",
    icon: Users,
    href: "/patients",
  },
  {
    title: "For clinicians",
    body:
      "Understand platform onboarding, training, device-supported review, virtual consultation discipline, clinical escalation and safer remote practice readiness.",
    icon: BriefcaseMedical,
    href: "/clinicians",
  },
  {
    title: "For labs",
    body:
      "Review MedReach laboratory onboarding, catalogue setup, specimen acceptance, result routing, phlebotomy coordination and operational visibility.",
    icon: TestTube2,
    href: "/medreach/labs",
  },
  {
    title: "For phlebotomists",
    body:
      "Understand home-draw assignment, patient verification, specimen labelling, custody, collection workflow and earnings visibility.",
    icon: ClipboardCheck,
    href: "/medreach/phlebotomists",
  },
  {
    title: "For pharmacies",
    body:
      "Review CarePort pharmacy onboarding, SKU readiness, prescription handling, rider handover, proof-of-fulfilment and payout workflows.",
    icon: Store,
    href: "/careport/pharmacies",
  },
  {
    title: "For riders",
    body:
      "Understand rider verification, handover, route progression, delivery rules, proof-of-delivery, patient updates and payout visibility.",
    icon: Truck,
    href: "/careport/riders",
  },
];

const deviceSetupGuides: Array<{
  title: string;
  eyebrow: string;
  body: string;
  bullets: string[];
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Health Monitor setup guide",
    eyebrow: "Spot-check vitals",
    body:
      "The Health Monitor is a supported IoMT device controlled through a mobile phone, tablet or computer during consultation and remote review workflows.",
    bullets: [
      "Charge fully before first use.",
      "Supports temperature, SpO₂, heart rate, blood pressure, blood glucose and ECG capture.",
      "Use the app or platform surface to select the measurement mode before capture.",
      "Keep the device steady and follow the measurement-specific positioning instructions.",
      "Use captured readings as structured clinical context, not as a replacement for clinician judgement.",
    ],
    icon: HeartPulse,
    href: "/devices",
  },
  {
    title: "Digital Stethoscope workflow guide",
    eyebrow: "Remote auscultation",
    body:
      "The Digital Stethoscope supports live heart and lung listening, audio capture, playback and follow-up comparison during device-supported virtual consultations.",
    bullets: [
      "Charge before use and connect through the supported app or consultation workflow.",
      "Select heart or lung mode before auscultation.",
      "Use compatible earphones for live listening where required.",
      "Tap record to save the audio file while listening.",
      "Share recordings, add patient notes and compare saved clips across follow-up visits.",
    ],
    icon: Stethoscope,
    href: "/devices",
  },
  {
    title: "HD Otoscope workflow guide",
    eyebrow: "Remote imaging",
    body:
      "The HD Otoscope supports visual capture for ear, nose, throat and selected skin-adjacent review workflows where image or video context can support remote assessment.",
    bullets: [
      "Use only when the patient or trained assistant can safely position the device.",
      "Capture clear images or video clips for review and documentation.",
      "Do not force insertion or use where pain, bleeding, foreign body risk or emergency symptoms are present.",
      "Escalate to in-person assessment when image quality, symptoms or safety concerns require it.",
    ],
    icon: Video,
    href: "/devices",
  },
  {
    title: "NexRing wearing and sizing guide",
    eyebrow: "Continuous wellness context",
    body:
      "NexRing provides wearable context such as heart-rate trends, sleep-related insights, activity patterns and temperature-variation signals that can support preventive care discussions.",
    bullets: [
      "Use the sizing kit before unboxing the final ring where applicable.",
      "Wear on the index finger of the less-dominant hand for optimal signal and reduced wear.",
      "Charge to 100% before first setup.",
      "Keep the ring on the charger during initial pairing.",
      "Align the sensor to the palm-side of the finger and allow up to 24 hours for fuller data population.",
    ],
    icon: Watch,
    href: "/devices",
  },
];

const learningTracks = [
  {
    title: "Contactless Medicine foundation",
    body:
      "The operating principles behind Ambulant+: clinician-led remote care supported by connected devices, diagnostics, medicine fulfilment, governed workflows and consent-aware intelligence.",
  },
  {
    title: "Clinical safety and escalation",
    body:
      "When remote care is appropriate, when urgent care is required, how to document device-supported review and how to preserve professional clinical judgement.",
  },
  {
    title: "Device-supported workflows",
    body:
      "How supported devices fit into the consultation journey: vitals capture, auscultation, otoscopy, wearable trends, follow-up comparison and clinical context.",
  },
  {
    title: "Programme and payer operations",
    body:
      "How medical aids, HMOs, employers and sponsors can use eligibility, rewards, adherence, claims visibility and remote monitoring responsibly.",
  },
];

const contentRoadmap = [
  "Patient quick-start guide",
  "Clinician onboarding guide",
  "Contactless Medicine compliance training overview",
  "Health Monitor setup guide",
  "Digital Stethoscope workflow guide",
  "HD Otoscope workflow guide",
  "NexRing wearing and sizing guide",
  "Medication reminders and camera verification guide",
  "MedReach home phlebotomy guide",
  "CarePort pharmacy fulfilment guide",
  "Medical-aid programme deployment guide",
  "Enterprise demo preparation checklist",
];

const downloadablePacks = [
  {
    title: "Patient Quick-Start Pack",
    body:
      "Profile completion, supported devices, doctor booking, reminders, reports, MedReach diagnostics and CarePort delivery readiness.",
  },
  {
    title: "Clinician Onboarding Pack",
    body:
      "Contactless Medicine standards, consultation readiness, device-supported review, documentation and escalation boundaries.",
  },
  {
    title: "Device Setup Sheets",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing setup notes prepared for patients, clinicians and support teams.",
  },
  {
    title: "Medical Aid Deployment Guide",
    body:
      "Programme eligibility, member onboarding, consent, remote monitoring, adherence visibility, rewards and preventive-care reporting.",
  },
  {
    title: "Operations Playbooks",
    body:
      "MedReach diagnostics, CarePort fulfilment, pharmacy handover, rider proof-of-delivery and laboratory result routing.",
  },
  {
    title: "Training and Demo Packs",
    body:
      "Demo preparation, CPD pathways, webinar topics, implementation walkthroughs and stakeholder-specific training modules.",
  },
];

const governanceNotes = [
  "Resources should support safe use, not encourage self-diagnosis.",
  "Device guides should remain tied to the exact supported Ambulant+ device scope.",
  "Clinical resources must preserve professional judgement and escalation boundaries.",
  "Payer resources must respect consent, role permissions and appropriate data-sharing limits.",
  "Medication adherence visibility should be framed as support and continuity, not punishment.",
  "Emergency symptoms should always be directed to appropriate urgent or emergency services.",
];

const proofPoints = [
  "Remote patient monitoring and continuous vitals context",
  "Device-supported virtual consultation workflows",
  "Digital auscultation with saved heart and lung recordings",
  "Health Monitor spot-checks for blood pressure, SpO₂, temperature, glucose, ECG and pulse",
  "NexRing wearable context for sleep, activity and temperature variation",
  "MedReach home diagnostics and phlebotomy coordination",
  "CarePort prescription fulfilment, reminders and medicine delivery support",
  "Medical-aid, HMO, employer and sponsor programme visibility",
  "Governance-aware InsightCore intelligence and reporting pathways",
];

export default function ResourcesPage() {
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
              Resources
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Knowledge infrastructure for Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ resources help patients, clinicians, medical aids, employers,
              laboratories, pharmacies, riders and programme teams understand how to use
              Contactless Medicine safely, operationally and responsibly.
            </p>

            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600">
              This library brings together remote patient monitoring guidance, IoMT device
              setup notes, digital auscultation workflows, home diagnostics operations,
              prescription fulfilment, adherence support, payer visibility and governance-aware
              implementation knowledge.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request guided walkthrough <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.trainingEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800 shadow-sm"
              >
                Ask about training <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-[36px] p-5 shadow-glow">
            <div className="rounded-[30px] border border-white/80 bg-white/80 p-5">
              <div className="aspect-[1.15/1] overflow-hidden rounded-[26px] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
                      Resource library
                    </div>
                    <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight">
                      From setup to safe clinical operations.
                    </h2>
                  </div>
                  <BookOpen className="h-9 w-9 text-cyan-200" />
                </div>

                <div className="mt-6 grid gap-3">
                  {[
                    "Patient and clinician onboarding",
                    "IoMT device workflow guidance",
                    "Remote monitoring and vitals interpretation support",
                    "Diagnostics, pharmacy and payer operations",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4"
                    >
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-200" />
                      <span className="text-sm leading-6 text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {["Guides", "Training", "Playbooks"].map((item) => (
                  <div key={item} className="rounded-2xl bg-cyan-50 p-4 text-center">
                    <div className="text-sm font-semibold text-slate-950">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Resource collections"
        title="Guidance organised by workflow."
        body="Each resource collection supports a specific adoption pathway for Ambulant+ patient care, clinician practice, device diagnostics, pharmacy fulfilment, payer governance and operational delivery."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceCollections.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  Open resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Device setup library"
        title="Supported devices need clear, safe setup guidance."
        body="Ambulant+ device resources should help users prepare correctly before a consultation, capture usable clinical context and understand when clinician review or escalation is required."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {deviceSetupGuides.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group glass-panel rounded-[34px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">
                      {item.eyebrow}
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                      {item.title}
                    </h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>

                <p className="mt-4 text-sm leading-8 text-slate-600">{item.body}</p>

                <div className="mt-5 grid gap-3">
                  {item.bullets.map((bullet) => (
                    <div key={bullet} className="flex gap-3 text-sm leading-7 text-slate-600">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  View device hub <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Audience guides"
        title="Start with the role you play in the ecosystem."
        body="Patients, clinicians, labs, phlebotomists, pharmacies, riders and enterprise partners need different resource paths."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {audienceGuides.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
              >
                <Icon className="h-6 w-6 text-cyan-700" />
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="overflow-hidden rounded-[36px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Learning tracks
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Training should make the platform safer, not just easier to use.
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300">
                Ambulant+ resources should help every user understand not only what the
                platform can do, but also when to use remote care, when to escalate, how to
                document decisions and how to preserve clinical accountability.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {["Remote care", "IoMT", "Governance", "Operations"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {learningTracks.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <BookOpen className="h-5 w-5 text-cyan-200" />
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Publishing roadmap"
        title="The resource library should grow into a serious knowledge base."
        body="These resource categories can be expanded into downloadable guides, onboarding packs, training modules, videos, implementation checklists and operational playbooks."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {contentRoadmap.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Downloadable library"
        title="Next, turn the resource library into usable implementation packs."
        body="The public resource hub should prepare users, while downloadable packs can support deeper onboarding, enterprise procurement, clinical governance and implementation planning."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {downloadablePacks.map((item) => (
            <div key={item.title} className="glass-panel rounded-[30px] p-6">
              <Download className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Coming next
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-[0.95fr_1.05fr] md:px-6 md:py-16">
        <div className="glass-panel rounded-[34px] p-7">
          <GraduationCap className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Training, demos, CPDs and webinars
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Ambulant+ resources can support structured training for clinicians, programme teams,
            laboratories, pharmacies, riders and enterprise partners. Demo sessions should be tied
            to implementation planning, not superficial product tours.
          </p>
          <div className="mt-5 grid gap-3">
            {[
              "Contactless Medicine foundation training",
              "Device-supported consultation training",
              "Medical-aid and sponsor programme walkthroughs",
              "CarePort, MedReach and operations readiness sessions",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Link
            href="/demos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
          >
            View demos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <ShieldCheck className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Governance notes
          </h2>
          <div className="mt-5 grid gap-3">
            {governanceNotes.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Search visibility"
        title="This resource hub should also answer how people search."
        body="Ambulant+ must be discoverable by people searching for telemedicine, online doctors, remote patient monitoring, IoMT devices, digital stethoscopes, home diagnostics, medication adherence, medical-aid preventive care and connected clinical workflows."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {proofPoints.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/70 p-5">
              <Waves className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-700">{item}</p>
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