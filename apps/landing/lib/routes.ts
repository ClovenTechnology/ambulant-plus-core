import {
  Activity,
  BadgeCheck,
  Baby,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardCheck,
  Ear,
  FlaskConical,
  HeartPulse,
  Lightbulb,
  LockKeyhole,
  Moon,
  Network,
  Newspaper,
  ShieldCheck,
  Stethoscope,
  Truck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";

export const navLinks = [
  { label: "Platform", href: "/platform" },
  { label: "Features", href: "/features" },
  { label: "Patients", href: "/patients" },
  { label: "Clinicians", href: "/clinicians" },
  { label: "MedReach", href: "/medreach" },
  { label: "CarePort", href: "/careport" },
  { label: "InsightCore", href: "/insightcore" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const utilityLinks = [
  { label: "For Patients", href: "/patients", icon: UserRound },
  { label: "For Clinicians", href: "/clinicians", icon: Stethoscope },
  { label: "For Partners", href: "/clients", icon: UsersRound },
  { label: "Support", href: "/contact", icon: CircleHelp },
  { label: "Resources", href: "/resources", icon: ClipboardCheck },
];

export const groupedNav = [
  {
    label: "Platform",
    href: "/platform",
    columns: [
      {
        title: "Overview",
        links: [
          { label: "Platform", href: "/platform", icon: Network },
          { label: "Features", href: "/features", icon: Activity },
          { label: "Devices", href: "/devices", icon: Activity },
          { label: "InsightCore", href: "/insightcore", icon: Activity },
        ],
      },
      {
        title: "Strategy",
        links: [
          { label: "Innovation", href: "/innovation", icon: Lightbulb },
          {
            label: "Research & Development",
            href: "/research-and-development",
            icon: FlaskConical,
          },
          { label: "Ecosystem", href: "/ecosystem", icon: Building2 },
          { label: "Use Cases", href: "/use-cases", icon: ClipboardCheck },
        ],
      },
    ],
  },
  {
    label: "Solutions",
    href: "/features",
    columns: [
      {
        title: "For Individuals",
        links: [
          { label: "Patients", href: "/patients", icon: UserRound },
          {
            label: "Getting Started",
            href: "/patients/getting-started",
            icon: ClipboardCheck,
          },
          { label: "Clinicians", href: "/clinicians", icon: Stethoscope },
          { label: "Devices", href: "/devices", icon: Activity },
        ],
      },
      {
        title: "Care Centres",
        links: [
          {
            label: "Ladies’ Health",
            href: "/centres/ladies-health",
            icon: HeartPulse,
          },
          { label: "Paediatric", href: "/centres/paediatric", icon: Baby },
          { label: "Antenatal", href: "/centres/antenatal", icon: HeartPulse },
          {
            label: "Gentlemen’s Health",
            href: "/centres/gentlemens-health",
            icon: UserRound,
          },
        ],
      },
      {
        title: "Daily Health",
        links: [
          { label: "Reminders", href: "/features#daily-health", icon: BellRing },
          { label: "Self-Check", href: "/features#self-check", icon: ClipboardCheck },
          {
            label: "Health Passport",
            href: "/features#health-passport",
            icon: WalletCards,
          },
          {
            label: "NexRing Sleep & Activity",
            href: "/features#daily-health",
            icon: Moon,
          },
        ],
      },
      {
        title: "Services",
        links: [
          { label: "MedReach Diagnostics", href: "/medreach", icon: FlaskConical },
          { label: "CarePort Fulfilment", href: "/careport", icon: Truck },
          {
            label: "InsightCore Intelligence",
            href: "/insightcore",
            icon: Activity,
          },
          { label: "Bookings", href: "/bookings", icon: CalendarCheck },
        ],
      },
    ],
  },
  {
    label: "Operations",
    href: "/operations",
    columns: [
      {
        title: "MedReach",
        links: [
          { label: "Diagnostics Operations", href: "/medreach", icon: FlaskConical },
          { label: "Labs", href: "/medreach/labs", icon: Building2 },
          {
            label: "Phlebotomists",
            href: "/medreach/phlebotomists",
            icon: HeartPulse,
          },
        ],
      },
      {
        title: "CarePort",
        links: [
          { label: "Pharmacy Fulfilment", href: "/careport", icon: Truck },
          { label: "Pharmacies", href: "/careport/pharmacies", icon: Building2 },
          { label: "Riders", href: "/careport/riders", icon: Truck },
        ],
      },
    ],
  },
  {
    label: "Partners",
    href: "/partnerships",
    columns: [
      {
        title: "Partner Programmes",
        links: [
          { label: "Clients & Sponsors", href: "/clients", icon: BriefcaseBusiness },
          { label: "Partnerships", href: "/partnerships", icon: UsersRound },
          { label: "Demos", href: "/demos", icon: CalendarCheck },
        ],
      },
    ],
  },
  {
    label: "Trust",
    href: "/security",
    columns: [
      {
        title: "Governance",
        links: [
          { label: "Security", href: "/security", icon: LockKeyhole },
          { label: "Compliance", href: "/compliance", icon: BadgeCheck },
          {
            label: "Clinical Disclaimer",
            href: "/clinical-disclaimer",
            icon: ShieldCheck,
          },
          { label: "Privacy Policy", href: "/privacy", icon: LockKeyhole },
          {
            label: "Terms & Conditions",
            href: "/terms",
            icon: ClipboardCheck,
          },
          { label: "FAQ", href: "/faq", icon: CircleHelp },
        ],
      },
    ],
  },
  {
    label: "Resources",
    href: "/resources",
    columns: [
      {
        title: "Learn",
        links: [
          { label: "Blog", href: "/blog", icon: Newspaper },
          { label: "Resources", href: "/resources", icon: ClipboardCheck },
          {
            label: "Health Monitor Setup",
            href: "/resources/health-monitor-setup",
            icon: HeartPulse,
          },
          {
            label: "Digital Stethoscope Workflow",
            href: "/resources/digital-stethoscope-workflow",
            icon: Stethoscope,
          },
          {
            label: "HD Otoscope Workflow",
            href: "/resources/hd-otoscope-workflow",
            icon: Ear,
          },
          {
            label: "NexRing Setup",
            href: "/resources/nexring-setup",
            icon: Activity,
          },
          {
            label: "Medical Aid Deployment Guide",
            href: "/resources/medical-aid-deployment-guide",
            icon: Building2,
          },
          { label: "Find a Doctor / Book", href: "/resources/find-a-doctor-and-book-appointment", icon: CalendarCheck },
          { label: "Contact", href: "/contact", icon: CircleHelp },
        ],
      },
    ],
  },
  {
    label: "About",
    href: "/ecosystem",
    columns: [
      {
        title: "Cloven Technology Impilo",
        links: [
          { label: "Ecosystem", href: "/ecosystem", icon: Building2 },
          { label: "Innovation", href: "/innovation", icon: Lightbulb },
          {
            label: "Research & Development",
            href: "/research-and-development",
            icon: FlaskConical,
          },
          { label: "Contact", href: "/contact", icon: CircleHelp },
        ],
      },
    ],
  },
];

export const resourceRoutes = [
  {
    title: "Health Monitor setup",
    href: "/resources/health-monitor-setup",
    summary:
      "Setup guidance for supported remote vitals workflows including temperature, SpO₂, heart rate, blood pressure, blood glucose and ECG capture.",
    icon: HeartPulse,
  },
  {
    title: "Digital Stethoscope workflow",
    href: "/resources/digital-stethoscope-workflow",
    summary:
      "Workflow guidance for live remote auscultation, audio capture, playback, notes and follow-up comparison.",
    icon: Stethoscope,
  },
  {
    title: "HD Otoscope workflow",
    href: "/resources/hd-otoscope-workflow",
    summary:
      "Safe HD Otoscope workflow guidance for remote ear, nose, throat and skin image review.",
    icon: Ear,
  },
  {
    title: "NexRing setup",
    href: "/resources/nexring-setup",
    summary:
      "Setup and wearing guidance for supported wearable health context including sleep, activity and temperature-variation signals.",
    icon: Activity,
  },
  {
    title: "Medical Aid Deployment Guide",
    href: "/resources/medical-aid-deployment-guide",
    summary:
      "Deployment guidance for preventive care, remote monitoring, adherence, rewards, claims visibility and programme intelligence.",
    icon: Building2,
  },
  {
    title: "Find a doctor and book appointment",
    href: "/resources/find-a-doctor-and-book-appointment",
    summary:
      "Patient guide for finding a clinician, booking an appointment and preparing for virtual care.",
    icon: CalendarCheck,
  },
];

export const productRoutes = [
  {
    title: "Patient App",
    href: "/patients",
    externalKey: "patientAppUrl",
    icon: UserRound,
    summary:
      "A protected patient workspace for vitals, appointments, medication, reports, care-network actions and connected-device pathways.",
  },
  {
    title: "Clinician App",
    href: "/clinicians",
    externalKey: "clinicianAppUrl",
    icon: Stethoscope,
    summary:
      "A governed clinical workspace for virtual consultation, connected-device review, care documentation, follow-up and escalation.",
  },
  {
    title: "MedReach",
    href: "/medreach",
    externalKey: "medreachUrl",
    icon: HeartPulse,
    summary:
      "Diagnostics operations for home phlebotomy, specimen collection, laboratory coordination and result-routing workflows.",
  },
  {
    title: "CarePort",
    href: "/careport",
    externalKey: "careportUrl",
    icon: Truck,
    summary:
      "Pharmacy fulfilment and delivery-rider coordination for medicine dispatch, handover, tracking and proof-of-delivery.",
  },
  {
    title: "InsightCore",
    href: "/insightcore",
    externalKey: "clientAppUrl",
    icon: Activity,
    summary:
      "Governance-aware intelligence for programme visibility, operational reporting, service utilisation and workflow performance.",
  },
  {
    title: "Client App",
    href: "/clients",
    externalKey: "clientAppUrl",
    icon: Building2,
    summary:
      "Employer, scheme and sponsor visibility across programme performance, engagement trends and care-network operations.",
  },
  {
    title: "Admin Console",
    href: "/contact",
    externalKey: "adminUrl",
    icon: BriefcaseBusiness,
    summary:
      "Operational governance, onboarding, configuration, quality controls and platform-level administration.",
  },
];

export const trustPillars = [
  {
    title: "Privacy-led by design",
    icon: LockKeyhole,
    body:
      "Consent-aware sharing, role-based access, data minimisation, audit trails and careful handling of health-related information.",
  },
  {
    title: "Clinical governance",
    icon: ClipboardCheck,
    body:
      "Built around escalation boundaries, clinical documentation, safety disclaimers, care-team review and professional judgement.",
  },
  {
    title: "Defined device ecosystem",
    icon: Activity,
    body:
      "Focused on Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows rather than unsupported wearable sprawl.",
  },
  {
    title: "Compliance-aware posture",
    icon: BadgeCheck,
    body:
      "Careful regulatory language across POPIA, GDPR, HIPAA-aware, medical-device and deployment-governance contexts.",
  },
  {
    title: "Secure operations",
    icon: ShieldCheck,
    body:
      "Protected workspaces, authentication boundaries, deployment separation, operational logs and audit-friendly records.",
  },
  {
    title: "Human-centred support",
    icon: CircleHelp,
    body:
      "Clear education, onboarding, help pathways, escalation routes and accountable operational support across care workflows.",
  },
];

export const strategicRoutes = [
  {
    label: "Innovation",
    href: "/innovation",
    summary:
      "The Ambulant+ thesis for Contactless Medicine: device-supported care, home diagnostics, eRx adherence, medical-aid preflight and governed intelligence.",
  },
  {
    label: "Research & Development",
    href: "/research-and-development",
    summary:
      "Clinical workflow research, connected-device pathways, diagnostics operations, fulfilment logistics, patient navigation and governance design.",
  },
];