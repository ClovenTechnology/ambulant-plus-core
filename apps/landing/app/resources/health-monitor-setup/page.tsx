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
  title: "Health Monitor Setup Guide | Ambulant+ Resources",
  description: "Set up the Ambulant+ Health Monitor for supported remote vitals workflows including temperature, SpO\u2082, heart rate, blood pressure, blood glucose and ECG capture.",
  keywords: [
    "Health Monitor setup",
    "remote vitals monitoring",
    "remote patient monitoring guide",
    "IoMT device setup",
    "blood pressure monitoring",
    "SpO2 monitoring",
    "home ECG",
    "blood glucose remote monitoring",
    "Contactless Medicine resources"
],
  alternates: {
    canonical: absoluteUrl("/resources/health-monitor-setup"),
  },
};

const sections = [
  {
    title: "Before first use",
    body: "Good readings start with preparation. The device should be ready, charged and paired before a consultation begins.",
    bullets: ["Fully charge the Health Monitor using the enclosed cable before initial setup and testing.", "Use the supported Ambulant+ app or workspace to control the device from a mobile phone, tablet or computer.", "Confirm the correct patient profile before recording readings.", "Use the device in a calm setting with the patient seated, still and appropriately positioned."],
  },
{
    title: "Supported measurements",
    body: "The Health Monitor supports structured spot-check readings that can provide useful clinical context.",
    bullets: ["Temperature can be captured by selecting the temperature workflow and pointing the sensor as instructed.", "SpO₂ and heart-rate readings require the finger to rest lightly over the sensor without excessive pressure.", "Blood pressure requires correct cuff placement, secure monitor attachment and a quiet measurement period.", "Blood glucose requires the correct strip type and a fresh blood sample according to the prompt.", "ECG capture requires the correct two-hand finger contact position and a relaxed patient during recording."],
  },
{
    title: "Clinical workflow use",
    body: "Readings should be treated as structured context inside a clinician-led care pathway.",
    bullets: ["Use readings to support consultation preparation, follow-up review and chronic-care monitoring.", "Repeat unexpected readings when positioning, movement or device contact may have affected accuracy.", "Document symptoms alongside readings rather than treating numbers in isolation.", "Use out-of-range readings to support earlier clinician review, not self-diagnosis."],
  },
{
    title: "Common mistakes to avoid",
    body: "Most poor readings are caused by rushed setup, movement, loose cuff placement or wrong sensor contact.",
    bullets: ["Do not take blood pressure while walking, talking or immediately after exertion unless instructed.", "Do not press the SpO₂ sensor too hard because poor contact can distort readings.", "Do not use glucose strips that do not match the selected strip type.", "Do not ignore severe symptoms because a single reading appears normal."],
  }
];

const safetyChecks = [
  "Chest pain, severe breathlessness, fainting, confusion, stroke symptoms, severe allergic symptoms or uncontrolled bleeding require urgent care.",
  "Repeated very abnormal readings should be escalated to a clinician promptly.",
  "A device result should not override clinical concern from the patient, family, carer or clinician.",
  "Use local emergency services when symptoms suggest an emergency."
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
  mainEntityOfPage: absoluteUrl("/resources/health-monitor-setup"),
};

export default function ResourceGuidePage() {
  return (
    <main>
      <Script
        id="health-monitor-setup-jsonld"
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
              Health Monitor setup
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Health Monitor setup guide.
            </h1>

            <p className="mt-6 max-w-4xl text-lg leading-9 text-slate-600">
              Prepare the supported Health Monitor for Ambulant+ Contactless Medicine workflows, including safe charging, correct measurement selection, positioning and structured capture of vitals during remote consultation or follow-up.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request guided walkthrough <ArrowRight className="h-4 w-4" />
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
