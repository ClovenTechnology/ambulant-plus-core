import {
  Activity,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CircleHelp,
  ClipboardCheck,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  Truck,
  UserRound,
} from "lucide-react";

export const navLinks = [
  { label: "Platform", href: "/platform" },
  { label: "Patients", href: "/patients" },
  { label: "Clinicians", href: "/clinicians" },
  { label: "MedReach", href: "/medreach" },
  { label: "CarePort", href: "/careport" },
  { label: "InsightCore", href: "/insightcore" },
  { label: "Partnerships", href: "/partnerships" },
  { label: "Contact", href: "/contact" },
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
    body: "Consent-aware sharing, role-based access, data minimisation, audit trails and careful handling of health-related information.",
  },
  {
    title: "Clinical governance",
    icon: ClipboardCheck,
    body: "Built around escalation boundaries, clinical documentation, safety disclaimers, care-team review and professional judgement.",
  },
  {
    title: "Defined device ecosystem",
    icon: Activity,
    body: "Focused on Health Monitor, Digital Stethoscope, HD Otoscope and NexRing workflows rather than unsupported wearable sprawl.",
  },
  {
    title: "Compliance-aware posture",
    icon: BadgeCheck,
    body: "Careful regulatory language across POPIA, GDPR, HIPAA-aware, medical-device and deployment-governance contexts.",
  },
  {
    title: "Secure operations",
    icon: ShieldCheck,
    body: "Protected workspaces, authentication boundaries, deployment separation, operational logs and audit-friendly records.",
  },
  {
    title: "Human-centred support",
    icon: CircleHelp,
    body: "Clear education, onboarding, help pathways, escalation routes and accountable operational support across care workflows.",
  },
];
