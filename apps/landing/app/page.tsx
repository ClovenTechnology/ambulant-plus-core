import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  HeartPulse,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import ProductCard from "@/components/ProductCard";
import SectionShell from "@/components/SectionShell";
import ComplianceBadge from "@/components/ComplianceBadge";
import ImageStoryBand from "@/components/ImageStoryBand";
import { productRoutes, trustPillars } from "@/lib/routes";
import { site } from "@/lib/site";

const heroPanes = [
  {
    title: "Clinical",
    body: "Virtual consultation and device-supported review.",
  },
  {
    title: "Diagnostics",
    body: "Home phlebotomy and laboratory coordination.",
  },
  {
    title: "Operations",
    body: "Pharmacy fulfilment and care logistics visibility.",
  },
  {
    title: "Intelligence",
    body: "InsightCore adherence, risk, programme and governance intelligence.",
  },
];

const heroValueCards = [
  {
    title: "Precision treatment",
    body:
      "Care decisions supported by clinician review, objective device signals and structured patient context.",
  },
  {
    title: "Predictive medicine",
    body:
      "InsightCore helps surface adherence trends, regression risk and care-pathway visibility.",
  },
  {
    title: "Cost reduction",
    body:
      "Earlier intervention, remote monitoring and fulfilment visibility can reduce avoidable care friction.",
  },
  {
    title: "Access expansion",
    body:
      "Patients, clinicians, diagnostics, medicine and care programmes connect in one governed ecosystem.",
  },
];

const consultationModel = [
  "Health Monitor supports blood pressure, SpO₂, temperature, glucose, heart-rate and ECG workflows.",
  "Digital Stethoscope and HD Otoscope add auscultation and imaging context to clinician-led virtual review.",
  "NexRing supports longitudinal signals, readiness trends and fertility-relevant temperature variation against individual baselines.",
  "InsightCore layers adherence trends, care-pathway visibility, regression-risk signals and governance-aware intelligence around the care journey.",
];

const finalTrustCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Privacy-aware",
    body:
      "Role-based access, consent-aware sharing and careful handling of sensitive health-related information.",
    icon: ShieldCheck,
  },
  {
    title: "Governance-ready",
    body:
      "Structured for review, auditability, operational controls, escalation language and documented care boundaries.",
    icon: HeartPulse,
  },
  {
    title: "Intelligence-led",
    body:
      "InsightCore supports adherence trends, regression-risk signals and programme visibility with governance boundaries.",
    icon: BrainCircuit,
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              <ShieldCheck className="h-4 w-4" />
              Contactless Medicine Infrastructure
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 md:text-7xl">
              Welcome to Ambulant+ South Africa.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ is the world&apos;s first fully Contactless Medicine platform,
              engineered by Cloven Technology to advance precision treatment, predictive
              medicine, lower-cost care and wider access to clinician-supervised healthcare.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientAppUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Access Patient App <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/platform"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Explore the platform <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2">
              {heroValueCards.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/70 bg-white/72 p-4 shadow-sm"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div className="mt-3 text-sm font-semibold text-slate-950">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[42px] p-5 md:p-8">
            <div className="rounded-[34px] border border-cyan-100 bg-slate-950 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                <span>Ambulant+ platform core</span>
                <RadioTower className="h-4 w-4" />
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {heroPanes.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-white/10 bg-white/10 p-5"
                  >
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-200">
                      {item.body}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-sm leading-7 text-emerald-50">
                Ambulant+ is designed to virtually approximate important elements of physical
                consultation through connected clinical devices, diagnostics, fulfilment and
                intelligence — without replacing emergency services or clinician judgement.
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Platform routes"
        title="One ecosystem. Dedicated workspaces for every care pathway."
        body="Ambulant+ gives each user group a focused environment while the public domain remains the trusted home for platform information, access and governance."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productRoutes.map((item) => (
            <ProductCard
              key={item.title}
              title={item.title}
              summary={item.summary}
              href={item.href}
              icon={item.icon}
            />
          ))}
        </div>
      </SectionShell>

      <ImageStoryBand
        eyebrow="IoMT-integrated consultation"
        title="Virtual consultation with clinical context, not video alone."
        body="Ambulant+ brings the four supported Contactless Medicine device pathways into clinician-led virtual care, then surrounds that care with InsightCore intelligence, MedReach diagnostics and CarePort medicine fulfilment."
        imageSrc="/visuals/devices/device-ecosystem.webp"
        imageAlt="Ambulant+ connected device ecosystem"
        imageSide="right"
        imagePosition="center"
        ctaLabel="Explore devices"
        ctaHref="/devices"
        points={consultationModel}
      />

      <ImageStoryBand
        eyebrow="Diagnostics at home"
        title="MedReach brings laboratory workflows closer to the patient."
        body="Home phlebotomy, specimen collection, chain-of-custody and laboratory handover become part of one governed diagnostic journey."
        imageSrc="/visuals/medreach/medreach-home-draw.webp"
        imageAlt="MedReach home phlebotomy workflow"
        imageSide="left"
        imagePosition="center"
        ctaLabel="Explore MedReach"
        ctaHref="/medreach"
        points={[
          "Structured home blood draw and specimen-collection workflow.",
          "Laboratory handover and result-routing visibility.",
          "Consent, traceability and operational accountability across the diagnostic pathway.",
        ]}
      />

      <ImageStoryBand
        eyebrow="Medicine continuity"
        title="CarePort connects pharmacy fulfilment to patient delivery."
        body="Medication access becomes operationally visible from pharmacy preparation to rider handover, delivery progress and proof-of-delivery."
        imageSrc="/visuals/careport/careport-erx-delivery.webp"
        imageAlt="CarePort pharmacy fulfilment and medicine delivery workflow"
        imageSide="right"
        imagePosition="center"
        ctaLabel="Explore CarePort"
        ctaHref="/careport"
        points={[
          "Pharmacy order handling and dispatch readiness.",
          "Delivery-rider workflow, patient updates and proof-of-delivery.",
          "Fulfilment visibility for patients, clinicians and accountable care programmes.",
        ]}
      />

      <SectionShell
        eyebrow="Trust architecture"
        title="Designed for careful healthcare deployment."
        body="Ambulant+ uses restrained clinical language, separates informational content from clinical advice, and preserves governance boundaries around emergency care, device data and regulated claims."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trustPillars.map((item) => (
            <ComplianceBadge key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6">
        {finalTrustCards.map(({ title, body, icon: Icon }) => (
          <div key={title} className="glass-panel rounded-[34px] p-6">
            <Icon className="h-7 w-7 text-cyan-700" />
            <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}