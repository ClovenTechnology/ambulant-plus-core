import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Globe2,
  HeartPulse,
  Mail,
  Newspaper,
  Pill,
  Quote,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  Users,
  Watch,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Media & Press | Ambulant+ Contactless Medicine",
  description:
    "Official Ambulant+ media and press page with company boilerplate, Contactless Medicine definition, product modules, approved positioning, media contacts, logos, resources and story angles for journalists, partners and publishers.",
  keywords: [
    "Ambulant+ media",
    "Ambulant+ press",
    "Contactless Medicine press",
    "Contactless Medicine media kit",
    "Ambulant+ media kit",
    "Cloven Technology Ambulant+",
    "South Africa digital health startup",
    "South Africa MedTech",
    "remote patient monitoring media",
    "telemedicine South Africa press",
    "IoMT healthcare South Africa",
    "NexRing press",
    "CarePort press",
    "MedReach press",
    "InsightCore press",
    "digital health media kit",
    "healthtech press South Africa",
  ],
  alternates: {
    canonical: absoluteUrl("/media"),
  },
  openGraph: {
    title: "Media & Press | Ambulant+ Contactless Medicine",
    description:
      "Official media page for Ambulant+, the Contactless Medicine ecosystem by Cloven Technology combining virtual care, connected medical devices, remote monitoring, home diagnostics, pharmacy fulfilment and programme intelligence.",
    url: absoluteUrl("/media"),
    siteName: site.name,
    images: [
      {
        url: absoluteUrl("/og/ambulant-og.webp"),
        width: 1200,
        height: 630,
        alt: "Ambulant+ Contactless Medicine media kit",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Media & Press | Ambulant+ Contactless Medicine",
    description:
      "Official media and press resources for Ambulant+ Contactless Medicine.",
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
};

const keyFacts = [
  {
    label: "Company",
    value: "Cloven Technology Impilo",
  },
  {
    label: "Product",
    value: "Ambulant+",
  },
  {
    label: "Category",
    value: "Contactless Medicine",
  },
  {
    label: "Primary market",
    value: "South Africa",
  },
  {
    label: "Global expansion model",
    value: "Country-specific domains and country-operator pathways",
  },
  {
    label: "Official South Africa site",
    value: "ambulantplus.co.za",
  },
];

const boilerplates = [
  {
    title: "One-line description",
    body:
      "Ambulant+ is a clinician-led Contactless Medicine platform by Cloven Technology that combines virtual care, connected medical devices, remote monitoring, home diagnostics, pharmacy fulfilment and governance-aware health intelligence.",
  },
  {
    title: "Short boilerplate",
    body:
      "Ambulant+ is a South African Contactless Medicine and Personal Health Management platform developed by Cloven Technology. It connects patients, clinicians, supported IoMT devices, MedReach diagnostics, CarePort medicine fulfilment and InsightCore programme intelligence into one governed digital health ecosystem.",
  },
  {
    title: "Full boilerplate",
    body:
      "Ambulant+ is a Contactless Medicine ecosystem developed by Cloven Technology to move healthcare beyond ordinary video-only telemedicine. The platform brings together clinician-led virtual consultation, connected medical devices, remote patient monitoring, continuous vitals, home diagnostics, pharmacy fulfilment, medication adherence support, predictive care signals, precision-care pathways and governance-aware programme intelligence. Ambulant+ is designed for patients, clinicians, medical aids, employers, laboratories, pharmacies, riders, phlebotomists and enterprise care programmes that need safer, more connected and more operationally accountable remote healthcare.",
  },
];

const approvedDefinitions = [
  {
    title: "Contactless Medicine",
    body:
      "Contactless Medicine is clinician-led remote care supported by connected medical devices, structured patient context, home diagnostics, medicine fulfilment, adherence workflows and governance-aware intelligence.",
  },
  {
    title: "Beyond telemedicine",
    body:
      "Telemedicine connects people remotely. Contactless Medicine connects the care workflow remotely — including consultation, vitals, diagnostics, prescriptions, adherence, documentation, escalation and programme visibility.",
  },
  {
    title: "Predictive and precision-care positioning",
    body:
      "Ambulant+ supports predictive care signals and precision-care pathways by organising longitudinal vitals, wearable context, adherence trends, diagnostic workflows and clinician-led review around each patient. These insights support care decisions but do not replace clinician judgement.",
  },
];

const ecosystemModules = [
  {
    title: "Ambulant+",
    label: "Contactless Medicine platform",
    body:
      "Patient and clinician workspaces for virtual care, doctor booking, medical records, care centres, supported devices and governed care workflows.",
    icon: HeartPulse,
    href: "/platform",
  },
  {
    title: "MedReach",
    label: "Diagnostics operations",
    body:
      "Home phlebotomy, specimen collection, laboratory handover, result-routing and diagnostic workflow coordination.",
    icon: TestTube2,
    href: "/medreach",
  },
  {
    title: "CarePort",
    label: "Pharmacy fulfilment",
    body:
      "eRx fulfilment, pharmacy readiness, medicine delivery, rider dispatch, proof-of-delivery and medication-continuity workflows.",
    icon: Pill,
    href: "/careport",
  },
  {
    title: "InsightCore",
    label: "Programme intelligence",
    body:
      "Governance-aware analytics for remote monitoring, adherence, risk movement, predictive care signals and enterprise programme visibility.",
    icon: Sparkles,
    href: "/insightcore",
  },
  {
    title: "Supported devices",
    label: "IoMT clinical context",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows for vitals, auscultation, imaging and longitudinal wellness context.",
    icon: Watch,
    href: "/devices",
  },
  {
    title: "Care centres",
    label: "Population pathways",
    body:
      "Ladies’ Health, Paediatric, Antenatal and Gentlemen’s Health pathways for focused care and prevention-oriented patient support.",
    icon: Users,
    href: "/features",
  },
];

const storyAngles = [
  "How Contactless Medicine moves healthcare beyond ordinary telemedicine.",
  "Why South Africa can become a serious launch market for connected remote care.",
  "How IoMT devices improve virtual consultations with vitals, auscultation and imaging context.",
  "Why medical aids and employers should invest in preventive remote monitoring.",
  "How CarePort and MedReach close the gaps after virtual consultation.",
  "Why Contactless Medicine matters during future pandemics and infectious-disease disruption.",
  "How remote care can reduce travel, waiting-room exposure and urban-rural healthcare inequality.",
  "How predictive care signals and precision-care pathways can support earlier intervention without replacing clinicians.",
];

const mediaAssets = [
  {
    title: "Primary logo",
    body: "Full Ambulant+ brand logo for approved media use.",
    href: "/brand/ambulant-logo-full.png",
  },
  {
    title: "High-resolution logo",
    body: "Higher-resolution Ambulant+ logo asset.",
    href: "/brand/ambulant-logo-full@2x.png",
  },
  {
    title: "Brand mark",
    body: "Ambulant+ icon mark for approved use.",
    href: "/brand/ambulant-mark.png",
  },
  {
    title: "Open Graph image",
    body: "Standard preview image for articles, social posts and publication cards.",
    href: "/og/ambulant-og.webp",
  },
];

const positioningBoundaries = [
  "Ambulant+ is not an emergency service.",
  "Ambulant+ does not replace clinician judgement.",
  "Connected devices support clinical context; they do not automatically diagnose patients.",
  "Predictive care signals and InsightCore intelligence should be described as support layers, not autonomous diagnosis.",
  "Device availability, regulatory status and certification claims should only be stated where verified by official documentation.",
  "Country expansion, operator rights and launch timelines may depend on regulatory, commercial, safety and implementation readiness.",
];

const approvedLinks = [
  {
    title: "What Is Contactless Medicine?",
    href: "/blog/what-is-contactless-medicine",
  },
  {
    title: "Contactless Medicine vs Telemedicine",
    href: "/blog/contactless-medicine-vs-telemedicine",
  },
  {
    title: "Remote Monitoring for Medical Aids",
    href: "/blog/remote-monitoring-for-medical-aids",
  },
  {
    title: "Pandemic Resilience",
    href: "/blog/contactless-medicine-pandemic-resilience",
  },
  {
    title: "Pricing Architecture",
    href: "/pricing",
  },
  {
    title: "Resources",
    href: "/resources",
  },
];

const faqs = [
  {
    question: "What is Ambulant+?",
    answer:
      "Ambulant+ is a Contactless Medicine and Personal Health Management platform by Cloven Technology. It combines clinician-led virtual care, connected medical devices, remote patient monitoring, home diagnostics, medicine fulfilment and governance-aware health intelligence.",
  },
  {
    question: "Is Ambulant+ the same as telemedicine?",
    answer:
      "No. Telemedicine is usually communication-first. Ambulant+ positions Contactless Medicine as care-workflow-first, adding connected devices, diagnostics, fulfilment, adherence and programme intelligence around virtual care.",
  },
  {
    question: "Can journalists use Ambulant+ logos?",
    answer:
      "Media may use the official logo and mark when referencing Ambulant+ accurately and without implying endorsement, partnership, regulatory approval or clinical claims not confirmed by the company.",
  },
  {
    question: "Who should media contact?",
    answer:
      `Media, partnership and publication enquiries can be routed through ${site.salesEmail || site.supportEmail}.`,
  },
];

const mediaJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Media & Press | Ambulant+",
  url: absoluteUrl("/media"),
  description: metadata.description,
  inLanguage: "en-ZA",
  publisher: {
    "@type": "Organization",
    name: "Ambulant+",
    url: site.url,
    logo: absoluteUrl("/brand/ambulant-logo-full.png"),
  },
  about: [
    "Contactless Medicine",
    "remote patient monitoring",
    "telemedicine",
    "IoMT",
    "digital health",
    "MedReach",
    "CarePort",
    "InsightCore",
    "NexRing",
    "medical aid preventive care",
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ambulant+",
  legalName: "Cloven Technology Impilo",
  url: site.url,
  logo: absoluteUrl("/brand/ambulant-logo-full.png"),
  image: absoluteUrl("/og/ambulant-og.webp"),
  slogan: "Contactless Medicine",
  description:
    "Ambulant+ is a Contactless Medicine ecosystem by Cloven Technology, connecting patients, clinicians, supported medical devices, MedReach diagnostics, CarePort fulfilment and InsightCore intelligence.",
  brand: {
    "@type": "Brand",
    name: "Ambulant+",
  },
  sameAs: [
    "https://ambulantplus.co.za/",
    "https://cloventechnology.com/",
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Media & Press",
      item: absoluteUrl("/media"),
    },
  ],
};

export default function MediaPage() {
  return (
    <main>
      <Script
        id="media-webpage-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mediaJsonLd) }}
      />
      <Script
        id="media-organization-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <Script
        id="media-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="media-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              <Newspaper className="h-4 w-4" />
              Media & Press
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
              The official Ambulant+ media authority page.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ is a South African Contactless Medicine ecosystem built by
              Cloven Technology to move remote care beyond ordinary telemedicine.
              This page gives journalists, partners, publishers and AI-search systems
              the approved language, facts, links and positioning needed to describe
              Ambulant+ accurately.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`mailto:${site.salesEmail || site.supportEmail}?subject=Ambulant+ media enquiry`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Contact media team <Mail className="h-4 w-4" />
              </a>

              <Link
                href="/blog/what-is-contactless-medicine"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Read category definition <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
              Approved category position
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Contactless Medicine beyond telemedicine.
            </h2>
            <p className="mt-5 text-sm leading-8 text-slate-300 md:text-base">
              Ambulant+ should be described as clinician-led remote care supported
              by connected devices, diagnostics, medication fulfilment, adherence
              workflows and governance-aware intelligence — not as a simple video
              consultation app.
            </p>

            <div className="mt-6 grid gap-3">
              {keyFacts.map((fact) => (
                <div key={fact.label} className="rounded-2xl bg-white/10 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                    {fact.label}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-100">
                    {fact.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Approved boilerplate"
        title="Use these descriptions when writing about Ambulant+."
        body="These are publication-ready descriptions for journalists, partner websites, company profiles, event listings, podcast notes and press articles."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {boilerplates.map((item) => (
            <div key={item.title} className="glass-panel rounded-[30px] p-6">
              <FileText className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-4 text-sm leading-8 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Category definition"
        title="How to describe Contactless Medicine."
        body="Ambulant+ is building a category, not merely launching another healthcare app. These definitions help keep the category accurate and defensible."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {approvedDefinitions.map((item) => (
            <div key={item.title} className="rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-6">
              <BookOpenText className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-4 text-sm leading-8 text-slate-700">{item.body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Ecosystem modules"
        title="Ambulant+ is a connected care operating system."
        body="The media story should show the full ecosystem: patient access, clinician workflows, supported devices, diagnostics, pharmacy fulfilment and programme intelligence."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ecosystemModules.map(({ title, label, body, icon: Icon, href }) => (
            <Link
              key={title}
              href={href}
              className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
            >
              <Icon className="h-7 w-7 text-cyan-700" />
              <div className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                {label}
              </div>
              <h3 className="mt-3 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Explore <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="rounded-[36px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Story angles
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Strong angles for journalists and publishers.
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300 md:text-base">
                These angles help external writers understand why Ambulant+ matters
                beyond product announcement language.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {storyAngles.map((angle) => (
                <div key={angle} className="rounded-2xl bg-white/10 p-4">
                  <Quote className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{angle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Media assets"
        title="Approved brand assets."
        body="Use these public assets when referencing Ambulant+ accurately. Do not alter, distort, recolour or use the assets to imply endorsement, regulatory approval or partnership unless agreed in writing."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {mediaAssets.map((asset) => (
            <a
              key={asset.title}
              href={asset.href}
              target="_blank"
              rel="noreferrer"
              className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
            >
              <Download className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">{asset.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{asset.body}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Open asset <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </a>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Positioning boundaries"
        title="What not to overclaim."
        body="Healthcare media must remain accurate. These boundaries protect patients, clinicians, partners and the Ambulant+ brand."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {positioningBoundaries.map((item) => (
            <div key={item} className="rounded-[28px] border border-white/80 bg-white/85 p-5 shadow-sm">
              <ShieldCheck className="h-6 w-6 text-cyan-700" />
              <p className="mt-4 text-sm leading-8 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Approved reference links"
        title="Start with these pages when linking to Ambulant+."
        body="These URLs help external publications, backlink partners and AI-search systems cite the right source for the right claim."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {approvedLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-glow"
            >
              <Globe2 className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
              <div className="mt-3 text-sm font-semibold text-cyan-700">{item.href}</div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Open page <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Media FAQ"
        title="Quick answers for writers."
        body="Use these answers to reduce ambiguity when preparing external stories, backlink articles, publication profiles or company listings."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="glass-panel rounded-[30px] p-6">
              <h3 className="text-lg font-semibold text-slate-950">{faq.question}</h3>
              <p className="mt-3 text-sm leading-8 text-slate-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="mb-8 rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <Mail className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Media, partnership or publication enquiry?
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-600 md:text-base">
            For media interviews, founder quotes, partner articles, backlink
            coordination, launch announcements, event invitations or publication
            verification, contact the Ambulant+ team using the approved enquiry route.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${site.salesEmail || site.supportEmail}?subject=Ambulant+ media enquiry`}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Email media team <Mail className="h-4 w-4" />
            </a>

            <Link
              href="/contact?type=media"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              Use contact form <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <CTA />
      </section>
    </main>
  );
}