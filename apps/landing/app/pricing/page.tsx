import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  HandCoins,
  HeartPulse,
  LockKeyhole,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TestTube2,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing | Ambulant+ Contactless Medicine Plans and Commercial Model",
  description:
    "Explore Ambulant+ pricing architecture for patients, clinicians, medical aids, HMOs, employers, MedReach labs, phlebotomists, CarePort pharmacies, riders, enterprise partners and Contactless Medicine programme deployments.",
  keywords: [
    "Ambulant+ pricing",
    "Contactless Medicine pricing",
    "telemedicine pricing South Africa",
    "remote patient monitoring pricing",
    "medical aid remote monitoring pricing",
    "clinician onboarding fee",
    "clinician starter kit",
    "IoMT starter kit",
    "patient app subscription",
    "clinician app subscription",
    "CarePort pharmacy pricing",
    "MedReach lab pricing",
    "pharmacy success fee",
    "lab test script fee",
    "medical aid streaming fee",
    "InsightCore pricing",
    "healthcare SaaS pricing",
    "digital health pricing South Africa",
  ],
  alternates: {
    canonical: absoluteUrl("/pricing"),
  },
  openGraph: {
    title: "Pricing | Ambulant+ Contactless Medicine Plans and Commercial Model",
    description:
      "Pricing architecture for patients, clinicians, medical aids, employers, labs, pharmacies, riders, phlebotomists and enterprise Contactless Medicine deployments.",
    url: absoluteUrl("/pricing"),
    siteName: site.name,
    images: [
      {
        url: absoluteUrl("/og/ambulant-og.webp"),
        width: 1200,
        height: 630,
        alt: "Ambulant+ Contactless Medicine pricing",
      },
    ],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Ambulant+ Contactless Medicine",
    description:
      "Role-based pricing architecture for the Ambulant+ Contactless Medicine ecosystem.",
    images: [absoluteUrl("/og/ambulant-og.webp")],
  },
};

const pricingPrinciples = [
  "Pricing is role-based because patients, clinicians, medical aids, labs, pharmacies, riders and enterprise partners use different parts of the ecosystem.",
  "Patient access can begin on a free plan, while advanced analytics, premium care-centre features and family management sit in paid tiers.",
  "Clinician subscription does not bypass onboarding, training, verification, compliance, Smart ID, starter-kit dispatch or activation readiness.",
  "Medical aids, HMOs, employers and sponsors are priced by programme scope, member cohort, streaming, storage, InsightCore intelligence, rewards and integration requirements.",
  "CarePort and MedReach can support free onboarding, success fees, operational script/test fees, catalogue storage tiers and promotional marketplace services.",
  "Enterprise, franchise and territory models are handled by commercial agreement, performance obligations and governance requirements.",
];

const patientPlans = [
  {
    name: "Free",
    label: "Basic access",
    price: "Free access",
    body:
      "For patients who need access to core Contactless Medicine features without advanced analytics or premium family/care-centre functionality.",
    features: [
      "Create and manage patient profile",
      "Connect supported devices where available",
      "Search clinicians and book appointments",
      "View encounters, summaries and medical records",
      "Use CarePort medicine fulfilment where available",
      "Use MedReach diagnostics where available",
      "Access basic reminders and care history",
    ],
    cta: "Access Patient App",
    href: site.patientAppUrl,
  },
  {
    name: "Premium",
    label: "Advanced personal health",
    price: "Subscription plan",
    body:
      "For patients who want stronger health intelligence, advanced analytics and expanded personal-health management features.",
    features: [
      "Everything in Free",
      "Advanced analytics and richer health trends",
      "Premium device insights where supported",
      "Add and manage up to 2 family members",
      "Expanded Ladies’ Health and care-centre features where available",
      "Stronger prevention and care-continuity tools",
      "Priority access to future premium modules where applicable",
    ],
    cta: "Explore patient features",
    href: "/patients",
  },
  {
    name: "Family",
    label: "Household care coordination",
    price: "Family subscription",
    body:
      "For households that need shared care management, family monitoring and more coordinated access across dependants.",
    features: [
      "Everything in Premium",
      "Add and manage up to 5 family members",
      "Family health coordination workflows",
      "Shared care reminders where permission allows",
      "Family appointment readiness",
      "Support for household care continuity",
      "Designed for parents, carers and family managers",
    ],
    cta: "View patient guide",
    href: "/resources/find-a-doctor-and-book-appointment",
  },
];

const clinicianPlans = [
  {
    name: "Solo / Free",
    body:
      "For individual clinicians starting with a personal profile and core consultation access.",
    features: [
      "Individual clinician workspace",
      "No admin staff or team-member slots",
      "Patient listing only after readiness and activation requirements are met",
      "Monthly payout cycle where eligible",
      "Payslip generation from dashboard",
    ],
  },
  {
    name: "Starter",
    body:
      "For clinicians who need stronger practice tools and limited operational support.",
    features: [
      "Everything in Solo",
      "Admin support capacity where enabled",
      "Stronger workflow support",
      "Suitable for independent remote practice",
      "Subscription can influence payout band where configured",
    ],
  },
  {
    name: "Team",
    body:
      "For busier clinicians, small practices or shared care teams that need more operational capacity.",
    features: [
      "Team/admin member support",
      "Practice workflow readiness",
      "More structured clinical operations",
      "Suitable for small groups and high-volume clinicians",
      "Payout and platform settings remain admin-configurable",
    ],
  },
  {
    name: "Group / Clinic Enterprise",
    body:
      "For larger clinical teams, specialist groups, clinics and enterprise clinical networks.",
    features: [
      "Multi-user practice structure",
      "Enterprise onboarding route",
      "Governance and compliance support",
      "Custom operational configuration",
      "Commercial terms by agreement",
    ],
  },
];

const clinicianActivationItems = [
  "Once-off onboarding, training and starter-kit fee may apply.",
  "Starter kit may include Health Monitor, NexRing, Digital Stethoscope, HD Otoscope, clinician handbook, consumables, branded items and Smart ID materials.",
  "Partial payment, minimum initial payment and balance recovery may be configured by admin policy.",
  "Payment may be processed through supported providers such as Paystack or PayFast where enabled.",
  "Baseline consultation payout model is 70:30, paid monthly, unless plan, policy or agreement defines otherwise.",
  "Paid subscription does not override credentialing, regulator checks, PI insurance, prescribing authority, training completion or activation readiness.",
];

const enterpriseChargeTypes = [
  {
    title: "Streaming",
    body:
      "Per active monitored member pricing for vitals streaming, remote monitoring, medication adherence reporting, booking preflights, authorisations, claims autofiling and care-continuity analytics.",
    example: "Example anchor: R500 per active monitored member per month.",
    icon: HeartPulse,
  },
  {
    title: "Storage",
    body:
      "Historic data retention, reports, analytics records, evidence, programme history and longer-term health-intelligence storage.",
    example: "Priced by programme size, retention duration and reporting depth.",
    icon: FileText,
  },
  {
    title: "InsightCore Intelligence",
    body:
      "AI-assisted and governance-aware intelligence layers for predictive care signals, risk movement, cohort analytics, adherence trends and programme visibility.",
    example: "Charged as a separate intelligence layer or enterprise tier.",
    icon: Sparkles,
  },
  {
    title: "Rewards Engine",
    body:
      "Creation and management of member rewards, healthy-living incentives, adherence rewards, screening prompts and preventive-care engagement campaigns.",
    example: "Rewards can be funded, sponsored or administered by programme terms.",
    icon: BadgeCheck,
  },
  {
    title: "Implementation",
    body:
      "Programme design, configuration, training, eligibility setup, workflow mapping, role permissions, reporting structure and go-live support.",
    example: "Once-off implementation fee usually applies.",
    icon: ClipboardCheck,
  },
  {
    title: "Integrations",
    body:
      "Claims, eligibility, real-time preflight, authorisation, SSO, EHR/HMS, finance, API access, export or third-party integration work.",
    example: "Charged by complexity, scope and maintenance requirements.",
    icon: LockKeyhole,
  },
];

const carePortPricing = [
  "Free onboarding option for pharmacies.",
  "Free-tier success fee: 26% on fulfilled purchases where applicable.",
  "Operational tier: R1 per prescribed item/script, configurable by admin.",
  "Monthly cloud/storage fee by SKU catalogue size, such as 1–1000, 1001–5000 and 5001–10000 SKU items.",
  "Optional promotional services: patient-app banners, clinician-app banners, marketplace promotion and featured placement.",
  "Payment processor charges from providers such as Paystack or PayFast are handled within the configured transaction economics where applicable.",
];

const medReachPricing = [
  "Free onboarding option for laboratories.",
  "Free-tier success fee: 26% on fulfilled purchases/test orders where applicable.",
  "Operational tier: R10 per prescribed test/script, configurable by admin.",
  "Monthly cloud/storage fee by test catalogue size, such as 1–100, 101–500 and 501–1000 test items.",
  "Optional promotional services: patient-app banners, clinician-app banners, marketplace promotion and featured placement.",
  "Home phlebotomy and specimen logistics may include separate operational fees depending on territory and workflow.",
];

const payoutModels = [
  {
    title: "Clinicians",
    body:
      "Baseline consultation payout is 70:30, paid monthly, with payslip generation from the clinician dashboard where configured.",
    icon: Stethoscope,
  },
  {
    title: "Riders",
    body:
      "CarePort rider payout can follow a 70:30 service-share model, subject to route, territory, partner and admin configuration.",
    icon: Truck,
  },
  {
    title: "Phlebotomists",
    body:
      "MedReach phlebotomist payout can follow a 70:30 service-share model, subject to task type, territory, partner and admin configuration.",
    icon: TestTube2,
  },
];

const franchiseModels = [
  "CarePort SA master-operator or franchise rights may be licensed to a competent pharmacy, logistics or healthcare management company.",
  "MedReach SA master-operator or franchise rights may be licensed to a competent laboratory, diagnostics or medical management company.",
  "Territory agreements may include setup fees, minimum guarantees, revenue share, service-level obligations, governance obligations and performance reviews.",
  "Franchise or master-operator rights should not weaken clinical governance, patient safety, pharmacy accountability, laboratory standards or data protection.",
];

const whatAffectsPrice = [
  "Patient plan tier and number of managed family members",
  "Clinician plan type, admin/team capacity and onboarding requirements",
  "Device bundle, replacement, rental, subsidy or starter-kit model",
  "Consultation type, clinician category and clinical pathway",
  "Medical-aid eligibility, sponsor programme rules and authorisation workflow",
  "Remote monitoring, streaming, storage and analytics depth",
  "InsightCore intelligence layer and reporting requirements",
  "CarePort medicine fulfilment and delivery workflow",
  "MedReach diagnostics, phlebotomy and lab result routing",
  "Integration complexity, SLA, support level and territory scope",
];

const faqs = [
  {
    question: "Is there a free patient plan?",
    answer:
      "Yes. Patients can access core features on the free plan, including profile access, supported device connection, clinician search, appointment booking, encounters, medical records, CarePort and MedReach where available. Advanced analytics and selected premium features sit in paid plans.",
  },
  {
    question: "Do clinicians pay an onboarding fee?",
    answer:
      "Clinician activation may include a once-off onboarding, training and starter-kit fee. The starter kit can include supported IoMT devices, training materials, consumables, branded items and Smart ID materials depending on configuration.",
  },
  {
    question: "Does payment make a clinician immediately visible to patients?",
    answer:
      "No. Commercial access does not override training, credentialing, regulator checks, PI insurance, Smart ID status, dispatch readiness, activation state or platform governance.",
  },
  {
    question: "How are pharmacies charged?",
    answer:
      "CarePort pharmacies may onboard free and pay a success fee on fulfilled purchases, or use operational pricing such as per prescribed item/script fees, SKU storage tiers and optional promotional placements.",
  },
  {
    question: "How are laboratories charged?",
    answer:
      "MedReach labs may onboard free and pay a success fee where applicable, or use operational pricing such as per prescribed test/script fees, test catalogue storage tiers and optional promotional placements.",
  },
  {
    question: "How are medical aids and employers charged?",
    answer:
      "Medical aids, HMOs, employers and sponsors are priced by programme scope, active monitored members, streaming, storage, InsightCore intelligence, rewards, claims workflows, integrations and implementation requirements.",
  },
  {
    question: "Are exact prices final?",
    answer:
      "Some fees may be configured by admin dashboard, country, programme, plan, partner agreement or rollout size. This page explains the pricing architecture; final commercial terms may be confirmed through the relevant workspace, demo or enterprise agreement.",
  },
];

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Ambulant+ Pricing",
  url: absoluteUrl("/pricing"),
  description: metadata.description,
  inLanguage: "en-ZA",
  publisher: {
    "@type": "Organization",
    name: "Ambulant+",
    url: site.url,
  },
  about: [
    "Contactless Medicine pricing",
    "remote patient monitoring pricing",
    "patient app subscription",
    "clinician onboarding fee",
    "medical aid programme pricing",
    "CarePort pricing",
    "MedReach pricing",
    "InsightCore intelligence pricing",
  ],
};

const offerCatalogJsonLd = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: "Ambulant+ Pricing Categories",
  url: absoluteUrl("/pricing"),
  itemListElement: [
    "Patient plans",
    "Clinician plans",
    "Medical aid and employer programmes",
    "CarePort pharmacy pricing",
    "MedReach laboratory pricing",
    "Rider and phlebotomist payout models",
    "Enterprise and franchise licensing",
  ].map((name, index) => ({
    "@type": "Offer",
    position: index + 1,
    name,
    category: "Digital health pricing",
  })),
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
      name: "Pricing",
      item: absoluteUrl("/pricing"),
    },
  ],
};

export default function PricingPage() {
  return (
    <main>
      <Script
        id="pricing-webpage-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <Script
        id="pricing-offer-catalog-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalogJsonLd) }}
      />
      <Script
        id="pricing-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="pricing-breadcrumb-jsonld"
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
              <WalletCards className="h-4 w-4" />
              Pricing architecture
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
              Pricing for a multi-sided Contactless Medicine ecosystem.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-600">
              Ambulant+ pricing is organised by workspace, care pathway and
              partner role. Patients, clinicians, medical aids, employers,
              laboratories, pharmacies, riders and phlebotomists do not use the
              platform in the same way, so pricing must reflect the workflow
              being activated.
            </p>

            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
              This page explains the commercial model for patient subscriptions,
              clinician onboarding, medical-aid programmes, CarePort fulfilment,
              MedReach diagnostics, payouts, promotional services, enterprise
              deployments and future franchise or territory licensing.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demos?type=pricing"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request pricing walkthrough <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/contact?type=pricing"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
              >
                Speak to commercial team <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[38px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
              Commercial principle
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Paid access does not bypass governance.
            </h2>
            <p className="mt-5 text-sm leading-8 text-slate-300 md:text-base">
              Pricing activates commercial access. It does not override clinical
              governance, regulatory checks, credentialing, training completion,
              Smart ID status, dispatch readiness, payer eligibility or
              role-based permissions.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "Patients may start free and upgrade for advanced care intelligence.",
                "Clinicians must complete onboarding and readiness before listing.",
                "Payers and employers are priced by programme scope and data layer.",
                "CarePort and MedReach support transaction, storage and success-fee models.",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Pricing principles"
        title="The commercial model follows the care model."
        body="Ambulant+ is not a single app with one subscription. It is a governed ecosystem with patient, clinician, payer, diagnostic, pharmacy, logistics and enterprise operating layers."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pricingPrinciples.map((item) => (
            <div key={item} className="glass-panel rounded-[30px] p-6">
              <ShieldCheck className="h-6 w-6 text-cyan-700" />
              <p className="mt-4 text-sm leading-8 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Patient plans"
        title="Patients can start with basic access and upgrade for deeper health management."
        body="The patient pricing model should preserve access while allowing advanced analytics, premium care-centre functionality and family care coordination to sit in paid tiers."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {patientPlans.map((plan) => {
            const isExternal = plan.href.startsWith("http");

            const card = (
              <div className="glass-panel h-full rounded-[34px] p-6 transition hover:-translate-y-1 hover:shadow-glow">
                <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">
                  {plan.label}
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                  {plan.name}
                </h3>
                <div className="mt-2 text-lg font-semibold text-cyan-800">
                  {plan.price}
                </div>
                <p className="mt-4 text-sm leading-8 text-slate-600">{plan.body}</p>

                <div className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex gap-3 text-sm leading-7 text-slate-600">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  {plan.cta} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            );

            return isExternal ? (
              <a key={plan.name} href={plan.href} target="_blank" rel="noreferrer">
                {card}
              </a>
            ) : (
              <Link key={plan.name} href={plan.href}>
                {card}
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Clinician plans"
        title="Clinician pricing combines subscription, onboarding, training and activation readiness."
        body="Clinicians may subscribe by plan type, but visibility to patients depends on credentialing, compliance, training, Smart ID, starter-kit dispatch and activation state."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {clinicianPlans.map((plan) => (
            <div key={plan.name} className="glass-panel rounded-[30px] p-6">
              <Stethoscope className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{plan.name}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{plan.body}</p>

              <div className="mt-5 grid gap-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex gap-3 text-sm leading-7 text-slate-600">
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[34px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Onboarding and starter kit
              </div>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight">
                Going live is a readiness process, not just a payment event.
              </h3>
              <p className="mt-4 text-sm leading-8 text-slate-300">
                Clinician activation may include training payment, starter-kit
                preparation, dispatch, credentialing checks, compliance review,
                Smart ID issue and listing activation.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {clinicianActivationItems.map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4">
                  <BadgeCheck className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Medical aids, HMOs and employers"
        title="Enterprise pricing is built around active programmes, monitored members and intelligence layers."
        body="Client-app pricing should reflect the real value delivered: member streaming, eligibility, authorisation, claims, storage, analytics, InsightCore intelligence and rewards infrastructure."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {enterpriseChargeTypes.map(({ title, body, example, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-8 text-slate-600">{body}</p>
              <div className="mt-5 rounded-2xl bg-cyan-50 p-4 text-sm font-semibold leading-7 text-cyan-900">
                {example}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <Building2 className="h-8 w-8 text-cyan-700" />
          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
            Recommended enterprise register of charge categories.
          </h3>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Every enterprise client should have a commercial register covering
            active monitored members, streaming tier, storage tier, InsightCore
            tier, rewards engine, implementation fee, integration fee, support
            level, reporting/export access, device programme and minimum monthly
            platform fee.
          </p>
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-6 lg:grid-cols-2">
        <div className="glass-panel rounded-[34px] p-6 md:p-8">
          <Pill className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            CarePort pharmacy pricing.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Pharmacies can participate through free onboarding, success-fee
            economics, operational script/item fees, catalogue storage bands and
            promotional marketplace services.
          </p>

          <div className="mt-6 grid gap-3">
            {carePortPricing.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Link
            href="/careport/pharmacies"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Explore pharmacy pathway <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[34px] p-6 md:p-8">
          <TestTube2 className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            MedReach laboratory pricing.
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Laboratories can participate through free onboarding, success-fee
            economics, prescribed-test fees, catalogue storage tiers and
            promotional marketplace services.
          </p>

          <div className="mt-6 grid gap-3">
            {medReachPricing.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <Link
            href="/medreach/labs"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Explore lab pathway <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SectionShell
        eyebrow="Payout models"
        title="Service contributors need visible payout logic."
        body="Clinicians, riders and phlebotomists should understand how service-share economics work while recognising that final payout terms can depend on role, territory, plan, partner agreement and admin configuration."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {payoutModels.map(({ title, body, icon: Icon }) => (
            <div key={title} className="glass-panel rounded-[30px] p-6">
              <Icon className="h-7 w-7 text-cyan-700" />
              <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-8 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Franchise and territory licensing"
        title="Some operations may be licensed to competent master operators."
        body="CarePort SA and MedReach SA can become powerful franchise, territory or master-operator opportunities, but only where the operator can meet operational, governance, compliance and performance standards."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {franchiseModels.map((item) => (
            <div key={item} className="rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5">
              <HandCoins className="h-6 w-6 text-cyan-700" />
              <p className="mt-4 text-sm leading-8 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="What affects final pricing"
        title="Final price depends on workflow depth, programme scope and implementation complexity."
        body="This is why the public page should explain pricing architecture first. Exact amounts can be confirmed inside the relevant workspace, admin-configured plan, demo, partner agreement or country-specific commercial schedule."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {whatAffectsPrice.map((item) => (
            <div key={item} className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-sm">
              <CreditCard className="h-5 w-5 text-cyan-700" />
              <p className="mt-3 text-sm leading-7 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="rounded-[36px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Pricing governance
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Commercial access must remain accountable.
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300 md:text-base">
                Ambulant+ pricing should never create unsafe shortcuts. Patient
                safety, professional credentialing, payer eligibility, claims
                controls, data governance and operational accountability remain
                part of the commercial model.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Admin-configured pricing can support different plans, countries, partners and programme models.",
                "Payouts, platform share and fees should remain auditable and visible to authorised users.",
                "Promotional placement should not be presented as clinical recommendation.",
                "Medical-aid and sponsor pricing must respect consent, eligibility and role-based access.",
                "Device-supported care may attract different fees from ordinary video consultation.",
                "Enterprise pricing should include minimum monthly platform commitments where appropriate.",
              ].map((item) => (
                <div key={item} className="rounded-2xl bg-white/10 p-4">
                  <ShieldCheck className="mb-2 h-5 w-5 text-cyan-200" />
                  <p className="text-sm leading-7 text-slate-200">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Pricing FAQ"
        title="Common pricing questions."
        body="These answers help patients, clinicians, pharmacies, labs, payers and partners understand the pricing model before speaking to the commercial team."
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
          <Banknote className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Need exact commercial terms?
          </h2>
          <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-600 md:text-base">
            Exact pricing can depend on plan type, country, medical-aid route,
            active monitored members, device bundle, payment provider, storage,
            integrations, support level, territory and partner agreement. Request
            a pricing walkthrough so the correct commercial model can be mapped
            to your role.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/demos?type=pricing"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Request pricing walkthrough <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/contact?type=pricing"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800"
            >
              Contact commercial team <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <CTA />
      </section>
    </main>
  );
}