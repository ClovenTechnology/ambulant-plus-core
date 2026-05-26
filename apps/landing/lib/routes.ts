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
  { label: "Patients", href: "/patients" },
  { label: "Clinicians", href: "/clinicians" },
  { label: "CarePort", href: "/careport" },
  { label: "MedReach", href: "/medreach" },
  { label: "Clients", href: "/clients" },
  { label: "Devices", href: "/devices" },
  { label: "Security", href: "/security" },
  { label: "FAQ", href: "/faq" },
];

export const productRoutes = [
  {
    title: "Patient App",
    href: "/patients",
    externalKey: "patientAppUrl",
    icon: UserRound,
    summary: "A connected personal health command centre for vitals, medication, appointments and longitudinal care."
  },
  {
    title: "Clinician App",
    href: "/clinicians",
    externalKey: "clinicianAppUrl",
    icon: Stethoscope,
    summary: "Remote clinical workflow, patient records, device-supported virtual consultations and care-team coordination."
  },
  {
    title: "CarePort",
    href: "/careport",
    externalKey: "careportUrl",
    icon: Truck,
    summary: "Pharmacy and delivery-rider coordination for medicine fulfilment, dispatch, proof of delivery and patient handover."
  },
  {
    title: "MedReach",
    href: "/medreach",
    externalKey: "medreachUrl",
    icon: HeartPulse,
    summary: "Eligibility, access and care-programme operations for outreach, payer workflows and population-health programmes."
  },
  {
    title: "Client App",
    href: "/clients",
    externalKey: "clientAppUrl",
    icon: Building2,
    summary: "Employer, scheme and sponsor visibility across adherence, access, benefits and care-network performance."
  },
  {
    title: "Admin Console",
    href: "/contact",
    externalKey: "adminUrl",
    icon: BriefcaseBusiness,
    summary: "Operational governance, onboarding, configuration, quality controls and platform-level administration."
  }
];

export const trustPillars = [
  { title: "Privacy-led by design", icon: LockKeyhole, body: "Consent-aware sharing, role-based access, audit trails and data minimisation principles." },
  { title: "Clinical governance", icon: ClipboardCheck, body: "Built around escalation, safety disclaimers, documented workflows and care-team review." },
  { title: "Connected-care ready", icon: Activity, body: "Designed for supported health monitors, stethoscope, otoscope and ring-based monitoring workflows." },
  { title: "Compliance-aware", icon: BadgeCheck, body: "Clear regulatory boundaries and careful wording across POPIA, GDPR, HIPAA-aware and device-governance contexts." },
  { title: "Secure operations", icon: ShieldCheck, body: "Deployment-ready architecture for authentication, protected routes, logs and environment-based configuration." },
  { title: "Human support", icon: CircleHelp, body: "Clear patient education, help pathways, escalation routes and operational support." }
];
