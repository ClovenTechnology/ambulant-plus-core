import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";
import SectionShell from "@/components/SectionShell";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Medical Aid Deployment Guide | Ambulant+ Resources",
  description: "A deployment guide for medical aids, HMOs, employers and sponsors using Ambulant+ for preventive care, remote monitoring, adherence, rewards, claims visibility and programme intelligence.",
  keywords: [
    "medical aid deployment guide",
    "medical aid remote monitoring",
    "medical aid preventive care",
    "HMO remote monitoring",
    "corporate wellness clinical prevention",
    "remote patient monitoring for insurers",
    "medical aid claims visibility",
    "programme intelligence",
    "Contactless Medicine resources"
],
  alternates: {
    canonical: absoluteUrl("/resources/medical-aid-deployment-guide"),
  },
};

const sections = [
  {
    title: "Programme design",
    body: "A strong payer programme should define the population, risk tier, benefits and expected clinical pathway before launch.",
    bullets: ["Define eligible member groups, chronic-care cohorts, wellness cohorts or family-care pathways.", "Choose which services are covered, co-funded or self-pay.", "Map doctor booking, diagnostics, pharmacy fulfilment and monitoring workflows before enrolment.", "Set governance boundaries for consent, role access and reporting."],
  },
{
    title: "Member onboarding",
    body: "Members must understand what data is shared, what services are available and how the programme helps them.",
    bullets: ["Give members clear profile setup instructions.", "Explain how to grant permission for medical-aid or sponsor visibility where applicable.", "Route members to supported devices, doctor booking, reminders and care-centre pathways.", "Use rewards carefully to encourage healthy behaviour without punishing illness."],
  },
{
    title: "Preventive-care visibility",
    body: "Payers need earlier signals before avoidable deterioration becomes high-cost care.",
    bullets: ["Use remote vitals and longitudinal monitoring for authorised chronic-care programmes.", "Review adherence trends, eRx continuity and medicine fulfilment signals.", "Use MedReach diagnostics to reduce delayed testing and missed follow-up.", "Use InsightCore reporting to identify programme-level gaps, not to replace clinical judgement."],
  },
{
    title: "Claims and operations",
    body: "The care loop should be easy to audit and simple to reconcile.",
    bullets: ["Consultation summaries and claims-ready events should be available after eligible encounters.", "Preflight checks should confirm eligibility, payment route and coverage rules where configured.", "CarePort can support medicine fulfilment, proof-of-delivery and adherence continuity.", "MedReach can support home-draw assignment, specimen handover and result routing."],
  }
];

const safetyChecks = [
  "Member consent, scheme rules and role permissions must define what data is visible.",
  "Programme intelligence should support prevention and care continuity, not inappropriate surveillance.",
  "Emergency care, in-person assessment and specialist referral must remain available when clinically required.",
  "Medical-aid deployment should be piloted, measured and governed before large-scale expansion."
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: metadata.title,
  description: metadata.description,
  about: [
    "Contactless Medicine",
    "remote patient monitoring",
    "IoMT",
    "device-supported virtual care",
  ],
  publisher: {
    "@type": "Organization",
    name: "Ambulant+",
    url: site.url,
  },
  inLanguage: "en-ZA",
  mainEntityOfPage: absoluteUrl("/resources/medical-aid-deployment-guide"),
};

export default function ResourceGuidePage() {
  return (
    <main>
      <Script
        id="medical-aid-deployment-guide-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[12%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[10%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl">
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:text-slate-950"
          >
            ← Back to resources
          </Link>

          <div className="mt-8 rounded-[38px] border border-cyan-100 bg-white/86 p-6 shadow-glow md:p-9">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              <ClipboardCheck className="h-4 w-4" />
              Medical aid deployment
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Medical aid deployment guide.
            </h1>

            <p className="mt-6 max-w-4xl text-lg leading-9 text-slate-600">
              Plan an Ambulant+ programme for medical aids, HMOs, employers and sponsors using governed member onboarding, consent-aware data visibility, remote monitoring, adherence support, diagnostics coordination, pharmacy fulfilment and preventive-care intelligence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request medical-aid demo <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.supportEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Ask for support <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Operational guide"
        title="Use the workflow as structured support, not as a replacement for professional judgement."
        body="These instructions are written for Ambulant+ supported workflows. Device readings, recordings and trend data should be interpreted by an appropriate clinician in context."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="glass-panel rounded-[32px] p-6">
              <HeartPulse className="h-7 w-7 text-cyan-700" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-8 text-slate-600">{section.body}</p>

              <div className="mt-5 grid gap-3">
                {section.bullets.map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl bg-white/78 p-4">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-7 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-[0.92fr_1.08fr] md:px-6 md:py-16">
        <div className="rounded-[34px] bg-slate-950 p-7 text-white shadow-glow">
          <ShieldCheck className="h-8 w-8 text-cyan-200" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight">
            Safety and governance boundaries.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-300">
            Ambulant+ resource content supports preparation, documentation and care continuity.
            It does not create an emergency service and must not delay urgent in-person care
            where symptoms, readings, recordings or clinician judgement require escalation.
          </p>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-amber-600" />
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Escalate when appropriate.
            </h2>
          </div>

          <div className="mt-5 grid gap-3">
            {safetyChecks.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-white/78 p-4">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                <p className="text-sm leading-7 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="glass-panel grid gap-6 rounded-[34px] p-7 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">
              Next step
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Build this into a guided Ambulant+ workflow.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">
              Patients, clinicians, medical aids and programme teams can request a guided walkthrough
              to see how resources, device workflows, bookings, diagnostics and fulfilment connect
              inside the Ambulant+ ecosystem.
            </p>
          </div>

          <Link
            href="/demos"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white"
          >
            Book demo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
