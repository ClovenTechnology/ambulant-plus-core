import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Baby,
  BellRing,
  BrainCircuit,
  Camera,
  CheckCircle2,
  CreditCard,
  Droplets,
  Dumbbell,
  FileHeart,
  HeartPulse,
  Moon,
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
  title: "Ambulant+ Features",
  description:
    "Explore Ambulant+ Contactless Medicine features: connected devices, patient centres, self-check, Health Passport, medication reminders, camera verification, MedReach, CarePort and InsightCore.",
};

const platformFeatures: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Connected devices",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows for clinician-led remote review.",
    icon: Stethoscope,
    href: "/devices",
  },
  {
    title: "Clinician-led virtual care",
    body:
      "Remote consultation supported by objective device context, structured profile data, documentation and escalation boundaries.",
    icon: HeartPulse,
    href: "/clinicians",
  },
  {
    title: "MedReach diagnostics",
    body:
      "Home phlebotomy, specimen collection, laboratory coordination, chain-of-custody and result routing.",
    icon: TestTube2,
    href: "/medreach",
  },
  {
    title: "CarePort fulfilment",
    body:
      "eRx continuity, pharmacy preparation, SKU readiness, rider dispatch, patient updates and proof-of-delivery.",
    icon: Pill,
    href: "/careport",
  },
  {
    title: "InsightCore intelligence",
    body:
      "Programme visibility, adherence trends, risk movement, rewards, claims posture and governance-aware reporting.",
    icon: BrainCircuit,
    href: "/insightcore",
  },
  {
    title: "Medical-aid readiness",
    body:
      "Profile-linked medical-aid details, payment readiness and supported preflight workflows before selected care journeys.",
    icon: CreditCard,
    href: "/clients",
  },
];

const careCentres: Array<{
  title: string;
  body: string;
  image: string;
}> = [
  {
    title: "Ladies’ Health Centre",
    body:
      "Women’s health, cycle, fertility, wellness and baseline-aware tracking pathways where supported.",
    image: "/visuals/centres/ladies-health-centre.webp",
  },
  {
    title: "Paediatric Centre",
    body:
      "Child health access, caregiver-supported consultation and family-linked care-navigation workflows.",
    image: "/visuals/centres/paediatric-centre.webp",
  },
  {
    title: "Antenatal Centre",
    body:
      "Pregnancy care support, tracking, reminders and appropriate care-pathway coordination.",
    image: "/visuals/centres/antenatal-centre.webp",
  },
  {
    title: "Gentlemen’s Health",
    body:
      "Men’s health, vitality, screening, wellness prompts and guided care access.",
    image: "/visuals/centres/gentlemens-health.webp",
  },
];

const dailyTools: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Pill reminders",
    body:
      "Medication reminders can connect with eRx and support camera verification for adherence scoring where enabled.",
    icon: Camera,
  },
  {
    title: "Hydration",
    body:
      "Hydration prompts help users build simple daily habits that support wellbeing and care-plan adherence.",
    icon: Droplets,
  },
  {
    title: "Sleep",
    body:
      "NexRing-linked sleep tracking can support sleep score, readiness and longitudinal wellness context.",
    icon: Moon,
  },
  {
    title: "Exercise",
    body:
      "NexRing-linked activity tracking can support movement goals, sports mode and daily activity trends.",
    icon: Dumbbell,
  },
  {
    title: "Meditation",
    body:
      "Guided prompts can support calm, focus and wellbeing routines, with wearable-linked context where supported.",
    icon: BellRing,
  },
];

const patientTools = [
  {
    title: "Self-Check",
    body:
      "Quick symptom and wellbeing prompts that help users understand care-navigation needs, clinician review options and when urgent care should not be delayed.",
    icon: ShieldCheck,
  },
  {
    title: "Health Passport",
    body:
      "A patient-centred overview that can bring together profile readiness, daily score, device trends, adherence, reports and care-pathway history.",
    icon: FileHeart,
  },
  {
    title: "Wallet and plans",
    body:
      "Wallet funding, payment readiness, care plans, device purchases and supported medical-aid or sponsor pathways where configured.",
    icon: WalletCards,
  },
  {
    title: "Family and multi-user sessions",
    body:
      "Couples, caregivers and multidisciplinary clinicians can participate in selected care journeys where permissions and workflow allow.",
    icon: Baby,
  },
];

const clinicianBenefits = [
  "Work remotely through a governed clinical workspace.",
  "Control availability and schedule within platform rules.",
  "Access wider patient demographics and care journeys.",
  "Use device context to move beyond video-only telemedicine.",
  "Receive platform-led training and device-workflow enablement.",
  "Allow remote admin support where role permissions and confidentiality rules allow.",
];

const ecosystemBenefits = [
  "Patients gain easier access to clinician-led care.",
  "Clinicians gain structured remote-work infrastructure.",
  "Medical aids gain prevention-focused programme visibility.",
  "Labs gain home diagnostics workflow integration.",
  "Pharmacies gain accountable fulfilment visibility.",
  "Riders gain structured healthcare logistics workflow.",
];

export default function FeaturesPage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Platform features
            </div>

            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
              Contactless Medicine features built around real care journeys.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ combines home IoMT use, clinician-led virtual care, patient centres,
              daily health tools, medication adherence intelligence, MedReach diagnostics,
              CarePort fulfilment and InsightCore visibility in one governed ecosystem.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientAppUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Access Patient App <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Request demo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-8">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/features/connected-care-hero.webp"
                alt="Ambulant+ connected care feature ecosystem"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Feature ecosystem
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Devices, centres, reminders, Health Passport, MedReach, CarePort and InsightCore
                  working together as one Contactless Medicine operating system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Core platform"
        title="The core capabilities of Ambulant+."
        body="Each feature family supports one objective: make remote care more objective, traceable, accessible and clinically governed."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {platformFeatures.map(({ title, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/features/connected-devices-grid.webp"
              alt="Ambulant+ connected devices feature grid"
              className="h-80 w-full object-cover"
            />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Home IoMT use
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              The consultation starts with better inputs.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              Ambulant+ is built around supported home medical-device workflows, not generic
              wearable noise. The goal is to help clinicians review better context before, during
              and after remote consultation.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "Health Monitor for multi-parameter vitals.",
                "Digital Stethoscope for heart and lung sound workflows.",
                "HD Otoscope for selected visual-inspection workflows.",
                "NexRing for longitudinal sleep, activity, readiness and temperature-variation context.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <Activity className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Centres of care"
        title="Care pathways organised around patient needs."
        body="Ambulant+ can present care through patient-friendly centres while preserving clinical boundaries, permissions and appropriate escalation."
      >
        <div id="care-centres" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {careCentres.map((item) => (
            <div key={item.title} className="overflow-hidden rounded-[30px] border border-white/80 bg-white/78 shadow-sm">
              <img src={item.image} alt={item.title} className="h-44 w-full object-cover" />
              <div className="p-6">
                <HeartPulse className="h-7 w-7 text-cyan-700" />
                <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Daily health tools"
        title="Reminders and wearable-linked routines for everyday health."
        body="Daily tools support adherence and wellbeing without replacing professional care, urgent assessment or clinical judgement."
      >
        <div id="daily-health" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {dailyTools.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-2 md:px-6 md:py-16">
        {patientTools.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[34px] p-7">
            <Icon className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            <p className="mt-4 text-sm leading-8 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Clinician opportunity
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Remote work with governance, structure and opportunity.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Ambulant+ is designed to let clinicians participate in Contactless Medicine
                without losing professional discipline, patient-safety boundaries or operational
                support.
              </p>
            </div>

            <div className="grid gap-3">
              {clinicianBenefits.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Ecosystem value"
        title="One platform, many operating roles."
        body="The strength of Ambulant+ is the way each role becomes part of a coordinated care infrastructure rather than a disconnected service."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ecosystemBenefits.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
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