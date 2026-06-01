import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  Activity,
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  Pill,
  Plane,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  TestTube2,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import ProductCard from "@/components/ProductCard";
import SectionShell from "@/components/SectionShell";
import ComplianceBadge from "@/components/ComplianceBadge";
import ImageStoryBand from "@/components/ImageStoryBand";
import { productRoutes, trustPillars } from "@/lib/routes";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title:
    "Ambulant+ South Africa | Contactless Medicine Beyond Telemedicine, Remote Monitoring and Precision Care",
  description:
    "Ambulant+ is a Contactless Medicine and Personal Health Management platform by Cloven Technology, combining clinician-led virtual care, connected medical devices, remote patient monitoring, continuous vitals, home diagnostics, pharmacy fulfilment, predictive care signals, precision medicine pathways, medical-aid programme visibility and governance-aware health intelligence.",
  keywords: [
    "Ambulant+",
    "Ambulant Plus",
    "Contactless Medicine",
    "Contactless Medicine South Africa",
    "contactless healthcare",
    "zero contact care",
    "beyond telemedicine",
    "telemedicine South Africa",
    "telehealth South Africa",
    "virtual doctor consultation South Africa",
    "online doctor South Africa",
    "find a doctor online",
    "remote patient monitoring South Africa",
    "continuous remote monitoring",
    "remote monitoring",
    "remote vitals monitoring",
    "continuous vitals monitoring",
    "connected medical devices",
    "integrated medical hardware",
    "IoMT healthcare",
    "Internet of Medical Things",
    "home diagnostics",
    "home phlebotomy",
    "digital stethoscope",
    "digital auscultation",
    "HD otoscope",
    "Health Monitor",
    "NexRing",
    "pharmacy delivery South Africa",
    "medicine delivery",
    "CarePort",
    "MedReach",
    "InsightCore",
    "medical aid wellness platform",
    "medical aid preventive care",
    "corporate wellness platform",
    "preventive healthcare",
    "predictive care",
    "precision medicine",
    "precision care",
    "chronic disease monitoring",
    "fertility monitoring",
    "primary care",
    "instant care",
    "virtual care",
    "digital health South Africa",
    "Cloven Technology",
  ],
  alternates: {
    canonical: "https://ambulantplus.co.za/",
  },
  openGraph: {
    title: "Ambulant+ South Africa | Contactless Medicine Beyond Telemedicine",
    description:
      "Clinician-led virtual care, connected medical devices, remote patient monitoring, continuous vitals, home diagnostics, pharmacy fulfilment, predictive care signals, care pods and payer-facing programme intelligence in one governed platform.",
    url: "https://ambulantplus.co.za/",
    siteName: "Ambulant+",
    images: [
      {
        url: "https://ambulantplus.co.za/og/ambulant-og.webp",
        width: 1200,
        height: 630,
        alt: "Ambulant+ Contactless Medicine platform",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ambulant+ South Africa | Contactless Medicine Beyond Telemedicine",
    description:
      "Device-supported virtual care, home diagnostics, pharmacy fulfilment, predictive care signals, care pods and programme intelligence for patients, clinicians, partners and medical aids.",
    images: ["https://ambulantplus.co.za/og/ambulant-og.webp"],
  },
};

const heroValueCards = [
  {
    title: "Beyond ordinary telemedicine",
    body:
      "Ambulant+ adds clinical device context, diagnostics workflows, medicine fulfilment and structured care intelligence around virtual consultation.",
  },
  {
    title: "Predictive and prevention-focused",
    body:
      "Longitudinal vitals, adherence trends, wearable signals and care-pathway data can support earlier intervention and preventive care.",
  },
  {
    title: "Precision-care pathways",
    body:
      "Care can be organised around each patient’s context, device readings, diagnostic needs, medication journey and authorised programme visibility.",
  },
  {
    title: "Governance-aware by design",
    body:
      "Role boundaries, consent-aware data sharing, auditability and careful clinical language are built into the public and protected experience.",
  },
];

const telemedicineGaps = [
  {
    title: "Video alone cannot measure the patient",
    body:
      "Many remote consultations still depend on symptoms alone. Ambulant+ adds supported device pathways for vitals, auscultation, otoscopy and longitudinal monitoring where clinically appropriate.",
    icon: Activity,
  },
  {
    title: "Access without continuity is fragile",
    body:
      "A one-off call may not solve chronic-care gaps. Ambulant+ connects consultation, monitoring, diagnostics, medication fulfilment and follow-up visibility.",
    icon: HeartPulse,
  },
  {
    title: "Care fails when the last mile is missing",
    body:
      "Patients may still struggle with laboratory access, pharmacy collection, medication adherence or transport. MedReach and CarePort help close those operational gaps.",
    icon: Pill,
  },
  {
    title: "Payers need prevention, not just utilisation",
    body:
      "Medical aids, HMOs and sponsors need earlier risk signals, adherence visibility and programme intelligence before avoidable deterioration becomes expensive care.",
    icon: TrendingUp,
  },
];

const consultationModel = [
  "Health Monitor supports blood pressure, SpO₂, temperature, glucose, heart-rate and ECG workflows.",
  "Digital Stethoscope and HD Otoscope add auscultation and imaging context to clinician-led virtual review.",
  "NexRing supports longitudinal signals, readiness trends and fertility-relevant temperature variation against individual baselines.",
  "InsightCore layers adherence trends, care-pathway visibility, regression-risk signals, predictive care signals and programme intelligence around the care journey.",
];

const pathwaySteps = [
  {
    letter: "A",
    title: "Access the right route",
    body:
      "Patients, clinicians, sponsors, pharmacies and diagnostic teams enter through role-specific workspaces with clear boundaries.",
  },
  {
    letter: "B",
    title: "Book, connect and prepare",
    body:
      "Patients can browse available clinicians, choose a suitable time, connect supported devices and prepare care context before review.",
  },
  {
    letter: "C",
    title: "Complete the care loop",
    body:
      "Consultation, device context, diagnostics, eRx fulfilment, adherence reminders, summary notes and programme visibility are connected.",
  },
];

const stakeholderCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Patients and families",
    body:
      "Convenient access to clinician-led care, remote monitoring, reminders, device-supported reviews and medication fulfilment.",
    icon: Smartphone,
  },
  {
    title: "Clinicians",
    body:
      "A governed remote-work model with structured patient context, device pathways, documentation and escalation boundaries.",
    icon: Stethoscope,
  },
  {
    title: "Medical aids and sponsors",
    body:
      "Preventive-care visibility, member engagement, adherence signals, claims-ready care events and programme intelligence.",
    icon: Users,
  },
  {
    title: "Pharmacies and diagnostics teams",
    body:
      "CarePort and MedReach organise fulfilment, home draws, specimen handling, laboratory coordination and operational traceability.",
    icon: Pill,
  },
];

const payerEconomics = [
  "Earlier intervention before chronic disease deterioration becomes high-cost care.",
  "Remote vitals, continuous monitoring and longitudinal trends for authorised care programmes.",
  "Medication adherence signals, reminders, eRx continuity and pharmacy fulfilment visibility.",
  "Home diagnostics and phlebotomy workflows that reduce missed testing and delayed review.",
  "Member engagement pathways for preventive care, fertility support, family health and chronic treatment support.",
  "Claims-ready care events and programme-level visibility where consent and scheme rules allow.",
];

const podRolloutLocations = [
  "O.R. Tambo International Airport",
  "Cape Town International Airport",
  "King Shaka International Airport",
  "Mall of Africa",
  "Sandton City",
  "Fourways Mall",
  "Eastgate Mall",
  "V&A Waterfront",
];

const insightArticles = [
  {
    title: "What Is Contactless Medicine?",
    body:
      "The core definition of Contactless Medicine and how it moves beyond ordinary video-only telemedicine.",
    href: "/blog/what-is-contactless-medicine",
  },
  {
    title: "Contactless Medicine vs Telemedicine",
    body:
      "Why device-supported virtual care creates a stronger model than traditional telemedicine alone.",
    href: "/blog/contactless-medicine-vs-telemedicine",
  },
  {
    title: "Remote Monitoring for Medical Aids",
    body:
      "How medical aids, HMOs and sponsors can use remote monitoring to support preventive care.",
    href: "/blog/remote-monitoring-for-medical-aids",
  },
  {
    title: "Pandemic Resilience and Contactless Medicine",
    body:
      "Why Contactless Medicine matters when infectious threats require isolation without cutting off care.",
    href: "/blog/contactless-medicine-pandemic-resilience",
  },
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
      "InsightCore supports adherence trends, regression-risk signals, predictive care signals, precision-care pathways and programme visibility with governance boundaries.",
    icon: BrainCircuit,
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://ambulantplus.co.za/#organization",
      name: "Ambulant+",
      legalName: "Cloven Technology Impilo",
      url: "https://ambulantplus.co.za/",
      logo: "https://ambulantplus.co.za/brand/ambulant-logo-full.png",
      brand: {
        "@type": "Brand",
        name: "Ambulant+",
        slogan: "Contactless Medicine",
      },
      parentOrganization: {
        "@type": "Organization",
        name: "Cloven Technology",
        url: "https://cloventechnology.com/",
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+27 69 669 0899",
          contactType: "customer support",
          areaServed: "ZA",
          availableLanguage: ["English"],
        },
      ],
      sameAs: [
        "https://ambulantplus.co.za/",
        "https://cloventechnology.com/",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://ambulantplus.co.za/#software",
      name: "Ambulant+",
      applicationCategory: "HealthApplication",
      operatingSystem: "Web, iOS, Android",
      url: "https://ambulantplus.co.za/",
      description:
        "Ambulant+ is a Contactless Medicine platform combining clinician-led virtual care, connected medical devices, remote patient monitoring, continuous vitals, home diagnostics, pharmacy fulfilment, predictive care signals, care pods and programme intelligence.",
      publisher: {
        "@id": "https://ambulantplus.co.za/#organization",
      },
      offers: {
        "@type": "Offer",
        availability: "https://schema.org/OnlineOnly",
        category: "Digital health platform",
      },
      featureList: [
        "Clinician-led virtual consultation",
        "Remote patient monitoring",
        "Continuous vitals monitoring",
        "Connected medical devices",
        "Home diagnostics",
        "Home phlebotomy",
        "Digital auscultation",
        "HD otoscopy",
        "Pharmacy fulfilment",
        "Medication adherence support",
        "Predictive care signals",
        "Precision-care pathways",
        "Medical-aid programme visibility",
        "Governance-aware health intelligence",
      ],
    },
    {
      "@type": "MedicalBusiness",
      "@id": "https://ambulantplus.co.za/#medicalbusiness",
      name: "Ambulant+ Contactless Medicine",
      url: "https://ambulantplus.co.za/",
      description:
        "Contactless Medicine infrastructure for clinician-led virtual care, connected devices, remote monitoring, home diagnostics, medication fulfilment, care pods, predictive care signals, precision-care pathways and preventive-care programme visibility.",
      medicalSpecialty: [
        "PrimaryCare",
        "Cardiovascular",
        "Endocrine",
        "Obstetric",
        "Pediatric",
      ],
      areaServed: {
        "@type": "Country",
        name: "South Africa",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://ambulantplus.co.za/#homepage-faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Ambulant+?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Ambulant+ is a Contactless Medicine and Personal Health Management platform by Cloven Technology. It combines clinician-led virtual consultation, connected medical devices, remote patient monitoring, home diagnostics, pharmacy fulfilment, care pods, predictive care signals and programme intelligence in one governed ecosystem.",
          },
        },
        {
          "@type": "Question",
          name: "How is Ambulant+ different from ordinary telemedicine?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Ordinary telemedicine is often video-first. Ambulant+ is built around device-supported clinical context, remote monitoring, continuous vitals, home diagnostics, medication fulfilment, care-pathway visibility and governance-aware intelligence.",
          },
        },
        {
          "@type": "Question",
          name: "Does Ambulant+ support predictive care and precision medicine?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Ambulant+ supports predictive care signals and precision-care pathways by organising longitudinal vitals, adherence trends, wearable context, diagnostic workflows and clinician-led review around each patient. These insights support care decisions but do not replace clinician judgement.",
          },
        },
        {
          "@type": "Question",
          name: "Who is Ambulant+ built for?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "Ambulant+ is built for patients, clinicians, pharmacies, diagnostic teams, medical aids, corporate sponsors, care programmes and administrators who need governed digital health workflows.",
          },
        },
        {
          "@type": "Question",
          name: "Does Ambulant+ replace emergency services?",
          acceptedAnswer: {
            "@type": "Answer",
            text:
              "No. Ambulant+ is not an emergency service and does not replace emergency medical care, in-person clinical assessment where required, or clinician judgement.",
          },
        },
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <main>
      <Script
        id="ambulant-home-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative isolate overflow-hidden px-4 py-12 md:px-6 md:py-16 lg:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              <ShieldCheck className="h-4 w-4" />
              Welcome to Ambulant+ South Africa
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-5xl lg:text-[4rem] lg:leading-[0.96]">
              Contactless Medicine beyond ordinary telemedicine.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ is a Contactless Medicine and Personal Health Management
              platform by Cloven Technology, combining clinician-led virtual care,
              connected medical devices, remote patient monitoring, continuous vitals,
              home diagnostics, pharmacy fulfilment, predictive care signals,
              precision-care pathways, medical-aid programme visibility and
              governance-aware health intelligence.
            </p>

            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              It is built to give remote care teams structured patient context,
              device-supported observations, diagnostic workflows, adherence visibility
              and operational follow-through — without replacing emergency care,
              in-person examination where required or professional clinical judgement.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.patientAppUrl}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Access Patient App <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                href="/bookings"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Find a doctor <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Book a walkthrough <ArrowRight className="h-4 w-4" />
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

          <div className="glass-panel rounded-[42px] p-3 md:p-4">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-slate-950 shadow-2xl">
              <Image
                src="/visuals/home/ambulant-care-command-ecosystem.webp"
                alt="Ambulant+ platform command ecosystem showing patient app, clinician workspace, connected devices, diagnostics, CarePort and InsightCore"
                width={2400}
                height={1350}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Why this matters now"
        title="Telemedicine solved distance. It did not fully solve clinical context."
        body="Ambulant+ is built around the next problem: how to deliver remote care with useful observations, diagnostics, medicine continuity, preventive intelligence and governance boundaries."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {telemedicineGaps.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[34px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

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

      <SectionShell
        eyebrow="How care begins"
        title="Consulting through Ambulant+ is designed to be as simple as A–B–C."
        body="The patient experience should feel simple, while the platform quietly preserves clinical context, consent, fulfilment and governance behind the scenes."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {pathwaySteps.map((step) => (
            <div key={step.letter} className="glass-panel rounded-[34px] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
                {step.letter}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-slate-950">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </SectionShell>

      <ImageStoryBand
        eyebrow="IoMT-integrated consultation"
        title="Virtual consultation with clinical context, not video alone."
        body="Ambulant+ brings the four supported Contactless Medicine device pathways into clinician-led virtual care, then surrounds that care with InsightCore intelligence, MedReach diagnostics and CarePort medicine fulfilment."
        imageSrc="/visuals/home/home-monitoring-clinician-review.webp"
        imageAlt="Patient using connected monitoring device during clinician-led virtual consultation"
        imageSide="right"
        imagePosition="center"
        ctaLabel="Explore devices"
        ctaHref="/devices"
        points={consultationModel}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="overflow-hidden rounded-[42px] bg-slate-950 shadow-2xl">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="p-8 text-white md:p-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                <Activity className="h-4 w-4" />
                Complete care loop
              </div>
              <h2 className="mt-6 max-w-xl text-3xl font-semibold tracking-[-0.045em] md:text-5xl">
                From consultation to diagnostics, medicines and monitoring.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Ambulant+ is structured so that a virtual review can connect to
                device-supported observations, home diagnostic workflows, eRx-aware
                pharmacy fulfilment, adherence reminders, care summaries, predictive
                care signals and programme intelligence where authorised.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {["Consult", "Measure", "Diagnose", "Fulfil"].map((item) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-white/10 bg-white/10 p-4 text-sm font-semibold text-white"
                  >
                    <CheckCircle2 className="mb-3 h-5 w-5 text-cyan-200" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[320px]">
              <Image
                src="/visuals/features/live-iomt-consultation.webp"
                alt="Live IoMT-supported virtual consultation with connected devices"
                width={2400}
                height={1350}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

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
        eyebrow="Medical aids, HMOs and sponsors"
        title="For payers, prevention is not a slogan. It is risk control."
        body="Ambulant+ helps payer and sponsor programmes move from passive coverage to earlier intervention, remote monitoring, adherence support and authorised programme visibility."
      >
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="glass-panel rounded-[34px] p-6">
            <Building2 className="h-8 w-8 text-cyan-700" />
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
              Avoidable complications are where costs become difficult to recover.
            </h3>
            <p className="mt-4 text-sm leading-8 text-slate-600">
              When chronic-care deterioration is detected late, payers often face high-cost
              claims from preventable or delay-sensitive complications. Ambulant+ supports
              preventive-care programmes with remote monitoring, medication continuity,
              home diagnostics and care-pathway intelligence.
            </p>
            <Link
              href="/clients"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Explore payer programmes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {payerEconomics.map((item) => (
              <div key={item} className="rounded-3xl border border-cyan-100 bg-cyan-50/70 p-5">
                <CheckCircle2 className="h-5 w-5 text-cyan-700" />
                <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Who Ambulant+ serves"
        title="Built for patients, clinicians, payers and care operators."
        body="The platform is designed to keep each stakeholder inside the right workspace, with the right level of visibility, rather than collapsing everyone into one unsafe interface."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stakeholderCards.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[34px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
              <Building2 className="h-4 w-4" />
              Future access infrastructure
            </div>
            <h2 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-slate-950 md:text-5xl">
              The future of care access will not be limited to clinics.
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
              From August 2026, Ambulant+ plans selected contactless care-pod
              deployments across strategic airports and shopping malls, creating
              privacy-aware access points for guided virtual care, supported device use,
              structured patient routing and partner-enabled healthcare access.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {podRolloutLocations.map((location) => (
                <div
                  key={location}
                  className="rounded-3xl border border-white/70 bg-white/80 p-4 text-sm font-semibold text-slate-700 shadow-sm"
                >
                  <Plane className="mb-3 h-5 w-5 text-cyan-700" />
                  {location}
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-500">
              Rollout timing, site availability and service scope remain subject to
              partner agreements, readiness checks and applicable operational approvals.
            </p>
          </div>

          <div className="glass-panel rounded-[42px] p-3 md:p-4">
            <div className="overflow-hidden rounded-[34px] border border-cyan-100 bg-white shadow-2xl">
              <Image
                src="/visuals/demos/contactless-care-pod-cabin.webp"
                alt="Ambulant+ contactless care pod cabin for private guided virtual care"
                width={2400}
                height={1350}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Contactless Medicine insights"
        title="A category-defining platform needs a serious knowledge base."
        body="Read Ambulant+ perspectives on Contactless Medicine, remote patient monitoring, medical-aid prevention, pandemic resilience and the movement beyond ordinary telemedicine."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {insightArticles.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              className="group rounded-[30px] border border-white/80 bg-white/85 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
            >
              <BookOpenText className="h-6 w-6 text-cyan-700" />
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {article.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {article.body}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Read insight <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

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

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <div className="rounded-[42px] border border-cyan-100 bg-white/82 p-8 shadow-sm md:p-12">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
                <CalendarCheck className="h-4 w-4" />
                Responsible positioning
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em] text-slate-950">
                Clear promise. Clear boundaries.
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                "Ambulant+ supports clinician-led care; it does not replace the treating clinician's judgement.",
                "Connected device data supports care context; it does not remove the need for in-person assessment when clinically required.",
                "InsightCore supports visibility, predictive care signals and structured intelligence; it should not be presented as autonomous diagnosis.",
                "Ambulant+ is not an emergency service. In a medical emergency, users should contact local emergency services immediately.",
              ].map((item) => (
                <div key={item} className="rounded-3xl bg-slate-50 p-5">
                  <ClipboardCheck className="h-5 w-5 text-cyan-700" />
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </div>
    </main>
  );
}