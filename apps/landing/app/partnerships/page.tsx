import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Handshake,
  HeartHandshake,
  HeartPulse,
  Network,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  TestTube2,
  Truck,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import ImageStoryBand from "@/components/ImageStoryBand";
import WorkflowTimeline from "@/components/WorkflowTimeline";

export const metadata = {
  title: "Partnerships | Build Contactless Medicine Programmes with Ambulant+",
  description:
    "Partner with Ambulant+ to build governed Contactless Medicine programmes across clinicians, medical aids, HMOs, employers, pharmacies, laboratories, phlebotomy networks, technology partners and community care access points.",
  keywords: [
    "Contactless Medicine partnership",
    "healthcare partnerships South Africa",
    "digital health partnerships",
    "MedTech partnerships South Africa",
    "telemedicine partnership",
    "remote patient monitoring partnership",
    "medical aid partnership",
    "HMO partnership",
    "corporate wellness partnership",
    "pharmacy delivery partnership",
    "laboratory diagnostics partnership",
    "home phlebotomy partnership",
    "IoMT partnership",
    "connected healthcare ecosystem",
    "virtual care partnership",
    "healthcare access partnership",
  ],
};

const partnerTypes: Array<{
  title: string;
  label: string;
  body: string;
  value: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Clinicians and specialist groups",
    label: "Clinical network partnership",
    body:
      "Build remote practice capacity with device-supported consultation, structured documentation, patient access, escalation pathways and flexible clinician-led care.",
    value:
      "Remote practice, broader patient reach, connected-device review and governed consultation workflows.",
    icon: Stethoscope,
    href: "/clinicians",
  },
  {
    title: "Medical aids, HMOs and sponsors",
    label: "Payer and sponsor partnership",
    body:
      "Support preventive care, remote monitoring, chronic-care continuity, adherence visibility, member engagement, rewards and earlier intervention.",
    value:
      "Lower avoidable deterioration risk, stronger member value and programme-level visibility.",
    icon: Building2,
    href: "/clients",
  },
  {
    title: "Employers and institutions",
    label: "Corporate health partnership",
    body:
      "Move workforce wellness beyond generic benefits into clinical prevention, remote access, chronic monitoring, medical-aid coordination and care continuity.",
    value:
      "Healthier employees, reduced access friction and measurable preventive-care infrastructure.",
    icon: Users,
    href: "/clients",
  },
  {
    title: "Laboratories and phlebotomy networks",
    label: "Diagnostics partnership",
    body:
      "Use MedReach to support home phlebotomy, specimen collection, laboratory handover, chain-of-custody visibility and result-routing workflows.",
    value:
      "More reachable diagnostics, improved handover visibility and patient-friendly testing pathways.",
    icon: TestTube2,
    href: "/medreach/labs",
  },
  {
    title: "Pharmacies and delivery networks",
    label: "Fulfilment partnership",
    body:
      "Use CarePort to support eRx fulfilment, SKU readiness, dispatch handover, patient updates, proof-of-delivery and medication continuity.",
    value:
      "Connected prescription fulfilment, last-mile medicine delivery and adherence-support workflows.",
    icon: Pill,
    href: "/careport/pharmacies",
  },
  {
    title: "Technology and device partners",
    label: "Integration partnership",
    body:
      "Explore responsible integration of supported medical devices, clinical data workflows, analytics, EHR/HMS touchpoints and governance-aware infrastructure.",
    value:
      "A route into a controlled Contactless Medicine ecosystem rather than isolated hardware or software.",
    icon: Network,
    href: "/devices",
  },
  {
    title: "Community and access-point partners",
    label: "Access infrastructure partnership",
    body:
      "Create practical care access through community sites, workplace points, malls, airports, clinics and supervised deployment locations.",
    value:
      "More healthcare reach without forcing every patient into traditional clinic attendance.",
    icon: HeartHandshake,
    href: "/demos",
  },
  {
    title: "Research and innovation partners",
    label: "Evidence and deployment partnership",
    body:
      "Collaborate on connected-care studies, validation pathways, outcomes research, access models, workflow evidence and responsible innovation.",
    value:
      "Stronger credibility, evidence generation and shared digital-health learning.",
    icon: FlaskConical,
    href: "/research-and-development",
  },
];

const buildModels: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Remote monitoring programmes",
    body:
      "Support chronic-care and preventive-care pathways using remote vitals, wearable context, symptom review, adherence signals and clinician-led escalation.",
    icon: HeartPulse,
  },
  {
    title: "Home diagnostics networks",
    body:
      "Coordinate home phlebotomy, specimen collection, laboratory handover and result-routing through MedReach workflows.",
    icon: TestTube2,
  },
  {
    title: "Medicine-continuity pathways",
    body:
      "Connect eRx fulfilment, pharmacy readiness, dispatch, proof-of-delivery, medication reminders and adherence support through CarePort.",
    icon: Pill,
  },
  {
    title: "Corporate and payer prevention",
    body:
      "Help medical aids, HMOs, employers and sponsors identify risk earlier, reduce avoidable deterioration and improve member engagement.",
    icon: Building2,
  },
  {
    title: "Access-point deployments",
    body:
      "Prepare future-ready health access points in workplaces, communities, transport hubs, shopping centres and supervised consultation locations.",
    icon: Store,
  },
  {
    title: "Governed virtual care",
    body:
      "Support clinician-led care where remote consultation is appropriate, while preserving escalation, documentation and professional judgement.",
    icon: ShieldCheck,
  },
];

const ecosystemModules = [
  {
    title: "Ambulant+",
    label: "Contactless Medicine ecosystem",
    body:
      "The patient and clinician platform for virtual care, supported devices, medical records, bookings, care pathways and governed access.",
  },
  {
    title: "MedReach",
    label: "Diagnostics operations",
    body:
      "Home phlebotomy, specimen collection, laboratory handover, result readiness and diagnostic workflow coordination.",
  },
  {
    title: "CarePort",
    label: "Pharmacy fulfilment operations",
    body:
      "eRx fulfilment, SKU readiness, medicine dispatch, rider handover, patient updates and proof-of-delivery.",
  },
  {
    title: "InsightCore",
    label: "Programme intelligence",
    body:
      "Governance-aware visibility across utilisation, adherence, remote monitoring, risk signals and operational performance.",
  },
  {
    title: "Supported devices",
    label: "IoMT and clinical context",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows for supported remote-care and monitoring pathways.",
  },
  {
    title: "Care centres",
    label: "Condition and population pathways",
    body:
      "Ladies’ Health, Paediatric, Antenatal and Gentlemen’s Health pathways for focused care access and programme design.",
  },
];

const whyNow = [
  "Healthcare is moving beyond ordinary telemedicine into device-supported, data-informed, clinician-led remote care.",
  "Patients need convenient access without losing clinical context, diagnostics, medicine continuity or escalation safety.",
  "Medical aids, HMOs and employers need earlier intervention, stronger adherence and better chronic-care visibility.",
  "Pharmacies and laboratories need connected workflows that reduce fragmentation and improve operational accountability.",
  "Clinicians need flexible remote practice models that protect professional judgement and documentation discipline.",
  "Community, mall, airport and workplace access points can become practical healthcare infrastructure when properly governed.",
];

const governancePoints = [
  "Role-based workspaces and permission boundaries.",
  "Consent-aware data sharing and programme visibility.",
  "Audit-friendly activity records and accountable handoffs.",
  "Clinical escalation boundaries for symptoms, readings and device findings.",
  "Training before activation for operational and clinical workflows.",
  "Data minimisation and responsible use of health information.",
  "Clear separation between clinical care, diagnostics, pharmacy fulfilment, logistics and reporting.",
  "Professional judgement preserved across all device-supported and AI-supported workflows.",
];

const ctaCards = [
  {
    title: "Medical aids and sponsors",
    body:
      "Explore how Ambulant+ supports preventive care, remote monitoring, adherence visibility and member engagement.",
    href: "/clients",
  },
  {
    title: "Pharmacies",
    body:
      "Review CarePort pharmacy readiness, eRx fulfilment, handover and medication-continuity workflows.",
    href: "/careport/pharmacies",
  },
  {
    title: "Laboratories",
    body:
      "Review MedReach laboratory onboarding, specimen handover, result routing and diagnostics coordination.",
    href: "/medreach/labs",
  },
];

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Partnerships"
        title="Partner with Ambulant+ to build governed Contactless Medicine programmes."
        body="Ambulant+ works with clinicians, medical aids, HMOs, employers, laboratories, pharmacies, delivery teams, technology partners and access-point operators to build connected healthcare pathways that are clinically responsible, operationally visible and ready for prevention-focused care."
        imageSrc="/visuals/partnerships/partner-ecosystem.webp"
        imageAlt="Ambulant+ healthcare partner ecosystem visual"
        primaryCta={{ label: "Start partnership conversation", href: "/contact?type=partnership" }}
        secondaryCta={{ label: "Request enterprise demo", href: "/demos?type=enterprise" }}
        overlayTitle="Partner network"
        overlayItems={[
          {
            label: "Clinical partners",
            value: "Consultation, documentation, device review and escalation.",
          },
          {
            label: "Operational partners",
            value: "Diagnostics, pharmacy fulfilment, handover and delivery.",
          },
          {
            label: "Programme partners",
            value: "Medical-aid, employer, HMO and sponsor deployments.",
          },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Why partner now
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Healthcare needs partners who can connect access, data, diagnostics and fulfilment.
          </h2>
          <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
            Ordinary digital health often stops at booking, video or isolated data capture.
            Ambulant+ partnerships are designed around complete pathways: patient access,
            clinician review, connected devices, home diagnostics, medicine continuity,
            programme visibility and governed escalation.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {whyNow.map((point) => (
            <div
              key={point}
              className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5"
            >
              <CheckCircle2 className="h-5 w-5 text-cyan-700" />
              <p className="mt-4 text-sm leading-7 text-slate-700">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Partnership pathways
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Choose the pathway that matches your role in the care ecosystem.
          </h2>
          <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
            Ambulant+ does not treat every partner as the same type of user. Each pathway
            is built around responsibility, permitted actions, data visibility, workflow
            boundaries and measurable operating value.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {partnerTypes.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-6 w-6" />
                </div>

                <div className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
                  {item.label}
                </div>

                <h3 className="mt-3 text-lg font-semibold text-slate-950">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  {item.value}
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  Explore pathway <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <ImageStoryBand
        eyebrow="Ecosystem model"
        title="Partnerships are organised around responsibility, not generic access."
        body="Ambulant+ partner pathways are designed around the work each partner is authorised and equipped to perform, with clear boundaries between clinical care, diagnostics, pharmacy fulfilment, logistics, programme reporting and governance."
        imageSrc="/visuals/partnerships/partner-ecosystem.webp"
        imageAlt="Connected partner ecosystem across Ambulant+ modules"
        points={[
          "Clinician partners support governed consultation, documentation, device-supported review and escalation.",
          "Laboratory and phlebotomy partners support MedReach diagnostic workflows and chain-of-custody visibility.",
          "Pharmacy and delivery partners support CarePort prescription fulfilment, proof-of-delivery and medication continuity.",
          "Employer, medical-aid, HMO and sponsor partners engage through consent-aware programme visibility.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              What partners can build
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
              Build care pathways that are more useful than ordinary access.
            </h2>
            <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
              The strongest partnerships are not shallow listings. They create measurable
              care access, workflow accountability, earlier intervention and better continuity
              across real-world healthcare operations.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/operations"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                View operations <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/resources"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                View resources <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {buildModels.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="glass-panel rounded-[30px] p-6">
                  <Icon className="h-6 w-6 text-cyan-700" />
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[36px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Ecosystem seriousness
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Partners plug into a real operating model, not a loose marketplace.
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300 md:text-base">
                Ambulant+ is designed as a connected Contactless Medicine ecosystem with
                patient access, clinician workflows, MedReach diagnostics, CarePort fulfilment,
                InsightCore intelligence and supported IoMT device pathways.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {ecosystemModules.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/10 p-5"
                >
                  <Workflow className="h-5 w-5 text-cyan-200" />
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <div className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                    {item.label}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Governance and readiness
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Healthcare partnerships must be controlled, auditable and clinically responsible.
          </h2>
          <p className="mt-5 text-sm leading-8 text-slate-600 md:text-base">
            Ambulant+ partnerships should create confidence for patients, clinicians,
            funders and operators by defining who can do what, what data is visible, when
            care must escalate and how activity is recorded.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {governancePoints.map((point) => (
            <div key={point} className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-sm">
              <ShieldCheck className="h-5 w-5 text-cyan-700" />
              <p className="mt-4 text-sm leading-7 text-slate-700">{point}</p>
            </div>
          ))}
        </div>
      </section>

      <WorkflowTimeline
        eyebrow="Partner onboarding"
        title="A structured path from interest to operational readiness."
        steps={[
          {
            title: "Identify pathway",
            body:
              "Clarify whether the partner belongs to clinical, payer, employer, diagnostic, pharmacy, technology, access-point or community care workflows.",
          },
          {
            title: "Define responsibilities",
            body:
              "Map partner responsibilities, user roles, workflow boundaries, data visibility, consent expectations and escalation obligations.",
          },
          {
            title: "Configure workspace",
            body:
              "Set up the relevant Ambulant+ workspace, access rules, partner permissions, operational routes and programme surfaces.",
          },
          {
            title: "Train teams",
            body:
              "Support onboarding, workflow training, device-readiness guidance, quality expectations, documentation discipline and support routes.",
          },
          {
            title: "Operate",
            body:
              "Run care pathways with visible status, accountable handoffs, documented activity, role-appropriate access and operational review.",
          },
          {
            title: "Review",
            body:
              "Use governance-aware reporting to improve service delivery, reduce friction, strengthen partner performance and support safer scale.",
          },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {ctaCards.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
            >
              <ClipboardCheck className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="mb-8 rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
                Partnership contact
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Ready to explore a governed Contactless Medicine partnership?
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">
                Tell us whether you are a clinician group, medical aid, HMO, employer,
                pharmacy, laboratory, device company, technology partner or access-point
                operator. We will route the conversation to the correct workflow.
              </p>
            </div>
            <Link
              href="/contact?type=partnership"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Start conversation <Handshake className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <CTA />
      </section>
    </main>
  );
}