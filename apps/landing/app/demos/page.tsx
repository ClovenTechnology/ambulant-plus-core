import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FlaskConical,
  HeartPulse,
  MonitorPlay,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  TestTube2,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Request an Ambulant+ Platform Demo",
  description:
    "Structured Ambulant+ demos for medical aids, employers, clinicians, laboratories, pharmacies, riders and enterprise teams evaluating Contactless Medicine workflows.",
};

const demoAudiences: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
  enquiryHref: string;
}> = [
  {
    title: "Medical aids, HMOs and sponsors",
    body:
      "Review member eligibility, coverage preflight, consultation funding, claims, wallet, rewards, adherence, monitoring and InsightCore programme intelligence.",
    icon: Building2,
    href: "/clients",
    enquiryHref: "/contact?type=client_programme",
  },
  {
    title: "Clinicians and clinical teams",
    body:
      "Walk through clinician onboarding, patient review, device-supported consultation, notes, escalation, MedReach, CarePort and follow-up workflows.",
    icon: Stethoscope,
    href: "/clinicians",
    enquiryHref: "/contact?type=clinician_onboarding",
  },
  {
    title: "Patients and care navigators",
    body:
      "Understand account setup, profile readiness, medical aid, wallet, device pairing, booking, reminders, diagnostics and medicine fulfilment.",
    icon: HeartPulse,
    href: "/patients",
    enquiryHref: "/contact?type=patient_support",
  },
  {
    title: "Laboratories",
    body:
      "Review MedReach lab onboarding, test catalogue, specimen acceptance, processing status, result readiness and result-routing workflows.",
    icon: FlaskConical,
    href: "/medreach/labs",
    enquiryHref: "/contact?type=medreach_labs",
  },
  {
    title: "Pharmacies",
    body:
      "Review CarePort pharmacy onboarding, catalogue/SKU readiness, eRx fulfilment, handover, proof-of-delivery and payout visibility.",
    icon: Store,
    href: "/careport/pharmacies",
    enquiryHref: "/contact?type=careport_pharmacies",
  },
  {
    title: "Riders and field operations",
    body:
      "Walk through rider verification, dispatch handover, route progression, patient-update boundaries, proof-of-delivery and earnings visibility.",
    icon: Truck,
    href: "/careport/riders",
    enquiryHref: "/contact?type=careport_riders",
  },
];

const demoModules: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Patient journey",
    body:
      "Account creation, profile readiness, medical-aid details, wallet funding, device setup, booking, reminders and care continuity.",
    icon: Users,
  },
  {
    title: "Clinician workflow",
    body:
      "Patient context, device readings, auscultation, otoscopy, documentation, referrals, escalation and follow-up planning.",
    icon: Stethoscope,
  },
  {
    title: "Device-supported care",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows mapped to Contactless Medicine use cases.",
    icon: HeartPulse,
  },
  {
    title: "MedReach diagnostics",
    body:
      "Home phlebotomy, specimen collection, lab handover, chain-of-custody, result readiness and result routing.",
    icon: TestTube2,
  },
  {
    title: "CarePort fulfilment",
    body:
      "eRx, pharmacy preparation, SKU readiness, rider dispatch, proof-of-delivery and medicine-continuity reporting.",
    icon: Pill,
  },
  {
    title: "InsightCore intelligence",
    body:
      "Programme visibility, utilisation, adherence, risk movement, rewards, claims posture and governance-aware analytics.",
    icon: BarChart3,
  },
];

const demoPathway = [
  {
    title: "Define audience",
    body:
      "Clarify whether the demo is for medical aids, employers, clinicians, laboratories, pharmacies, riders, administrators or investors.",
  },
  {
    title: "Select workflows",
    body:
      "Choose the relevant pathways: patient access, clinician consultation, devices, diagnostics, pharmacy fulfilment, claims or intelligence.",
  },
  {
    title: "Map real use cases",
    body:
      "Anchor the session in real journeys such as chronic-care monitoring, home diagnostics, eRx fulfilment, fertility care or medical-aid preflight.",
  },
  {
    title: "Review governance",
    body:
      "Show role-based access, consent, clinical disclaimers, payment boundaries, data visibility and audit considerations.",
  },
  {
    title: "Discuss deployment",
    body:
      "Identify integration needs, onboarding requirements, training, partner readiness, commercial terms and staged rollout options.",
  },
  {
    title: "Agree next steps",
    body:
      "Close with a focused plan: pilot scope, demo follow-up, technical workshop, commercial discussion or onboarding sequence.",
  },
];

const demoScenarios = [
  {
    title: "Medical-aid chronic-care pathway",
    body:
      "A member with hypertension or diabetes books care, completes vitals, receives clinician review, syncs medication, uses CarePort fulfilment and generates claims-ready programme visibility.",
  },
  {
    title: "Home diagnostics pathway",
    body:
      "A clinician requests blood tests, MedReach assigns a phlebotomist, the specimen is tracked to the laboratory and results route back into the care workflow.",
  },
  {
    title: "Medication continuity pathway",
    body:
      "A prescription flows into CarePort, the pharmacy prepares medication, a rider completes delivery and adherence reminders continue from the eRx-linked plan.",
  },
  {
    title: "Fertility and multi-user session",
    body:
      "A couple joins a fertility consultation from different locations, with NexRing trend context and clinician-guided care planning where appropriate.",
  },
];

const demoSessions = [
  {
    date: "Thursday, 30 July 2026",
    time: "11:00 SAST",
    title: "Medical Aids, HMOs & Corporate Sponsors",
    body:
      "For teams evaluating chronic-care monitoring, preventive programmes, claims visibility, coverage preflight, rewards, member engagement and payer-facing InsightCore intelligence.",
    href: "/contact?type=demo&session=medical-aids-hmos-corporate-sponsors",
  },
  {
    date: "Thursday, 30 July 2026",
    time: "15:00 SAST",
    title: "Clinicians & Clinical Teams",
    body:
      "For doctors and clinical teams reviewing onboarding, device-supported consultation, documentation, escalation, MedReach, CarePort and professional-governance boundaries.",
    href: "/contact?type=demo&session=clinicians-clinical-teams",
  },
  {
    date: "Tuesday, 4 August 2026",
    time: "11:00 SAST",
    title: "Laboratories & MedReach Diagnostics",
    body:
      "For labs and diagnostic partners evaluating home phlebotomy, specimen chain-of-custody, catalogue readiness, laboratory handover and result-routing workflows.",
    href: "/contact?type=demo&session=laboratories-medreach-diagnostics",
  },
  {
    date: "Tuesday, 4 August 2026",
    time: "15:00 SAST",
    title: "Pharmacies, Riders & CarePort Fulfilment",
    body:
      "For pharmacies and delivery teams reviewing eRx fulfilment, SKU readiness, dispatch handover, rider workflow, proof-of-delivery and medication-continuity visibility.",
    href: "/contact?type=demo&session=pharmacies-riders-careport",
  },
  {
    date: "Thursday, 6 August 2026",
    time: "11:00 SAST",
    title: "Patient App, Devices & Care Centres",
    body:
      "For patient-facing teams reviewing onboarding, medical-aid readiness, wallet, device setup, reminders, care centres, fertility pathways and supported home monitoring.",
    href: "/contact?type=demo&session=patient-app-devices-care-centres",
  },
  {
    date: "Thursday, 6 August 2026",
    time: "15:00 SAST",
    title: "Full Enterprise Contactless Medicine Walkthrough",
    body:
      "A full ecosystem session covering patients, clinicians, MedReach, CarePort, InsightCore, admin, governance, commercial pathways and deployment planning.",
    href: "/contact?type=demo&session=full-enterprise-contactless-medicine",
  },
];

const preparationChecklist = [
  "Who should attend: clinical, claims, managed-care, innovation, IT, compliance, operations or executive teams.",
  "Which workflow matters most: patient, clinician, payer, diagnostics, pharmacy, rider, admin or intelligence.",
  "Whether the demo should focus on product strategy, implementation planning, commercial model or technical integration.",
  "Any specific use case: chronic disease, post-discharge, fertility, employer health, diagnostics, medication adherence or wellness rewards.",
  "Any privacy, claims, regulatory, data-sharing, integration or deployment questions that must be addressed.",
];

const demoOutcomes = [
  {
    title: "Clearer value case",
    body:
      "Stakeholders should leave understanding why Contactless Medicine is more complete than video-only telemedicine.",
    icon: BadgeCheck,
  },
  {
    title: "Workflow understanding",
    body:
      "Teams should see how patient, clinician, MedReach, CarePort, InsightCore and admin workflows connect.",
    icon: ClipboardCheck,
  },
  {
    title: "Governance confidence",
    body:
      "The demo should show consent boundaries, role permissions, clinical limits, audit posture and data-visibility controls.",
    icon: ShieldCheck,
  },
];

export default function DemosPage() {
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
              Platform demos
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Request a structured Ambulant+ walkthrough.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ demos are designed for serious stakeholders evaluating Contactless
              Medicine: medical aids, HMOs, employers, clinicians, laboratories, pharmacies,
              riders, programme teams and enterprise partners.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact?type=demo"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request demo <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.demoEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Email demo team <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/demos/platform-demo-suite.webp"
                alt="Ambulant+ enterprise platform demo suite"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Demo suite
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Patient, clinician, MedReach, CarePort, InsightCore, claims, coverage,
                  payment, governance and admin workflows can be demonstrated by role and
                  outcome.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Scheduled walkthroughs"
        title="Book a focused demo session from late July."
        body="These initial sessions are designed to help each stakeholder group see the workflows, economics and governance boundaries most relevant to them."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demoSessions.map((session) => (
            <Link
              key={`${session.date}-${session.time}-${session.title}`}
              href={session.href}
              className="glass-panel flex h-full flex-col rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <div className="flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {session.date}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  {session.time}
                </span>
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {session.title}
              </h3>

              <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                {session.body}
              </p>

              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">
                Request this session <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Who should request a demo"
        title="Different stakeholders need different walkthroughs."
        body="A good demo should not be a generic product tour. It should be shaped around the stakeholder’s operating model, commercial priorities and clinical-governance needs."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demoAudiences.map(({ title, body, icon: Icon, href, enquiryHref }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-xs font-semibold text-cyan-800"
                >
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <Link
                  href={enquiryHref}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
                >
                  Request demo <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/previews/dashboard-operations-collage-v1.webp"
              alt="Ambulant+ platform dashboard and operations preview"
              className="h-80 w-full object-cover"
            />
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Implementation mindset
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Product demos should feel like implementation planning.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              The objective is not to click through screens casually. The objective is to help
              serious stakeholders understand how Ambulant+ would operate inside a governed
              healthcare environment.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "What problem are we solving for your organisation?",
                "Which users, roles and workflows need to be configured?",
                "What clinical, operational, claims and governance boundaries apply?",
                "What would a pilot, rollout or partnership pathway look like?",
              ].map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4"
                >
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Demo modules"
        title="Choose the workflows that matter."
        body="Ambulant+ can be shown as a full ecosystem or as focused modules depending on the audience."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demoModules.map(({ title, body, icon: Icon }) => (
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
                Demo structure
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Walk through the platform by role and outcome.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                The strongest demos are structured around a real operating problem, not a flat
                screen tour. Every session should end with concrete next steps.
              </p>
            </div>

            <div className="grid gap-3">
              {demoPathway.map((step, index) => (
                <div key={step.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-sm font-bold text-slate-950">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{step.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Demo scenarios"
        title="Anchor the walkthrough in real healthcare economics."
        body="The best Ambulant+ demos show how the platform changes access, visibility, adherence, diagnostics, fulfilment and prevention."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {demoScenarios.map((item) => (
            <div key={item.title} className="glass-panel rounded-[30px] p-6">
              <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Preparation
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Prepare the questions that decide deployment.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              The demo team should know whether you are evaluating clinical workflow, payer
              economics, diagnostics, pharmacy fulfilment, workforce onboarding, governance or
              technical integration.
            </p>

            <div className="mt-6 grid gap-3">
              {preparationChecklist.map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-cyan-100 bg-cyan-50/60 p-4">
                  <MonitorPlay className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[38px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
            <img
              src="/visuals/previews/dashboard-operations-collage-v2.webp"
              alt="Ambulant+ dashboard and workflow preview for demo planning"
              className="h-80 w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6 md:py-16">
        {demoOutcomes.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[30px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Request demo
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Bring the people who will decide, operate and govern the deployment.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                For serious enterprise demos, include the teams responsible for care delivery,
                claims, member experience, pharmacy, diagnostics, operations, compliance,
                technology and commercial rollout.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/contact?type=demo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
              >
                Request demo <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.demoEmail}`}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Email demo team <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}