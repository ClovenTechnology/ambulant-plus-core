
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
  title: "After Your Consultation | Ambulant+ Resources",
  description: "Understand Ambulant+ post-consultation workflows including treatment plans, session summaries, CarePort eRx fulfilment, MedReach lab orders, reminders, adherence and follow-up booking.",
  keywords: ["after virtual consultation", "Ambulant+ treatment plan", "CarePort eRx", "MedReach lab orders", "book follow-up doctor", "medicine delivery after consultation", "remote care follow-up", "Contactless Medicine continuity"],
  alternates: { canonical: absoluteUrl("/resources/after-your-consultation") },
  openGraph: {
    title: "After Your Consultation | Ambulant+ Resources",
    description: "Understand Ambulant+ post-consultation workflows including treatment plans, session summaries, CarePort eRx fulfilment, MedReach lab orders, reminders, adherence and follow-up booking.",
    url: absoluteUrl("/resources/after-your-consultation"),
    siteName: site.name,
    images: [{ url: absoluteUrl("/og/ambulant-og.webp"), width: 1200, height: 630, alt: "After Your Consultation | Ambulant+ Resources" }],
    locale: "en_ZA",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "After Your Consultation | Ambulant+ Resources",
    description: "Understand Ambulant+ post-consultation workflows including treatment plans, session summaries, CarePort eRx fulfilment, MedReach lab orders, reminders, adherence and follow-up booking.",
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
};

const heroBadges = ["Treatment plan", "CarePort eRx", "MedReach orders", "Follow-up"];
const lifecycle = [{"step": "1", "title": "Review", "body": "Read the session summary and treatment plan."}, {"step": "2", "title": "Fulfil", "body": "Use CarePort where prescriptions are routed for pharmacy fulfilment."}, {"step": "3", "title": "Test", "body": "Use MedReach where lab orders or home blood draws are requested."}, {"step": "4", "title": "Follow up", "body": "Book with the same clinician or another suitable clinician."}];
const workflow = [{"title": "Session summary", "body": "Review the consultation summary, clinician instructions, medication changes, warning signs and next steps."}, {"title": "Treatment plan", "body": "Follow the treatment plan exactly, including dose timing, self-care advice, monitoring instructions and review dates."}, {"title": "CarePort eRx", "body": "Where enabled, prescriptions can move into CarePort for pharmacy fulfilment, preparation, delivery tracking and proof-of-delivery."}, {"title": "MedReach lab orders", "body": "Where testing is needed, MedReach can coordinate home blood draws, specimen handover, laboratory processing and result routing."}, {"title": "Reminders and adherence", "body": "Use reminders for medicines, readings, self-checks, investigations and follow-up tasks."}, {"title": "Follow-up booking", "body": "Book the same clinician for continuity where possible, or choose another clinician if availability, specialty or urgency requires it."}];
const safety = ["Seek urgent care if symptoms worsen, new red flags appear or the clinician advised escalation.", "Do not stop prescribed medication unless a clinician tells you to, except where severe allergy or emergency advice applies.", "Delayed pharmacy fulfilment or missed lab tests can weaken care continuity; act early if you cannot complete a task.", "Ambulant+ does not replace emergency services."];
const related = [{"href": "/resources/careport-patient-guide", "label": "CarePort patient guide"}, {"href": "/resources/medreach-patient-guide", "label": "MedReach patient guide"}, {"href": "/resources/personal-health-management", "label": "Personal health management"}];
const faqs = [{"question": "What happens after my Ambulant+ consultation?", "answer": "You should review your treatment plan, prescriptions, lab requests, reminders and follow-up instructions. CarePort and MedReach may support pharmacy and diagnostic workflows where enabled."}, {"question": "Can I book the same clinician again?", "answer": "Yes, where the clinician is available. Same-clinician follow-up supports continuity, but another suitable clinician can be selected if needed."}, {"question": "How do CarePort and MedReach fit after the session?", "answer": "CarePort supports eRx and medicine fulfilment. MedReach supports laboratory and home-diagnostics workflows."}];

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
  headline: "After Your Consultation",
  description: "Understand Ambulant+ post-consultation workflows including treatment plans, session summaries, CarePort eRx fulfilment, MedReach lab orders, reminders, adherence and follow-up booking.",
  url: absoluteUrl("/resources/after-your-consultation"),
  inLanguage: "en-ZA",
  publisher: { "@type": "Organization", name: site.name, url: site.url },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
    { "@type": "ListItem", position: 2, name: "Resources", item: absoluteUrl("/resources") },
    { "@type": "ListItem", position: 3, name: "After Your Consultation", item: absoluteUrl("/resources/after-your-consultation") },
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
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Care continuity</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">After Your Consultation</h1>
            <p className="mt-6 text-lg leading-9 text-slate-600">The consultation is only one part of care. Ambulant+ is designed to help patients continue safely after the session through treatment plans, reminders, eRx fulfilment, MedReach diagnostics, CarePort medicine continuity and follow-up booking.</p>
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

      <SectionShell eyebrow="Workflow band" title="The post-consultation care loop" body="Follow this sequence to keep the Ambulant+ journey clear, safe and operationally complete.">
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
