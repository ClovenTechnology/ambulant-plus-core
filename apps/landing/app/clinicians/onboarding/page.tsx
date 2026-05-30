import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseMedical,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Clinician onboarding",
  description:
    "A practical guide for clinicians joining Ambulant+: signup, professional verification, Contactless Medicine training, device-workflow readiness, compliance boundaries and activation.",
};

const onboardingSteps = [
  {
    title: "Create your clinician account",
    body:
      "Start with the protected clinician signup route and create your Ambulant+ clinician profile.",
  },
  {
    title: "Complete identity and professional verification",
    body:
      "Submit identity/KYC information, professional registration details and relevant practice documentation.",
  },
  {
    title: "Choose a training pathway",
    body:
      "Select an available onboarding or training slot based on your practice model and intended platform use.",
  },
  {
    title: "Complete Contactless Medicine training",
    body:
      "Learn the Ambulant+ workflow, device-supported consultation model, documentation standards and escalation boundaries.",
  },
  {
    title: "Confirm commercial and risk-readiness terms",
    body:
      "Review applicable onboarding, platform, device, indemnity, support and payout terms before activation.",
  },
  {
    title: "Go live after readiness checks",
    body:
      "Begin consulting only after profile, documents, training and platform-readiness checks are complete.",
  },
];

const readinessCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Professional registration",
    body:
      "Clinicians must meet applicable professional-registration requirements in the market where they practise, including HPCSA or equivalent obligations where relevant.",
    icon: BadgeCheck,
  },
  {
    title: "Private consulting environment",
    body:
      "Remote consultations should be conducted from a suitable private environment that protects confidentiality and supports safe clinical work.",
    icon: Stethoscope,
  },
  {
    title: "Platform training",
    body:
      "Training covers patient workflow, device-supported data capture, clinical documentation, eRx pathways, referrals and escalation boundaries.",
    icon: GraduationCap,
  },
  {
    title: "Indemnity and scope awareness",
    body:
      "Clinicians must understand their professional responsibility, indemnity position, emergency boundaries and limits of remote assessment.",
    icon: ShieldCheck,
  },
];

const trainingModules = [
  "Contactless Medicine principles and how they differ from video-only telemedicine.",
  "Ambulant+ clinician workspace, patient profile review and consultation workflow.",
  "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing-supported care pathways.",
  "Documentation standards, clinical summaries, follow-up plans and care-continuity workflow.",
  "MedReach diagnostic requests, CarePort fulfilment pathways and eRx-linked medicine continuity.",
  "InsightCore trends, adherence signals, programme visibility and governance-aware interpretation.",
  "Emergency exclusions, red-flag escalation, in-person referral and patient-safety boundaries.",
  "Privacy, consent, professional conduct, platform rules and audit-aware practice.",
];

const commercialNotes = [
  "Onboarding, training, device-kit, indemnity-support and platform-access terms may vary by package, market and rollout phase.",
  "Where payment is required, clinicians should complete payment or approved instalment arrangements before full feature activation.",
  "Payout rules, consultation fees, claims handling and deductions should be reviewed before going live.",
  "Device dispatch, advanced tools and platform modules may be activated progressively depending on readiness and package terms.",
];

const workingRules = [
  "Practise only within competence, registration scope and applicable professional guidance.",
  "Do not use Ambulant+ as an emergency-service substitute.",
  "Escalate to urgent or in-person care when remote assessment is insufficient.",
  "Document clearly, including device context, patient-reported symptoms and clinical reasoning.",
  "Protect confidentiality, consent and role-based access at all times.",
  "Use device readings as clinical context, not as automatic diagnosis.",
];

const activationChecklist = [
  "Clinician profile completed",
  "Identity/KYC completed",
  "Professional registration details submitted",
  "Practice number or billing details added where applicable",
  "Training slot selected",
  "Required training completed",
  "Payment/commercial terms acknowledged where applicable",
  "Indemnity/PI position reviewed",
  "Platform-readiness checks completed",
  "Consultation availability configured",
];

const faqs = [
  {
    q: "Is this employment?",
    a:
      "No. Ambulant+ is designed as a platform-enabled clinical workspace. Commercial terms depend on the agreement, package and market configuration.",
  },
  {
    q: "Can clinicians work from home?",
    a:
      "Yes, where appropriate. Clinicians may work remotely if they have a private professional environment, suitable connectivity and meet platform-readiness and regulatory requirements.",
  },
  {
    q: "Can admin staff support a clinician remotely?",
    a:
      "Yes, where role permissions allow. Administrative users should only access the information required for their function and must respect confidentiality and platform rules.",
  },
  {
    q: "Does Ambulant+ replace clinical judgement?",
    a:
      "No. Ambulant+ provides workflow, device context and documentation support. Diagnosis, prescribing, escalation and clinical responsibility remain with the qualified clinician.",
  },
];

export default function ClinicianOnboardingPage() {
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
              Clinician onboarding
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Become ready to practise Contactless Medicine safely.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ onboarding prepares clinicians to use a governed clinical workspace,
              approved connected-device workflows, structured documentation, MedReach diagnostics,
              CarePort fulfilment and InsightCore intelligence while preserving professional
              judgement and patient-safety boundaries.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.clinicianSignupUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Start clinician signup <ArrowRight className="h-4 w-4" />
              </a>

              <a
                href={`mailto:${site.trainingEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Ask about training <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/clinicians/clinician-onboarding-training.webp"
                alt="Clinician completing Ambulant+ Contactless Medicine onboarding and platform training"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Activation pathway
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Signup, verification, training, payment readiness, device-workflow competence,
                  governance acknowledgement and platform activation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Onboarding pathway"
        title="From registration to first consultation."
        body="The clinician journey is deliberately structured so patients, clinicians and programme partners can trust the operating model."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {onboardingSteps.map((step, index) => (
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

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        {readinessCards.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Training curriculum
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Training is not a checkbox. It is the safety layer of the platform.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Ambulant+ training should help clinicians move confidently from video-only
                telemedicine into device-supported, documented, escalation-aware Contactless
                Medicine.
              </p>
            </div>

            <div className="grid gap-3">
              {trainingModules.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4"
                >
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Commercial readiness"
        title="Fees, packages and payout terms must be clear before activation."
        body="Clinicians should understand the current onboarding package, payment requirements, device-kit position, platform access, support terms, claims workflow and payout rules before accepting consultations."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {commercialNotes.map((item) => (
            <div key={item} className="glass-panel rounded-[30px] p-6">
              <WalletCards className="h-7 w-7 text-cyan-700" />
              <p className="mt-5 text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-2">
        <div className="glass-panel rounded-[34px] p-7">
          <BriefcaseMedical className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Working rules
          </h2>
          <div className="mt-5 grid gap-3">
            {workingRules.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <ClipboardCheck className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Activation checklist
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {activationChecklist.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Clinician FAQ"
        title="Practical answers before signup."
        body="The onboarding page should remove uncertainty before a clinician enters the protected workspace."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((item) => (
            <div key={item.q} className="glass-panel rounded-[30px] p-6">
              <h3 className="text-lg font-semibold text-slate-950">{item.q}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
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