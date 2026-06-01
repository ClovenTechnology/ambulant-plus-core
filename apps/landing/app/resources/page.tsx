import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BriefcaseMedical,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Ear,
  FileText,
  GraduationCap,
  HeartPulse,
  LockKeyhole,
  Mail,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  TestTube2,
  Truck,
  UserRoundCheck,
  Users,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CTA from "@/components/CTA";
import SectionShell from "@/components/SectionShell";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata = {
  title: "Ambulant+ Resources | Contactless Medicine Guides and Knowledge Library",
  description:
    "Ambulant+ resources for Contactless Medicine, remote patient monitoring, IoMT device setup, Health Monitor workflows, Digital Stethoscope auscultation, NexRing guidance, MedReach diagnostics, CarePort medicine fulfilment, medical aids, clinicians and patients.",
  keywords: [
    "Contactless Medicine resources",
    "remote patient monitoring guides",
    "IoMT device setup guide",
    "Health Monitor setup",
    "Digital Stethoscope workflow",
    "digital auscultation guide",
    "NexRing setup guide",
    "remote vitals monitoring",
    "virtual consultation device workflow",
    "medical aid remote monitoring guide",
    "CarePort medicine delivery guide",
    "MedReach home phlebotomy guide",
    "clinician onboarding Contactless Medicine",
    "remote care training South Africa",
  ],
};

const resourceCollections: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "Patient guides",
    body:
      "Account setup, profile completion, medical-aid readiness, device setup, doctor booking, wallet, reminders, family access, MedReach diagnostics and CarePort medicine delivery guidance.",
    icon: UserRoundCheck,
    href: "/patients/getting-started",
  },
  {
    title: "Find a doctor and book appointment",
    body:
      "Learn how patients can search for a suitable clinician, choose an appointment time, prepare care context and join a Contactless Medicine consultation.",
    icon: CalendarCheck,
    href: "/resources/find-a-doctor-and-book-appointment",
  },
  {
    title: "Clinician resources",
    body:
      "Onboarding, Contactless Medicine training, device-supported consultation, documentation, escalation, compliance, professional boundaries and remote practice readiness.",
    icon: Stethoscope,
    href: "/clinicians/onboarding",
  },
  {
    title: "Device workflow guides",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows mapped to safe Contactless Medicine use cases, remote patient monitoring and clinical follow-up.",
    icon: Watch,
    href: "/devices",
  },
  {
    title: "Medical-aid and sponsor resources",
    body:
      "Programme visibility, eligibility, benefit activation, payment preflight, claims, rewards, adherence, remote monitoring and InsightCore payer intelligence use cases.",
    icon: Building2,
    href: "/clients",
  },
  {
    title: "MedReach resources",
    body:
      "Home phlebotomy, specimen collection, laboratory handover, chain-of-custody, result routing, diagnostics coordination and patient-facing lab workflows.",
    icon: TestTube2,
    href: "/medreach",
  },
  {
    title: "CarePort resources",
    body:
      "eRx fulfilment, pharmacy SKU readiness, rider dispatch, patient updates, proof-of-delivery, medication continuity, adherence support and last-mile medicine delivery.",
    icon: Pill,
    href: "/careport",
  },
];

const audienceGuides: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
}> = [
  {
    title: "For patients",
    body:
      "Prepare your profile, connect supported devices, book doctors, manage reminders, review reports and continue care safely from home, work or supported access points.",
    icon: Users,
    href: "/patients",
  },
  {
    title: "For clinicians",
    body:
      "Understand platform onboarding, training, device-supported review, virtual consultation discipline, clinical escalation and safer remote practice readiness.",
    icon: BriefcaseMedical,
    href: "/clinicians",
  },
  {
    title: "For labs",
    body:
      "Review MedReach laboratory onboarding, catalogue setup, specimen acceptance, result routing, phlebotomy coordination and operational visibility.",
    icon: TestTube2,
    href: "/medreach/labs",
  },
  {
    title: "For phlebotomists",
    body:
      "Understand home-draw assignment, patient verification, specimen labelling, custody, collection workflow and earnings visibility.",
    icon: ClipboardCheck,
    href: "/medreach/phlebotomists",
  },
  {
    title: "For pharmacies",
    body:
      "Review CarePort pharmacy onboarding, SKU readiness, prescription handling, rider handover, proof-of-fulfilment and payout workflows.",
    icon: Store,
    href: "/careport/pharmacies",
  },
  {
    title: "For riders",
    body:
      "Understand rider verification, handover, route progression, delivery rules, proof-of-delivery, patient updates and payout visibility.",
    icon: Truck,
    href: "/careport/riders",
  },
];

const deviceSetupGuides: Array<{
  title: string;
  eyebrow: string;
  body: string;
  bullets: string[];
  icon: LucideIcon;
  href: string;
  image: string;
  imageAlt: string;
}> = [
  {
    title: "Health Monitor setup guide",
    eyebrow: "Spot-check vitals",
    body:
      "The Health Monitor is a supported IoMT device controlled through a mobile phone, tablet or computer during consultation and remote review workflows.",
    bullets: [
      "Charge before first use and confirm the device is ready.",
      "Use correct positioning for each measurement workflow.",
      "Share readings only in clinician-led care context.",
    ],
    icon: HeartPulse,
    href: "/resources/health-monitor-setup",
    image: "/visuals/devices/health-monitor-card.webp",
    imageAlt: "Ambulant+ Health Monitor device for remote vitals monitoring",
  },
  {
    title: "Digital Stethoscope workflow guide",
    eyebrow: "Remote auscultation",
    body:
      "The Digital Stethoscope supports live heart and lung listening, audio capture, playback and follow-up comparison during device-supported virtual consultations.",
    bullets: [
      "Select heart or lung mode before auscultation.",
      "Record and save audio where follow-up comparison is needed.",
      "Use recordings as clinical context, not standalone diagnosis.",
    ],
    icon: Stethoscope,
    href: "/resources/digital-stethoscope-workflow",
    image: "/visuals/devices/digital-stethoscope-card.webp",
    imageAlt: "Ambulant+ Digital Stethoscope for live remote auscultation",
  },
  {
    title: "HD Otoscope workflow guide",
    eyebrow: "Remote imaging",
    body:
      "Learn how to use the HD Otoscope safely for clinician-led remote ear, nose, throat and skin image review, with clear escalation boundaries.",
    bullets: [
      "Use careful positioning and adequate lighting.",
      "Capture images only where the workflow supports remote review.",
      "Escalate pain, trauma, bleeding or severe symptoms urgently.",
    ],
    icon: Ear,
    href: "/resources/hd-otoscope-workflow",
    image: "/visuals/devices/hd-otoscope-card.webp",
    imageAlt: "Ambulant+ HD Otoscope for remote ear nose throat and skin image review",
  },
  {
    title: "NexRing wearing and sizing guide",
    eyebrow: "Continuous wellness context",
    body:
      "NexRing provides wearable context such as heart-rate trends, sleep-related insights, activity patterns and temperature-variation signals that can support preventive care discussions.",
    bullets: [
      "Use the sizing kit before unboxing the device.",
      "Wear on the less-dominant index finger where possible.",
      "Allow time for trends to populate before interpreting patterns.",
    ],
    icon: Watch,
    href: "/resources/nexring-setup",
    image: "/visuals/devices/nexring-card.webp",
    imageAlt: "NexRing wearable smart ring for continuous wellness and remote monitoring context",
  },
];


const mostUsedGuides: Array<{
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
  badge: string;
}> = [
  {
    title: "Find a doctor and book appointment",
    body:
      "Patient guide for finding a suitable clinician, choosing a consultation time, preparing care context and joining an Ambulant+ appointment.",
    href: "/resources/find-a-doctor-and-book-appointment",
    icon: CalendarCheck,
    badge: "Patient access",
  },
  {
    title: "Health Monitor setup",
    body:
      "Prepare the supported Health Monitor for temperature, SpO₂, heart rate, blood pressure, blood glucose and ECG capture.",
    href: "/resources/health-monitor-setup",
    icon: HeartPulse,
    badge: "Remote vitals",
  },
  {
    title: "Digital Stethoscope workflow",
    body:
      "Use live heart and lung auscultation, recording, playback and follow-up comparison during device-supported virtual care.",
    href: "/resources/digital-stethoscope-workflow",
    icon: Stethoscope,
    badge: "Auscultation",
  },
  {
    title: "NexRing setup",
    body:
      "Set up the NexRing, select the right size, optimise wearing position and understand wearable trend context.",
    href: "/resources/nexring-setup",
    icon: Watch,
    badge: "Wearable context",
  },
  {
    title: "HD Otoscope workflow",
    body:
      "Use remote image capture carefully for clinician-led ear, nose, throat and skin review with clear escalation boundaries.",
    href: "/resources/hd-otoscope-workflow",
    icon: Ear,
    badge: "Remote imaging",
  },
  {
    title: "Medical Aid Deployment Guide",
    body:
      "Plan medical-aid, HMO, employer or sponsor programmes around consent, monitoring, adherence, claims and preventive-care visibility.",
    href: "/resources/medical-aid-deployment-guide",
    icon: Building2,
    badge: "Payer deployment",
  },
];

const resourceFilters = [
  {
    label: "For patients",
    href: "/patients",
    description: "Doctor booking, profile setup, device readiness and care continuity.",
    icon: Users,
  },
  {
    label: "For clinicians",
    href: "/clinicians",
    description: "Onboarding, consultation discipline, device-supported review and escalation.",
    icon: Stethoscope,
  },
  {
    label: "For medical aids",
    href: "/clients",
    description: "Preventive-care programmes, claims visibility, adherence and member monitoring.",
    icon: Building2,
  },
  {
    label: "For labs",
    href: "/medreach/labs",
    description: "Catalogue setup, specimen acceptance, result routing and MedReach operations.",
    icon: TestTube2,
  },
  {
    label: "For pharmacies",
    href: "/careport/pharmacies",
    description: "Prescription fulfilment, SKU readiness, proof-of-delivery and CarePort workflow.",
    icon: Store,
  },
  {
    label: "For riders",
    href: "/careport/riders",
    description: "Delivery rules, route progression, patient updates and proof-of-delivery.",
    icon: Truck,
  },
];

const resourceTrustPrinciples: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "Open public education",
    body:
      "Core explainers, setup guidance and safety boundaries remain publicly accessible so patients, clinicians and partners can understand Contactless Medicine before they commit.",
    icon: BookOpen,
  },
  {
    title: "Controlled implementation assets",
    body:
      "Downloadable handbooks, onboarding packs and operational playbooks may require newsletter signup, workspace registration or programme enquiry so users receive the correct version.",
    icon: LockKeyhole,
  },
  {
    title: "Clinician-led care workflows",
    body:
      "Device data, diagnostic requests, pharmacy fulfilment, programme analytics and AI-assisted insights remain governed by consent, role permissions and clinical judgement.",
    icon: ShieldCheck,
  },
];

const publishingRoadmap: Array<{
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: LucideIcon;
}> = [
  {
    title: "Patient handbook",
    body:
      "A practical guide to profile setup, doctor booking, device readiness, records, CarePort fulfilment, MedReach diagnostics and safe remote-care expectations.",
    href: "/patients/getting-started",
    cta: "View patient guide",
    icon: Users,
  },
  {
    title: "Clinician handbook",
    body:
      "Onboarding, consultation standards, device-supported review, documentation discipline, escalation boundaries and Contactless Medicine practice expectations.",
    href: "/clinicians/onboarding",
    cta: "Start onboarding",
    icon: BriefcaseMedical,
  },
  {
    title: "Medical-aid deployment PDF",
    body:
      "Programme design, consent, eligibility, member streaming, adherence visibility, claims workflows, reporting, rewards and preventive-care intelligence.",
    href: "/resources/medical-aid-deployment-guide",
    cta: "Open guide",
    icon: Building2,
  },
  {
    title: "Device quick sheets",
    body:
      "One-page setup sheets for Health Monitor, Digital Stethoscope, HD Otoscope and NexRing, prepared for patients, clinicians and support teams.",
    href: "/contact?type=device-resource-pack",
    cta: "Request pack",
    icon: Download,
  },
  {
    title: "CarePort pharmacy playbook",
    body:
      "Pharmacy onboarding, SKU readiness, eRx fulfilment, rider handover, proof-of-delivery, adherence support and promotional placement guidance.",
    href: "/careport/pharmacies",
    cta: "View pharmacy path",
    icon: Pill,
  },
  {
    title: "MedReach lab onboarding pack",
    body:
      "Lab catalogue setup, specimen acceptance, phlebotomy coordination, chain-of-custody visibility, result routing and programme reporting.",
    href: "/medreach/labs",
    cta: "View lab path",
    icon: TestTube2,
  },
];

const searchAnswerQuestions: Array<{
  question: string;
  answer: string;
  href: string;
}> = [
  {
    question: "What is Contactless Medicine?",
    answer:
      "Contactless Medicine is clinician-led remote care supported by connected medical devices, structured patient context, diagnostics, medicine fulfilment, adherence workflows and governance-aware intelligence.",
    href: "/blog/what-is-contactless-medicine",
  },
  {
    question: "How is Contactless Medicine different from telemedicine?",
    answer:
      "Telemedicine usually connects a patient and clinician by video or phone. Contactless Medicine connects the wider care workflow, including vitals, devices, diagnostics, prescriptions, adherence, records and programme visibility.",
    href: "/blog/contactless-medicine-vs-telemedicine",
  },
  {
    question: "How do I find a doctor online?",
    answer:
      "Patients can use Ambulant+ to access a protected patient workspace, search available clinicians, choose appointment times, prepare care context and join a virtual consultation.",
    href: "/resources/find-a-doctor-and-book-appointment",
  },
  {
    question: "How do I prepare for a virtual consultation?",
    answer:
      "Prepare symptoms, medication history, allergies, previous reports, a private space, stable internet and any supported devices requested for the consultation.",
    href: "/patients/getting-started",
  },
  {
    question: "What devices does Ambulant+ support?",
    answer:
      "Ambulant+ focuses on Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows for remote vitals, auscultation, selected imaging and wearable health context.",
    href: "/devices",
  },
  {
    question: "Can I use a Digital Stethoscope during remote consultation?",
    answer:
      "Yes, where supported and clinically appropriate. The Digital Stethoscope can support live heart and lung auscultation, recording, playback and follow-up comparison under clinician-led review.",
    href: "/resources/digital-stethoscope-workflow",
  },
  {
    question: "Can medical aids use Ambulant+ for remote patient monitoring?",
    answer:
      "Yes. Medical aids, HMOs, employers and sponsors can use Ambulant+ for member monitoring, adherence visibility, preventive-care workflows, programme analytics, claims readiness and InsightCore intelligence.",
    href: "/resources/medical-aid-deployment-guide",
  },
  {
    question: "How does CarePort support medicine delivery?",
    answer:
      "CarePort supports eRx fulfilment, pharmacy readiness, patient updates, rider dispatch, proof-of-delivery and medication-continuity workflows.",
    href: "/careport",
  },
  {
    question: "How does MedReach support home diagnostics?",
    answer:
      "MedReach supports home phlebotomy, specimen collection, laboratory handover, chain-of-custody visibility and result-routing workflows.",
    href: "/medreach",
  },
  {
    question: "Do Ambulant+ devices replace a clinician?",
    answer:
      "No. Supported devices provide clinical context. Readings, recordings and images must be interpreted by an appropriate clinician and do not replace emergency care or professional judgement.",
    href: "/clinical-disclaimer",
  },
];

const learningTracks = [
  {
    title: "Contactless Medicine foundation",
    body:
      "The operating principles behind Ambulant+: clinician-led remote care supported by connected devices, diagnostics, medicine fulfilment, governed workflows and consent-aware intelligence.",
  },
  {
    title: "Clinical safety and escalation",
    body:
      "When remote care is appropriate, when urgent care is required, how to document device-supported review and how to preserve professional clinical judgement.",
  },
  {
    title: "Device-supported workflows",
    body:
      "How supported devices fit into the consultation journey: vitals capture, auscultation, otoscopy, wearable trends, follow-up comparison and clinical context.",
  },
  {
    title: "Programme and payer operations",
    body:
      "How medical aids, HMOs, employers and sponsors can use eligibility, rewards, adherence, claims visibility and remote monitoring responsibly.",
  },
];

const contentRoadmap = [
  "Patient quick-start guide",
  "Clinician onboarding guide",
  "Contactless Medicine compliance training overview",
  "Health Monitor setup guide",
  "Digital Stethoscope workflow guide",
  "HD Otoscope workflow guide",
  "NexRing wearing and sizing guide",
  "Medication reminders and camera verification guide",
  "MedReach home phlebotomy guide",
  "CarePort pharmacy fulfilment guide",
  "Medical-aid programme deployment guide",
  "Enterprise demo preparation checklist",
];

const downloadablePacks: Array<{
  title: string;
  body: string;
  gate: string;
  cta: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "Patient Quick-Start Pack",
    body:
      "Profile completion, supported devices, doctor booking, reminders, reports, MedReach diagnostics and CarePort delivery readiness.",
    gate: "Patient workspace signup or login",
    cta: "Access patient workspace",
    href: site.patientAppUrl,
    icon: Users,
  },
  {
    title: "Clinician Onboarding Pack",
    body:
      "Contactless Medicine standards, consultation readiness, device-supported review, documentation and escalation boundaries.",
    gate: "Clinician onboarding required",
    cta: "Start clinician onboarding",
    href: "/clinicians/onboarding",
    icon: BriefcaseMedical,
  },
  {
    title: "Device Setup Sheets",
    body:
      "Health Monitor, Digital Stethoscope, HD Otoscope and NexRing setup notes prepared for patients, clinicians and support teams.",
    gate: "Newsletter or training enquiry",
    cta: "Request device setup pack",
    href: "/contact?type=device-resource-pack",
    icon: Download,
  },
  {
    title: "Medical Aid Deployment Guide",
    body:
      "Programme eligibility, member onboarding, consent, remote monitoring, adherence visibility, rewards and preventive-care reporting.",
    gate: "Client demo or programme enquiry",
    cta: "Request deployment pack",
    href: "/demos?type=medical-aid",
    icon: Building2,
  },
  {
    title: "Operations Playbooks",
    body:
      "MedReach diagnostics, CarePort fulfilment, pharmacy handover, rider proof-of-delivery and laboratory result routing.",
    gate: "Role-specific workspace or partner enquiry",
    cta: "Request operations pack",
    href: "/contact?type=operations-playbook",
    icon: ClipboardCheck,
  },
  {
    title: "Training and Demo Packs",
    body:
      "Demo preparation, CPD pathways, webinar topics, implementation walkthroughs and stakeholder-specific training modules.",
    gate: "Training enquiry or verified programme interest",
    cta: "Ask about training",
    href: "/demos",
    icon: GraduationCap,
  },
];

const governanceNotes = [
  "Resources should support safe use, not encourage self-diagnosis.",
  "Device guides should remain tied to the exact supported Ambulant+ device scope.",
  "Clinical resources must preserve professional judgement and escalation boundaries.",
  "Payer resources must respect consent, role permissions and appropriate data-sharing limits.",
  "Medication adherence visibility should be framed as support and continuity, not punishment.",
  "Emergency symptoms should always be directed to appropriate urgent or emergency services.",
];



const resourcesJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Ambulant+ Resources",
  headline: "Knowledge infrastructure for Contactless Medicine",
  description: metadata.description,
  url: absoluteUrl("/resources"),
  inLanguage: "en-ZA",
  publisher: {
    "@type": "Organization",
    name: "Ambulant+",
    url: site.url,
  },
  about: [
    "Contactless Medicine",
    "remote patient monitoring",
    "remote monitoring",
    "continuous remote monitoring",
    "remote vitals",
    "IoMT",
    "Internet of Medical Things",
    "digital auscultation",
    "digital stethoscope",
    "HD otoscope",
    "NexRing",
    "medical aid preventive care",
    "CarePort",
    "MedReach",
    "doctor booking",
    "online doctor",
    "virtual consultation",
  ],
  mainEntity: {
    "@type": "ItemList",
    itemListElement: mostUsedGuides.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: absoluteUrl(item.href),
    })),
  },
};

const resourcesFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: searchAnswerQuestions.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
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
      name: "Resources",
      item: absoluteUrl("/resources"),
    },
  ],
};

export default function ResourcesPage() {
  return (
    <main>
      <Script
        id="resources-collection-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resourcesJsonLd) }}
      />
      <Script
        id="resources-faq-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(resourcesFaqJsonLd) }}
      />
      <Script
        id="resources-breadcrumb-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="relative isolate overflow-hidden px-4 py-14 md:px-6 md:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute right-[8%] top-[18%] h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
              Resources
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              Knowledge infrastructure for Contactless Medicine.
            </h1>

            <p className="mt-6 text-lg leading-9 text-slate-600">
              Ambulant+ resources help patients, clinicians, medical aids, employers,
              laboratories, pharmacies, riders and programme teams understand how to use
              Contactless Medicine safely, operationally and responsibly.
            </p>

            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600">
              This library brings together remote patient monitoring guidance, IoMT device
              setup notes, digital auscultation workflows, home diagnostics operations,
              prescription fulfilment, adherence support, payer visibility and governance-aware
              implementation knowledge.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demos"
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
              >
                Request guided walkthrough <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href={`mailto:${site.trainingEmail}`}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white px-6 py-4 text-sm font-semibold text-cyan-800 shadow-sm"
              >
                Ask about training <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="glass-panel rounded-[36px] p-5 shadow-glow">
            <div className="rounded-[30px] border border-white/80 bg-white/80 p-5">
              <div className="aspect-[1.15/1] overflow-hidden rounded-[26px] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
                      Resource library
                    </div>
                    <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight">
                      From setup to safe clinical operations.
                    </h2>
                  </div>
                  <BookOpen className="h-9 w-9 text-cyan-200" />
                </div>

                <div className="mt-6 grid gap-3">
                  {[
                    "Patient and clinician onboarding",
                    "IoMT device workflow guidance",
                    "Remote monitoring and vitals interpretation support",
                    "Diagnostics, pharmacy and payer operations",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4"
                    >
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-200" />
                      <span className="text-sm leading-6 text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {["Guides", "Training", "Playbooks"].map((item) => (
                  <div key={item} className="rounded-2xl bg-cyan-50 p-4 text-center">
                    <div className="text-sm font-semibold text-slate-950">{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Resource philosophy"
        title="Open guidance. Controlled implementation. Safer onboarding."
        body="The Ambulant+ resource library is designed to educate openly while routing role-specific downloads and implementation materials into the right workspace, enquiry or onboarding pathway."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {resourceTrustPrinciples.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="glass-panel rounded-[30px] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-8 text-slate-600">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Most used guides"
        title="Start with the most requested Ambulant+ guides."
        body="Quick access to the guides patients, clinicians, medical aids and device-supported care teams are most likely to need first."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mostUsedGuides.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">
                    {item.badge}
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  Open guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>


      <SectionShell
        eyebrow="Find resources by role"
        title="Choose the pathway that matches your work."
        body="Patients, clinicians, labs, pharmacies, riders, medical aids and enterprise partners need different guidance. Start with the role that matches your next task."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceFilters.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className="group rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-glow"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-950">{item.label}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600">{item.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  View pathway <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Resource collections"
        title="Guidance organised by workflow."
        body="Each resource collection supports a practical Ambulant+ workflow: patient access, clinician practice, connected devices, diagnostics, pharmacy fulfilment, payer programmes and governance."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resourceCollections.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group glass-panel rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  Open resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Device setup"
        title="Set up supported devices with confidence."
        body="Use the official Ambulant+ setup and workflow guides for Health Monitor, Digital Stethoscope, HD Otoscope and NexRing before using connected devices in care workflows."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {deviceSetupGuides.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group glass-panel overflow-hidden rounded-[34px] transition hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="grid gap-0 md:grid-cols-[0.74fr_1.26fr]">
                  <div className="relative min-h-[220px] bg-gradient-to-br from-cyan-50 to-white">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 360px"
                      className="object-contain p-6 transition duration-500 group-hover:scale-105"
                    />
                  </div>

                  <div className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">
                          {item.eyebrow}
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                          {item.title}
                        </h3>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-8 text-slate-600">{item.body}</p>

                    <div className="mt-5 grid gap-3">
                      {item.bullets.map((bullet) => (
                        <div key={bullet} className="flex gap-3 text-sm leading-7 text-slate-600">
                          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                      View setup guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Audience guides"
        title="Start with the role you play in the ecosystem."
        body="Patients, clinicians, labs, phlebotomists, pharmacies, riders and enterprise partners need different resource paths."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {audienceGuides.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[28px] border border-white/80 bg-white/78 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
              >
                <Icon className="h-6 w-6 text-cyan-700" />
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="overflow-hidden rounded-[36px] bg-slate-950 p-6 text-white shadow-glow md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">
                Learning tracks
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
                Training should make the platform safer, not just easier to use.
              </h2>
              <p className="mt-5 text-sm leading-8 text-slate-300">
                Ambulant+ training resources are designed to support safer workflows, clearer
                escalation, better device use, cleaner documentation and more consistent
                role-specific onboarding.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {["Remote care", "IoMT", "Governance", "Operations"].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {learningTracks.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                  <BookOpen className="h-5 w-5 text-cyan-200" />
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Publishing roadmap"
        title="A growing knowledge base for Contactless Medicine."
        body="Ambulant+ resources will expand into downloadable guides, onboarding packs, training modules, videos, operational playbooks and partner implementation material."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {contentRoadmap.map((item) => (
            <div key={item} className="flex gap-3 rounded-3xl border border-white/80 bg-white/78 p-5">
              <FileText className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
              <p className="text-sm leading-7 text-slate-600">{item}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[34px] border border-cyan-100 bg-cyan-50/70 p-6 md:p-8">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">
            Publishing next
          </div>

          <h3 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            The next resource releases should support real-world onboarding.
          </h3>

          <p className="mt-4 max-w-4xl text-sm leading-8 text-slate-600 md:text-base">
            These planned resources will help patients, clinicians, medical aids, laboratories,
            pharmacies and operations teams move from interest to safe, role-appropriate use.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publishingRoadmap.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[26px] bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-glow"
                >
                  <Icon className="h-6 w-6 text-cyan-700" />

                  <h4 className="mt-4 text-lg font-semibold text-slate-950">
                    {item.title}
                  </h4>

                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {item.body}
                  </p>

                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                    {item.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Downloadable library"
        title="Downloadable packs for verified users and programme partners."
        body="Public guides remain open. Downloadable handbooks, training packs and implementation playbooks may require newsletter signup, workspace registration or programme enquiry so each user receives the correct role-specific guidance."
      >
        <div className="mb-6 rounded-[30px] border border-cyan-100 bg-cyan-50/70 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">
                <LockKeyhole className="h-4 w-4" />
                Gated downloads
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                Open knowledge. Controlled implementation. Role-appropriate delivery.
              </h3>
              <p className="mt-3 max-w-4xl text-sm leading-8 text-slate-600">
                General education should be easy to access. Role-specific handbooks and deployment
                packs should route users into the right Ambulant+ workspace or enquiry path before
                download, so patients, clinicians, labs, pharmacies, riders and medical-aid teams
                receive the correct guidance.
              </p>
            </div>
            <a
              href={`mailto:${site.supportEmail}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
            >
              Request resource access <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {downloadablePacks.map((item) => {
            const Icon = item.icon;
            const isExternal = item.href.startsWith("http");

            const card = (
              <div className="glass-panel h-full rounded-[30px] p-6 transition hover:-translate-y-1 hover:shadow-glow">
                <div className="flex items-start justify-between gap-4">
                  <Icon className="h-6 w-6 text-cyan-700" />
                  <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-800">
                    Controlled access
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>

                <div className="mt-5 rounded-2xl bg-white/80 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Access route
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{item.gate}</p>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                  {item.cta} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            );

            if (isExternal) {
              return (
                <a key={item.title} href={item.href} target="_blank" rel="noreferrer">
                  {card}
                </a>
              );
            }

            return (
              <Link key={item.title} href={item.href}>
                {card}
              </Link>
            );
          })}
        </div>
      </SectionShell>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-[0.95fr_1.05fr] md:px-6 md:py-16">
        <div className="glass-panel rounded-[34px] p-7">
          <GraduationCap className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Training, demos, CPDs and webinars
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            Ambulant+ resources can support structured training for clinicians, programme teams,
            laboratories, pharmacies, riders and enterprise partners. Demo sessions should be tied
            to implementation planning, not superficial product tours.
          </p>
          <div className="mt-5 grid gap-3">
            {[
              "Contactless Medicine foundation training",
              "Device-supported consultation training",
              "Medical-aid and sponsor programme walkthroughs",
              "CarePort, MedReach and operations readiness sessions",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Link
            href="/demos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-glow"
          >
            View demos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass-panel rounded-[34px] p-7">
          <ShieldCheck className="h-8 w-8 text-cyan-700" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
            Governance notes
          </h2>
          <div className="mt-5 grid gap-3">
            {governanceNotes.map((item) => (
              <div key={item} className="flex gap-3 text-sm leading-7 text-slate-600">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionShell
        eyebrow="Search visibility"
        title="Answers built for patients, partners and AI search."
        body="These questions help users and search engines understand how Ambulant+ supports remote care, doctor booking, connected devices, medical aids, pharmacy fulfilment and diagnostics."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {searchAnswerQuestions.map((item) => (
            <Link
              key={item.question}
              href={item.href}
              className="group rounded-[28px] border border-cyan-100 bg-cyan-50/70 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-glow"
            >
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                {item.question}
              </h3>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                {item.answer}
              </p>

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                Read answer <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </SectionShell>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}