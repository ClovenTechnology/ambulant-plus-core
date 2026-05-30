import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  FileCheck2,
  HeartPulse,
  Hospital,
  LockKeyhole,
  Pill,
  ShieldCheck,
  Stethoscope,
  TestTube2,
  Users,
  WalletCards,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { site } from "@/lib/site";

export const metadata = {
  title: "Medical Aids, HMOs and Corporate Sponsors",
  description:
    "Ambulant+ for medical aids, HMOs, employers and corporate sponsors: remote monitoring, claims preflight, adherence intelligence, wellness rewards, diagnostics, pharmacy fulfilment and governed programme visibility.",
};

const executiveThesis = [
  "Prevent avoidable deterioration before it becomes hospital-level cost.",
  "Fund consultations, diagnostics, devices, medication fulfilment and wellness programmes with evidence-linked governance.",
  "Use consent-aware data to understand adherence, vitals, lifestyle activity and clinical-risk movement.",
  "Give members easier access to care without depending on transport, clinic availability or fragmented pharmacy journeys.",
];

const operatingPainPoints: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Late intervention",
    body:
      "Members often become expensive only after risk has silently progressed. Ambulant+ supports earlier review through vitals, device signals, adherence trends and structured escalation.",
    icon: HeartPulse,
  },
  {
    title: "Transport-dependent care",
    body:
      "A funded consultation still fails if a member cannot reach the doctor, laboratory or pharmacy. Contactless Medicine reduces avoidable access friction across care, diagnostics and fulfilment.",
    icon: Hospital,
  },
  {
    title: "Poor continuity",
    body:
      "One-off claims do not show the full member journey. Ambulant+ links consultation context, device readings, medication adherence, diagnostics, fulfilment and follow-up.",
    icon: ClipboardCheck,
  },
  {
    title: "Medication non-adherence",
    body:
      "Missed doses, late doses and poor refill continuity quietly drive complications. Ambulant+ supports eRx sync, reminders, camera verification, adherence scoring and CarePort fulfilment.",
    icon: Pill,
  },
  {
    title: "Unclear programme ROI",
    body:
      "Sponsors need to know whether benefits are changing behaviour. InsightCore gives programme-level visibility across utilisation, adherence, risk movement, rewards and claims posture.",
    icon: BarChart3,
  },
  {
    title: "Fragmented provider network",
    body:
      "Medical aids need provider readiness across clinicians, pharmacies, labs, phlebotomists and riders. Ambulant+ supports network, DSP, claims and settlement readiness views.",
    icon: Users,
  },
];

const visibilityLayers: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Consultation funding and summaries",
    body:
      "Medical aids and sponsors can fund consultations and receive governed session summaries for claims reconciliation, subject to member consent, policy rules and role permissions.",
    icon: Stethoscope,
  },
  {
    title: "Vitals spot checks",
    body:
      "Health Monitor workflows can support blood pressure, heart rate, oxygen saturation, temperature, glucose and ECG screening context where available and clinically appropriate.",
    icon: Activity,
  },
  {
    title: "Continuous monitoring",
    body:
      "NexRing and wearable-linked signals can support longitudinal views of sleep, recovery, activity, readiness, heart-rate trends and temperature variation where the member grants permission.",
    icon: Watch,
  },
  {
    title: "Medication adherence score",
    body:
      "The platform can surface reminder coverage, dose behaviour, verified-dose evidence and adherence risk posture to support chronic-care intervention and reward design.",
    icon: Pill,
  },
  {
    title: "Diagnostics visibility",
    body:
      "MedReach connects home phlebotomy, specimen collection, laboratory coordination and result routing into a governed pathway for diagnostic access.",
    icon: TestTube2,
  },
  {
    title: "Pharmacy fulfilment",
    body:
      "CarePort links eRx, pharmacy preparation, rider dispatch, proof-of-delivery and medicine-continuity visibility into one operational layer.",
    icon: FileCheck2,
  },
];

const payerCapabilities = [
  "Member eligibility and payment-status verification before care workflows proceed.",
  "Coverage-plan and service-rule configuration for consultations, diagnostics, devices, pharmacy items, delivery and wellness programmes.",
  "Preflight authorisation for supported services with decision posture, co-pay handling and rule snapshots.",
  "Claims, member reimbursement, provider settlement and remittance visibility.",
  "Sponsor wallet funding, reserve, capture, release and reward-liability tracking.",
  "Provider network readiness across clinicians, pharmacies, laboratories, phlebotomists and riders.",
  "Audit logs, role-based access, departments, designations and scope-based permissions.",
  "Permission-aware member health context, including vitals, device evidence, adherence and wellness activity where enabled.",
];

const programmePackages: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  includes: string[];
}> = [
  {
    title: "Access Programme",
    body:
      "For schemes or employers that want to fund convenient clinician access without losing claims discipline.",
    icon: CreditCard,
    includes: [
      "Consultation funding",
      "Preflight coverage checks",
      "Session summary visibility",
      "Claims reconciliation support",
    ],
  },
  {
    title: "Remote Monitoring Programme",
    body:
      "For chronic members, high-risk lives, post-discharge follow-up and prevention-focused cohorts.",
    icon: HeartPulse,
    includes: [
      "Health Monitor spot checks",
      "NexRing/wearable trends",
      "Risk movement visibility",
      "Intervention prompts",
    ],
  },
  {
    title: "Medication Adherence Programme",
    body:
      "For chronic medicine continuity, eRx-linked reminders, refill behaviour and evidence-linked reward design.",
    icon: Pill,
    includes: [
      "eRx auto-sync",
      "Medication reminders",
      "Camera verification",
      "Adherence scoring",
    ],
  },
  {
    title: "Diagnostics Programme",
    body:
      "For payer-funded home diagnostics, phlebotomy coordination, specimen tracking and laboratory result routing.",
    icon: TestTube2,
    includes: [
      "Home phlebotomy",
      "Specimen chain-of-custody",
      "Lab status visibility",
      "Result-routing support",
    ],
  },
  {
    title: "Care Logistics Programme",
    body:
      "For last-mile medicine access, prescription fulfilment, pharmacy operations and proof-of-delivery visibility.",
    icon: FileCheck2,
    includes: [
      "CarePort fulfilment",
      "Rider dispatch",
      "Proof-of-delivery",
      "Medicine continuity",
    ],
  },
  {
    title: "Enterprise Contactless Medicine Programme",
    body:
      "For full ecosystem deployment across care access, devices, diagnostics, pharmacy, wellness rewards and InsightCore.",
    icon: BrainCircuit,
    includes: [
      "Multi-module deployment",
      "InsightCore intelligence",
      "Role-based dashboards",
      "Governance reporting",
    ],
  },
];

const memberJourneys = [
  {
    title: "Chronic-care member",
    body:
      "A hypertensive or diabetic member can receive funded consultations, vitals monitoring, medication reminders, pharmacy delivery and early escalation before complications become catastrophic.",
  },
  {
    title: "Post-discharge member",
    body:
      "A recently discharged member can be followed remotely with vitals, symptoms, medication adherence, diagnostics and clinician review to reduce avoidable readmission risk.",
  },
  {
    title: "Fertility and family planning",
    body:
      "Couples can attend virtual fertility sessions together, even from different locations. NexRing-supported temperature variation and trend context can strengthen fertility prediction beyond calendar-only logic.",
  },
  {
    title: "Wellness and rewards member",
    body:
      "A member can grant permission for activity, sleep, steps, calories, adherence and device signals to support evidence-linked rewards, lifestyle programmes and sponsor-funded incentives.",
  },
];

const sponsorSafeData = [
  "Member consent and role permissions determine what can be seen.",
  "Programme dashboards should emphasise aggregated and purpose-specific visibility.",
  "Patient-level clinical information should not be exposed to employers without a lawful basis and explicit permission.",
  "Medical aids and HMOs may require deeper claims, authorisation, coverage and clinical-context visibility than corporate sponsors.",
  "Users should be able to see participating medical-aid or sponsor offerings inside Ambulant+ and sign up where the product and eligibility pathway allows it.",
];

const economicCase = [
  {
    title: "Avoid high-cost complications",
    body:
      "The strongest payer value is not one cheaper consultation. It is preventing avoidable deterioration, hospitalisation, advanced procedures, amputations, dialysis escalation and other high-cost outcomes where earlier intervention was possible.",
  },
  {
    title: "Turn benefits into behaviour",
    body:
      "Medical aids already fund consultations, diagnostics, medicines, devices and wellness benefits. Ambulant+ helps connect those benefits to measurable behaviour, adherence and care-continuity signals.",
  },
  {
    title: "Improve member lifetime value",
    body:
      "Healthier members remain members for longer, engage more positively with the scheme, and avoid cost events that can exceed years of contribution value.",
  },
  {
    title: "Make prevention visible",
    body:
      "InsightCore can make preventive care operationally visible: who is engaging, who is regressing, who may regress next, and which interventions are changing member behaviour.",
  },
];

const privacyModel = [
  {
    title: "Patient-controlled sharing",
    body:
      "Members grant permission from their profile for appropriate visibility into vitals, wearable signals, adherence, lifestyle activity and clinical context.",
    icon: LockKeyhole,
  },
  {
    title: "Role-based access",
    body:
      "Claims teams, authorisation teams, wellness teams, finance teams and executives should see different levels of information based on their function.",
    icon: ShieldCheck,
  },
  {
    title: "Audit-ready operations",
    body:
      "Authorisations, claims, settlements, wallet movements, reward decisions and access events should be traceable for governance review.",
    icon: BadgeCheck,
  },
];

export default function ClientsPage() {
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
              Medical aids, HMOs and sponsors
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Preventive care becomes valuable when it is measurable, fundable and governed.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ gives medical aids, HMOs, employers and corporate sponsors a governed
              Contactless Medicine infrastructure for earlier intervention, remote monitoring,
              medication adherence, claims preflight, diagnostics, pharmacy fulfilment, rewards and
              programme intelligence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.clientAppUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Open Client App <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/85 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Request enterprise demo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {executiveThesis.map((item) => (
                <div key={item} className="rounded-3xl border border-white/70 bg-white/78 p-4 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-7">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl shadow-cyan-950/10">
              <img
                src="/visuals/clients/medical-aid-command-dashboard.webp"
                alt="Ambulant+ medical aid and sponsor programme dashboard"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-700">
                  Client command layer
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Programme utilisation, risk movement, adherence, claims posture, wallet funding,
                  provider readiness and reward evidence in one governance-aware workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="The payer problem"
        title="The expensive member is usually not expensive at the beginning."
        body="The commercial case for Ambulant+ is simple: complications cost more than prevention, but prevention only works when access, monitoring, adherence, diagnostics, pharmacy fulfilment and claims operations are joined up."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {operatingPainPoints.map(({ title, body, icon: Icon }) => (
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
                Economic case
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Pay earlier, intervene earlier, avoid paying catastrophically later.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Ambulant+ is not positioned as a cost-cutting gatekeeper. It is a preventive-care
                infrastructure that helps schemes and sponsors spend earlier on the right signals,
                the right care, the right fulfilment and the right escalation.
              </p>
            </div>

            <div className="grid gap-3">
              {economicCase.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="What clients can see"
        title="Permission-aware visibility across care, claims, behaviour and operations."
        body="Ambulant+ can surface member and programme signals according to role, consent, legal basis, scheme rules and sponsor configuration."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibilityLayers.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Client-app capability map"
        title="Built for payer operations, not just passive reporting."
        body="The Ambulant+ client workspace is designed around actions that matter to medical aids, HMOs and sponsors: eligibility, preflight, authorisation, claims, settlements, wallet funding, rewards, provider readiness, audit and programme governance."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {payerCapabilities.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Programme packages"
        title="Packages for access, monitoring, adherence, diagnostics, logistics and enterprise care."
        body="Each programme should be configured around sponsor goals, legal basis, privacy boundary, payment model, coverage rules and operational scope."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programmePackages.map(({ title, body, icon: Icon, includes }) => (
            <div key={title} className="glass-panel rounded-[32px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              <div className="mt-5 grid gap-2">
                {includes.map((item) => (
                  <div key={item} className="flex gap-2 text-sm leading-6 text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Member journeys
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Designed around the moments where schemes lose money and members lose health.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-600 md:text-lg">
              The platform connects member access, clinical review, device evidence, prescription
              fulfilment, diagnostics, wellness behaviour and claims reconciliation so intervention
              becomes earlier, more visible and more accountable.
            </p>
          </div>

          <div className="grid gap-4">
            {memberJourneys.map((item) => (
              <div key={item.title} className="glass-panel rounded-[30px] p-6">
                <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Medical-aid marketplace"
        title="Onboarded schemes and sponsors become discoverable inside Ambulant+."
        body="Any Ambulant+ user can see available scheme, HMO, employer or sponsor offerings where configured. Eligible users can sign up from within Ambulant+, connect their profile, grant permissions and begin using approved benefits."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-panel rounded-[30px] p-6">
            <Banknote className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">Product discovery</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Members can view participating medical-aid, HMO, corporate or sponsor programmes
              inside the Ambulant+ ecosystem where available.
            </p>
          </div>

          <div className="glass-panel rounded-[30px] p-6">
            <WalletCards className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">Instant onboarding</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Users can begin signup, eligibility, payment-status verification or benefit activation
              workflows directly from Ambulant+ where the client has enabled that route.
            </p>
          </div>

          <div className="glass-panel rounded-[30px] p-6">
            <Dumbbell className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">Reward ecosystems</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Sponsors can connect rewards to verified behaviours such as adherence, activity, sleep,
              wellness participation and programme milestones.
            </p>
          </div>
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[38px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
                Fertility and family health
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                High-engagement care programmes can become member-retention engines.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Fertility, antenatal, paediatric and family-health journeys are not just clinical
                features. For schemes and sponsors, they are high-trust engagement points where
                members feel supported before expensive complications or fragmented journeys develop.
              </p>
            </div>

            <div className="grid gap-4">
              {[
                "NexRing-supported temperature variation and baseline-aware trend signals can strengthen fertility prediction beyond calendar-only logic.",
                "Couples can attend the same fertility consultation virtually even from different locations.",
                "Multi-specialty sessions can support complex journeys involving GP, Ob/Gyn, dietician, mental-health or other clinician input.",
                "A mother at work can join a consultation for a sick child at home where family permissions and clinical workflow allow it.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/80 p-5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                  <p className="text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Governance boundary"
        title="Visibility must never become inappropriate disclosure."
        body="Ambulant+ should give medical aids, HMOs and sponsors the operational intelligence they need without exposing information beyond consent, purpose, role and law."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {sponsorSafeData.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6 md:py-16">
        {privacyModel.map(({ title, body, icon: Icon }) => (
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
                Enterprise demo
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
                Bring your actuaries, claims team, managed-care team and innovation team.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                A serious Ambulant+ client demo should walk through member onboarding, benefit
                discovery, preflight, funded consultation, device evidence, adherence, CarePort,
                MedReach, claims, settlements, rewards and InsightCore.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/demos"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
              >
                Request demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                Speak to partnerships <ArrowRight className="h-4 w-4" />
              </Link>
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