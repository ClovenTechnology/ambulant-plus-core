
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Personal Health Management Suite | Ambulant+ Resources",
  description: "Learn how to use Ambulant+ as a personal health management suite with reminders, self-checks, home vitals, Health Passport, family care, trends and preventive-care workflows.",
  keywords: ["personal health management app", "Health Passport", "home vitals monitoring", "self-check health app", "medication reminders", "family care app", "remote patient monitoring trends", "Ambulant+ personal health management"],
  alternates: { canonical: absoluteUrl("/resources/personal-health-management") },
  openGraph: {
    title: "Personal Health Management Suite | Ambulant+ Resources",
    description: "Learn how to use Ambulant+ as a personal health management suite with reminders, self-checks, home vitals, Health Passport, family care, trends and preventive-care workflows.",
    url: absoluteUrl("/resources/personal-health-management"),
    siteName: site.name,
    images: [{ url: absoluteUrl("/og/ambulant-og.webp"), width: 1200, height: 630, alt: "Personal Health Management Suite | Ambulant+ Resources" }],
    locale: "en_ZA",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Personal Health Management Suite | Ambulant+ Resources",
    description: "Learn how to use Ambulant+ as a personal health management suite with reminders, self-checks, home vitals, Health Passport, family care, trends and preventive-care workflows.",
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
};

const heroBadges = ["Health Passport", "Home vitals", "Reminders", "Trends"];
const lifecycle = [{"step": "1", "title": "Profile", "body": "Keep your health profile accurate."}, {"step": "2", "title": "Track", "body": "Capture home vitals and self-checks."}, {"step": "3", "title": "Trend", "body": "Review changes over time, not isolated readings only."}, {"step": "4", "title": "Act", "body": "Use reminders and follow-up prompts to stay on plan."}];
const workflow = [{"title": "Health Passport", "body": "Use your protected health profile to organise identity details, conditions, medicines, allergies, consultation history and care context."}, {"title": "Reminders", "body": "Set reminders for medicines, self-checks, vitals, lab tasks, follow-ups and care-plan actions."}, {"title": "Self-checks", "body": "Record symptoms, wellness changes, recovery signals or concern prompts between formal consultations."}, {"title": "Home vitals", "body": "Use supported workflows for blood pressure, pulse, SpO₂, temperature, glucose, ECG or other configured readings."}, {"title": "Family care", "body": "Where enabled, manage family members, dependants or care responsibilities with consent-aware access."}, {"title": "Trends and prevention", "body": "Use longitudinal patterns to support earlier review, chronic-care monitoring, lifestyle conversations and preventive care."}];
const safety = ["Trends support care discussions but do not replace clinical review.", "A normal reading does not make severe symptoms safe.", "Repeated abnormal readings should prompt clinician review or urgent care depending on severity.", "Family access must respect consent, privacy and role permissions."];
const related = [{"href": "/patients", "label": "Patients"}, {"href": "/features#daily-health", "label": "Daily health features"}, {"href": "/resources/after-your-consultation", "label": "After your consultation"}];
const faqs = [{"question": "What is the Health Passport?", "answer": "The Health Passport is the patient’s organised health context, including profile, records, medicines, allergies, readings, care history and relevant continuity information."}, {"question": "Can Ambulant+ help with reminders?", "answer": "Yes. Ambulant+ can support reminders for medication, self-checks, vitals, lab tasks and follow-up actions where configured."}, {"question": "Is Ambulant+ only for appointments?", "answer": "No. Ambulant+ is designed for longitudinal personal health management, not just one-off video consultations."}];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "Personal Health Management Suite",
  description: "Learn how to use Ambulant+ as a personal health management suite with reminders, self-checks, home vitals, Health Passport, family care, trends and preventive-care workflows.",
  url: absoluteUrl("/resources/personal-health-management"),
  inLanguage: "en-ZA",
  publisher: { "@type": "Organization", name: site.name, url: site.url },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Resources", item: absoluteUrl("/resources") },
    { "@type": "ListItem", position: 3, name: "Personal Health Management Suite", item: absoluteUrl("/resources/personal-health-management") },
  ],
};

export default function Page() {
  return (
    <main>
      <Script id="article-jsonld" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <Script id="faq-jsonld" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="breadcrumb-jsonld" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[6%] top-[20%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.88fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Longitudinal care</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Personal Health Management Suite</h1>
            <p className="mt-6 text-lg leading-9 text-slate-600">Ambulant+ is not only for booking a once-off virtual consultation. It is a personal health management suite for organising your health profile, reminders, home vitals, self-checks, device trends, family care and follow-up over time.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {heroBadges.map((item) => (
                <span key={item} className="rounded-full border border-cyan-100 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-800 shadow-sm">{item}</span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/resources" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow">Back to resources <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/patients" className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800 shadow-sm">Patient workspace <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          <div className="glass-panel rounded-[36px] p-5 shadow-glow">
            <div className="rounded-[30px] bg-slate-950 p-6 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Patient lifecycle</div>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight">A guided care workflow, not a loose help article.</h2>
                </div>
                <Sparkles className="h-8 w-8 text-cyan-200" />
              </div>
              <div className="mt-7 grid gap-3">
                {lifecycle.map((item) => (
                  <div key={item.step} className="group rounded-3xl border border-white/10 bg-white/10 p-4 transition hover:bg-white/15">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-200 text-sm font-black text-slate-950">{item.step}</div>
                      <div>
                        <h3 className="font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{item.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell eyebrow="Workflow band" title="How to use Ambulant+ beyond the appointment" body="Follow this sequence to keep the Ambulant+ journey clear, safe and operationally complete.">
        <div className="relative grid gap-4 lg:grid-cols-3">
          {workflow.map((item, index) => (
            <div key={item.title} className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-sm font-black text-cyan-800">{index + 1}</div>
                <ClipboardCheck className="h-5 w-5 text-cyan-700" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-8 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="Safety and escalation" title="Remote care must never delay urgent care." body="Ambulant+ resources should support safe behaviour, not self-diagnosis or false reassurance.">
        <div className="grid gap-4 md:grid-cols-2">
          {safety.map((item) => (
            <div key={item} className="flex gap-4 rounded-[28px] border border-amber-200 bg-amber-50/80 p-5">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
              <p className="text-sm leading-7 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="Frequently asked questions" title="Clear answers for patients and AI search." body="These answers support patient education, search visibility and safer platform use.">
        <div className="grid gap-4 md:grid-cols-3">
          {faqs.map((item) => (
            <div key={item.question} className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-6">
              <BadgeCheck className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">{item.question}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell eyebrow="Related resources" title="Continue the patient operations pathway." body="Use these connected resources to keep the patient journey coherent across access, appointment preparation, care continuity, fulfilment and diagnostics.">
        <div className="grid gap-4 md:grid-cols-3">
          {related.map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow">
              <HeartPulse className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.label}</h3>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">Open resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6"><CTA /></section>
    </main>
  );
}
