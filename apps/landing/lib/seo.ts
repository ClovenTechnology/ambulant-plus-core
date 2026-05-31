import type { Metadata } from "next";
import { site } from "@/lib/site";

export type SeoRoute = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  priority: number;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
};

export const siteUrl = site.url.replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export const coreKeywords = [
  "Ambulant+",
  "Ambulant Plus",
  "Contactless Medicine",
  "contactless healthcare South Africa",
  "remote patient monitoring South Africa",
  "telemedicine South Africa",
  "virtual healthcare South Africa",
  "connected medical devices",
  "IoMT healthcare platform",
  "Internet of Medical Things",
  "home diagnostics",
  "home phlebotomy",
  "digital stethoscope",
  "HD otoscope",
  "remote health monitor",
  "NexRing",
  "medical aid digital health",
  "HMO preventive care",
  "pharmacy fulfilment",
  "medicine delivery",
  "patient health passport",
  "clinician remote practice",
];

export const seoRoutes: SeoRoute[] = [
  {
    path: "/",
    title: "Ambulant+ | Contactless Medicine Platform in South Africa",
    description:
      "Ambulant+ is a Contactless Medicine platform connecting patients, clinicians, connected devices, home diagnostics, pharmacy fulfilment and preventive-care intelligence in one governed ecosystem.",
    keywords: [
      ...coreKeywords,
      "Contactless Medicine platform",
      "Ambulant+ South Africa",
      "personal health management software",
      "remote consultations with vitals",
      "clinician-led connected care",
    ],
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    path: "/platform",
    title: "Platform | Ambulant+ Contactless Medicine Infrastructure",
    description:
      "Explore the Ambulant+ platform architecture for patient access, clinician workflows, connected-device review, diagnostics coordination, pharmacy fulfilment and governance-aware intelligence.",
    keywords: [
      "Contactless Medicine infrastructure",
      "healthcare platform architecture",
      "patient clinician platform",
      "connected care platform",
      "Ambulant+ platform",
    ],
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/features",
    title: "Features | Connected Care, Devices, Reminders and Health Passport",
    description:
      "Ambulant+ features include connected device workflows, clinician-led consultation, health passport, reminders, self-check, MedReach diagnostics, CarePort fulfilment and InsightCore intelligence.",
    keywords: [
      "remote patient monitoring features",
      "connected care features",
      "health passport",
      "medication reminders",
      "self-check health app",
      "virtual care with devices",
    ],
    priority: 0.92,
    changeFrequency: "monthly",
  },
  {
    path: "/devices",
    title: "Devices | Health Monitor, Digital Stethoscope, HD Otoscope and NexRing",
    description:
      "Ambulant+ focuses on a defined connected-device ecosystem: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing for supported remote-care workflows.",
    keywords: [
      "Health Monitor",
      "Digital Stethoscope",
      "HD Otoscope",
      "NexRing",
      "connected medical devices",
      "IoMT devices South Africa",
    ],
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/patients",
    title: "Patients | Protected Contactless Medicine Workspace",
    description:
      "Ambulant+ gives patients a protected workspace for virtual consultations, connected-device pathways, medication support, health records, reports, bookings and care-network access.",
    keywords: [
      "patient health app South Africa",
      "virtual doctor consultation",
      "remote consultation with vitals",
      "patient health passport",
      "home monitoring app",
    ],
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/patients/getting-started",
    title: "Getting Started | Ambulant+ Patient Setup Guide",
    description:
      "Learn how patients begin with Ambulant+: profile setup, bookings, connected devices, medical-aid readiness, medication support and governed care pathways.",
    keywords: [
      "Ambulant+ patient setup",
      "how to use Ambulant+",
      "connect health devices",
      "book virtual doctor",
      "patient onboarding",
    ],
    priority: 0.82,
    changeFrequency: "monthly",
  },
  {
    path: "/centres/ladies-health",
    title: "Ladies’ Health Centre | Women’s Health Pathways on Ambulant+",
    description:
      "Ambulant+ Ladies’ Health supports women’s health pathways, wellness prompts, fertility-relevant signals, clinician review and connected-care coordination.",
    keywords: [
      "women's health South Africa",
      "ladies health app",
      "fertility tracking",
      "virtual gynaecology consultation",
      "NexRing fertility",
    ],
    priority: 0.84,
    changeFrequency: "monthly",
  },
  {
    path: "/centres/paediatric",
    title: "Paediatric Centre | Child Health Pathways on Ambulant+",
    description:
      "Ambulant+ Paediatric Centre supports parent-led child health access, paediatric consultation pathways, care records, reminders and governed escalation.",
    keywords: [
      "paediatric telemedicine South Africa",
      "child health app",
      "virtual paediatric consultation",
      "family health monitoring",
    ],
    priority: 0.84,
    changeFrequency: "monthly",
  },
  {
    path: "/centres/antenatal",
    title: "Antenatal Centre | Pregnancy Support and Connected Care",
    description:
      "Ambulant+ Antenatal Centre supports pregnancy care coordination, appointment readiness, clinical review pathways, wellness prompts and care-team visibility.",
    keywords: [
      "antenatal care South Africa",
      "pregnancy telemedicine",
      "virtual obstetric consultation",
      "pregnancy monitoring support",
    ],
    priority: 0.84,
    changeFrequency: "monthly",
  },
  {
    path: "/centres/gentlemens-health",
    title: "Gentlemen’s Health Centre | Men’s Health Pathways on Ambulant+",
    description:
      "Ambulant+ Gentlemen’s Health supports men’s health pathways, screening prompts, remote clinical access, wellness tracking and follow-up coordination.",
    keywords: [
      "men's health South Africa",
      "gentlemen's health app",
      "virtual men's health consultation",
      "preventive men's health",
    ],
    priority: 0.84,
    changeFrequency: "monthly",
  },
  {
    path: "/clinicians",
    title: "Clinicians | Governed Remote Practice with Connected Devices",
    description:
      "Ambulant+ helps clinicians deliver remote care with patient context, connected-device review, structured documentation, MedReach diagnostics, CarePort fulfilment and governance-aware workflows.",
    keywords: [
      "clinician remote practice",
      "doctor telemedicine platform",
      "remote consultation platform for doctors",
      "connected device review",
      "HPCSA digital health",
    ],
    priority: 0.9,
    changeFrequency: "monthly",
  },
  {
    path: "/clinicians/onboarding",
    title: "Clinician Onboarding | Join the Ambulant+ Clinical Network",
    description:
      "Learn how clinicians onboard to Ambulant+, including profile readiness, training, compliance checks, workspace access and device-supported remote-care preparation.",
    keywords: [
      "clinician onboarding",
      "join Ambulant+",
      "remote doctor platform South Africa",
      "Contactless Medicine training",
    ],
    priority: 0.84,
    changeFrequency: "monthly",
  },
  {
    path: "/clients",
    title: "Medical Aids, HMOs and Corporate Sponsors | Ambulant+",
    description:
      "Ambulant+ helps medical aids, HMOs, insurers, employers and sponsors support preventive care, remote monitoring, adherence visibility, home diagnostics and governed care-network access.",
    keywords: [
      "medical aid digital health",
      "HMO preventive care",
      "corporate wellness platform",
      "remote patient monitoring for insurers",
      "member engagement healthcare",
      "chronic disease prevention",
    ],
    priority: 0.95,
    changeFrequency: "monthly",
  },
  {
    path: "/medreach",
    title: "MedReach | Home Diagnostics and Laboratory Operations",
    description:
      "MedReach coordinates home phlebotomy, specimen collection, laboratory handover, chain-of-custody visibility and result-routing workflows inside Ambulant+.",
    keywords: [
      "home phlebotomy South Africa",
      "home diagnostics",
      "laboratory coordination",
      "specimen collection",
      "MedReach",
    ],
    priority: 0.88,
    changeFrequency: "monthly",
  },
  {
    path: "/medreach/labs",
    title: "MedReach for Labs | Laboratory Coordination and Result Routing",
    description:
      "MedReach helps laboratories participate in governed home-diagnostics workflows, specimen handover, catalogue readiness and result-routing coordination.",
    keywords: [
      "laboratory digital health",
      "lab result routing",
      "home blood draw labs",
      "specimen handover",
    ],
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/medreach/phlebotomists",
    title: "MedReach for Phlebotomists | Home Draw Operations",
    description:
      "MedReach supports phlebotomist workflows for home draws, patient verification, specimen labelling, handover readiness and diagnostic task visibility.",
    keywords: [
      "phlebotomist home draw",
      "home blood collection",
      "diagnostic task workflow",
      "MedReach phlebotomy",
    ],
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/careport",
    title: "CarePort | Pharmacy Fulfilment and Medicine Delivery Operations",
    description:
      "CarePort coordinates pharmacy fulfilment, rider dispatch, medicine handover, delivery tracking, proof-of-delivery and patient updates inside Ambulant+.",
    keywords: [
      "pharmacy fulfilment",
      "medicine delivery South Africa",
      "eRx delivery",
      "CarePort",
      "medication adherence",
    ],
    priority: 0.88,
    changeFrequency: "monthly",
  },
  {
    path: "/careport/pharmacies",
    title: "CarePort for Pharmacies | eRx Fulfilment and Dispatch Readiness",
    description:
      "CarePort helps pharmacies manage prescription fulfilment, catalogue visibility, dispatch handover, proof-of-delivery and medicine-continuity workflows.",
    keywords: [
      "pharmacy dispatch platform",
      "prescription fulfilment",
      "eRx pharmacy workflow",
      "medicine delivery pharmacy",
    ],
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/careport/riders",
    title: "CarePort for Riders | Medicine Delivery and Handover Workflow",
    description:
      "CarePort supports delivery-rider workflows for medicine pickup, handover, tracking, patient updates and proof-of-delivery inside governed fulfilment operations.",
    keywords: [
      "medicine delivery riders",
      "pharmacy rider workflow",
      "proof of delivery healthcare",
      "CarePort riders",
    ],
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/insightcore",
    title: "InsightCore | Healthcare Intelligence and Programme Visibility",
    description:
      "InsightCore gives programme teams visibility across adherence signals, remote monitoring trends, utilisation, risk indicators, care pathways and operational performance.",
    keywords: [
      "healthcare intelligence",
      "programme visibility",
      "medical aid analytics",
      "remote monitoring analytics",
      "preventive care intelligence",
    ],
    priority: 0.86,
    changeFrequency: "monthly",
  },
  {
    path: "/operations",
    title: "Operations | Clinical, Diagnostic and Fulfilment Coordination",
    description:
      "Ambulant+ operations coordinate clinical workflows, MedReach diagnostics, CarePort pharmacy fulfilment, onboarding, support and governance escalation.",
    keywords: [
      "healthcare operations",
      "clinical workflow coordination",
      "diagnostics operations",
      "pharmacy fulfilment operations",
    ],
    priority: 0.82,
    changeFrequency: "monthly",
  },
  {
    path: "/partnerships",
    title: "Partnerships | Build Contactless Medicine Programmes with Ambulant+",
    description:
      "Ambulant+ partners with healthcare organisations, employers, medical aids, pharmacies, laboratories and programme sponsors to build governed connected-care pathways.",
    keywords: [
      "healthcare partnerships",
      "digital health partnerships",
      "medical aid partnerships",
      "corporate health partnerships",
    ],
    priority: 0.84,
    changeFrequency: "monthly",
  },
  {
    path: "/bookings",
    title: "Bookings | Schedule Ambulant+ Demos and Partnership Sessions",
    description:
      "Book Ambulant+ demos, partner sessions, clinical workflow discussions, medical-aid briefings, device pathway reviews and Contactless Medicine discovery calls.",
    keywords: [
      "book Ambulant+ demo",
      "Contactless Medicine demo",
      "healthcare platform booking",
      "digital health demo South Africa",
    ],
    priority: 0.82,
    changeFrequency: "monthly",
  },
  {
    path: "/demos",
    title: "Demos | Experience Ambulant+ Contactless Medicine Workflows",
    description:
      "Explore Ambulant+ demos covering remote consultation, connected devices, home diagnostics, pharmacy fulfilment, medical-aid readiness and governed care operations.",
    keywords: [
      "Ambulant+ demo",
      "remote patient monitoring demo",
      "IoMT demo",
      "Contactless Medicine exhibition",
    ],
    priority: 0.82,
    changeFrequency: "monthly",
  },
  {
    path: "/resources",
    title: "Resources | Ambulant+ Guides and Knowledge Library",
    description:
      "Ambulant+ resources support patients, clinicians, partners and programme teams with guidance on Contactless Medicine, connected devices and governed care workflows.",
    keywords: [
      "Contactless Medicine resources",
      "remote care guides",
      "patient guides",
      "clinician guides",
      "IoMT workflow guides",
    ],
    priority: 0.78,
    changeFrequency: "monthly",
  },
  {
    path: "/innovation",
    title: "Innovation | The Ambulant+ Contactless Medicine Thesis",
    description:
      "Ambulant+ innovation focuses on clinician-led connected care, home diagnostics, pharmacy continuity, preventive intelligence and governed health-system infrastructure.",
    keywords: [
      "healthcare innovation South Africa",
      "Contactless Medicine innovation",
      "digital health innovation",
      "preventive healthcare platform",
    ],
    priority: 0.78,
    changeFrequency: "monthly",
  },
  {
    path: "/research-and-development",
    title: "Research and Development | Connected Care and Workflow Evidence",
    description:
      "Ambulant+ research and development focuses on connected-care workflows, device-supported consultation, diagnostics operations, fulfilment logistics and governance design.",
    keywords: [
      "digital health research",
      "connected care research",
      "IoMT research",
      "remote patient monitoring research",
    ],
    priority: 0.78,
    changeFrequency: "monthly",
  },
  {
    path: "/ecosystem",
    title: "Ecosystem | Ambulant+, MedReach, CarePort and InsightCore",
    description:
      "Understand the Ambulant+ ecosystem across patient access, clinician workspaces, MedReach diagnostics, CarePort fulfilment, InsightCore intelligence and Cloven Technology Impilo.",
    keywords: [
      "Ambulant+ ecosystem",
      "Cloven Technology Impilo",
      "MedReach",
      "CarePort",
      "InsightCore",
    ],
    priority: 0.78,
    changeFrequency: "monthly",
  },
  {
    path: "/use-cases",
    title: "Use Cases | Contactless Medicine Pathways for Real-World Care",
    description:
      "Explore Ambulant+ use cases for chronic care, preventive monitoring, medical aids, home diagnostics, pharmacy continuity, remote practice and care-centre pathways.",
    keywords: [
      "Contactless Medicine use cases",
      "remote monitoring use cases",
      "chronic care prevention",
      "home diagnostics use cases",
    ],
    priority: 0.78,
    changeFrequency: "monthly",
  },
  {
    path: "/security",
    title: "Security | Protected Workspaces and Governance-Aware Access",
    description:
      "Ambulant+ is designed around protected workspaces, role-based access, data minimisation, auditability, environment separation and governance-aware healthcare operations.",
    keywords: [
      "healthcare data security",
      "POPIA healthcare",
      "role-based access healthcare",
      "secure telemedicine platform",
    ],
    priority: 0.76,
    changeFrequency: "monthly",
  },
  {
    path: "/compliance",
    title: "Compliance | Clinical Governance, Privacy and Operational Controls",
    description:
      "Ambulant+ compliance language supports privacy, clinical-governance workflows, audit-friendly records, careful claims and controlled healthcare operations.",
    keywords: [
      "healthcare compliance South Africa",
      "clinical governance",
      "POPIA compliance",
      "digital health compliance",
    ],
    priority: 0.76,
    changeFrequency: "monthly",
  },
  {
    path: "/clinical-disclaimer",
    title: "Clinical Disclaimer | Ambulant+",
    description:
      "Read the Ambulant+ clinical disclaimer covering emergency limitations, professional judgement, device-supported workflows and responsible use of Contactless Medicine.",
    keywords: [
      "Ambulant+ clinical disclaimer",
      "telemedicine disclaimer",
      "remote care disclaimer",
    ],
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/privacy",
    title: "Privacy Policy | Ambulant+",
    description:
      "Read the Ambulant+ privacy policy for information about personal data, health-related information, consent-aware sharing and privacy responsibilities.",
    keywords: [
      "Ambulant+ privacy policy",
      "health data privacy",
      "POPIA privacy",
    ],
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/terms",
    title: "Terms and Conditions | Ambulant+",
    description:
      "Read the Ambulant+ terms and conditions for platform access, responsible use, service boundaries and operational rules.",
    keywords: [
      "Ambulant+ terms",
      "Contactless Medicine terms",
      "platform terms",
    ],
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/faq",
    title: "FAQ | Ambulant+ Contactless Medicine Questions",
    description:
      "Find answers to common Ambulant+ questions about Contactless Medicine, patient access, clinicians, devices, MedReach, CarePort and platform workflows.",
    keywords: [
      "Ambulant+ FAQ",
      "Contactless Medicine questions",
      "telemedicine FAQ",
      "remote monitoring FAQ",
    ],
    priority: 0.74,
    changeFrequency: "monthly",
  },
  {
    path: "/contact",
    title: "Contact | Speak to Ambulant+",
    description:
      "Contact Ambulant+ for demos, partnerships, medical-aid discussions, clinician onboarding, patient support, MedReach, CarePort and Contactless Medicine enquiries.",
    keywords: [
      "contact Ambulant+",
      "Ambulant+ support",
      "book Contactless Medicine demo",
      "medical aid partnership contact",
    ],
    priority: 0.82,
    changeFrequency: "monthly",
  },
];

export function getSeoRoute(path: string): SeoRoute {
  return seoRoutes.find((route) => route.path === path) ?? seoRoutes[0];
}

export function buildPageMetadata(routePath: string, overrides?: Partial<SeoRoute>): Metadata {
  const route = { ...getSeoRoute(routePath), ...overrides };
  const canonical = absoluteUrl(route.path);
  const image = absoluteUrl("/og/ambulant-og.webp");

  return {
    metadataBase: new URL(siteUrl),
    title: route.title,
    description: route.description,
    keywords: Array.from(new Set([...coreKeywords, ...route.keywords])),
    alternates: {
      canonical,
    },
    openGraph: {
      title: route.title,
      description: route.description,
      url: canonical,
      siteName: site.name,
      images: [
        {
          url: image,
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
      title: route.title,
      description: route.description,
      images: [image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: site.name,
    legalName: site.parentCompany,
    url: siteUrl,
    logo: absoluteUrl("/brand/ambulant-logo-full.png"),
    image: absoluteUrl("/og/ambulant-og.webp"),
    description:
      "Ambulant+ is a Contactless Medicine ecosystem by Cloven Technology Impilo, connecting patient access, clinician workflows, connected medical devices, MedReach diagnostics, CarePort fulfilment and InsightCore intelligence.",
    telephone: site.phone,
    email: site.generalEmail,
    address: {
      "@type": "PostalAddress",
      streetAddress:
        "Block D FF, Saint Andrews Office Park, 0B Meadowbrook Lane, Epsom Downs",
      addressLocality: "Bryanston",
      addressRegion: "Gauteng",
      postalCode: "2152",
      addressCountry: "ZA",
    },
    parentOrganization: {
      "@type": "Organization",
      name: site.parentCompany,
      email: site.corporateEmail,
    },
    brand: site.brandFamily.map((brand) => ({
      "@type": "Brand",
      name: brand.name,
      description: brand.summary,
    })),
    areaServed: [
      {
        "@type": "Country",
        name: "South Africa",
      },
    ],
    knowsAbout: [
      "Contactless Medicine",
      "Remote patient monitoring",
      "Telemedicine",
      "Internet of Medical Things",
      "Home diagnostics",
      "Medication adherence",
      "Pharmacy fulfilment",
      "Medical aid preventive care",
      "Clinical governance",
      "Digital health infrastructure",
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: site.phone,
        email: site.supportEmail,
        areaServed: "ZA",
        availableLanguage: ["en"],
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: site.phone,
        email: site.salesEmail,
        areaServed: "ZA",
        availableLanguage: ["en"],
      },
      {
        "@type": "ContactPoint",
        contactType: "demo bookings",
        telephone: site.phone,
        email: site.demoEmail,
        areaServed: "ZA",
        availableLanguage: ["en"],
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: site.name,
    url: siteUrl,
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
    inLanguage: "en-ZA",
    description:
      "Ambulant+ provides information about Contactless Medicine, remote patient monitoring, connected medical devices, home diagnostics, pharmacy fulfilment, patient access, clinician workflows and medical-aid preventive-care infrastructure.",
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": absoluteUrl("/#software"),
    name: site.name,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web, iOS, Android",
    url: siteUrl,
    image: absoluteUrl("/og/ambulant-og.webp"),
    description:
      "Ambulant+ is a Contactless Medicine platform for patient access, clinician-led remote consultation, connected-device review, MedReach diagnostics, CarePort fulfilment and InsightCore programme visibility.",
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
    offers: {
      "@type": "Offer",
      category: "Digital health platform",
      availability: "https://schema.org/PreOrder",
    },
  };
}

export function breadcrumbJsonLd(
  items: Array<{
    name: string;
    path: string;
  }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}