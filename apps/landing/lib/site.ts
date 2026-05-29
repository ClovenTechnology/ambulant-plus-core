export const site = {
  name: "Ambulant+",
  legalName: "Ambulant+ Contactless Medicine",
  parentCompany: "Cloven Technology Impilo",
  tagline: "The operating layer for contactless medicine.",

  url: process.env.NEXT_PUBLIC_SITE_URL || "https://ambulantplus.co.za",

  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@cloventechnology.com",
  salesEmail:
    process.env.NEXT_PUBLIC_SALES_EMAIL || "hello@ambulantplus.co.za",

  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+27 69 669 0899",
  phoneHref:
    process.env.NEXT_PUBLIC_CONTACT_PHONE_HREF || "tel:+27696690899",

  address: {
    short: "0B Meadowbrook Lane, Epsom Downs, Bryanston 2152",
    full:
      "Cloven Technology Impilo, Block D FF, Saint Andrews Office Park, 0B Meadowbrook Lane, Epsom Downs, Bryanston 2152",
  },

  patientAppUrl:
    process.env.NEXT_PUBLIC_PATIENT_APP_URL ||
    "https://patient.ambulantplus.co.za",
  patientSignupUrl:
    process.env.NEXT_PUBLIC_PATIENT_SIGNUP_URL ||
    "https://patient.ambulantplus.co.za/auth/signup",

  clinicianAppUrl:
    process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
    "https://clinician.ambulantplus.co.za",
  clinicianSignupUrl:
    process.env.NEXT_PUBLIC_CLINICIAN_SIGNUP_URL ||
    "https://clinician.ambulantplus.co.za/auth/signup",

  medreachUrl:
    process.env.NEXT_PUBLIC_MEDREACH_URL ||
    "https://medreach.ambulantplus.co.za",
  medreachSignupUrl:
    process.env.NEXT_PUBLIC_MEDREACH_SIGNUP_URL ||
    "https://medreach.ambulantplus.co.za/auth/signup",

  careportUrl:
    process.env.NEXT_PUBLIC_CAREPORT_URL ||
    "https://careport.ambulantplus.co.za",
  careportSignupUrl:
    process.env.NEXT_PUBLIC_CAREPORT_SIGNUP_URL ||
    "https://careport.ambulantplus.co.za/auth/signup",

  clientAppUrl:
    process.env.NEXT_PUBLIC_CLIENT_APP_URL ||
    "https://clients.ambulantplus.co.za",
  adminUrl:
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    "https://admin.ambulantplus.co.za",

  nationalEngagementVideoUrl: "https://www.youtube.com/watch?v=hRRe7qLhcAA",

  brandFamily: [
    {
      name: "Ambulant+",
      role: "Contactless Medicine ecosystem",
      summary:
        "The core Contactless Medicine platform for patient access, clinician workflows, connected clinical devices, MedReach diagnostics, CarePort fulfilment and InsightCore intelligence.",
    },
    {
      name: "CarePort",
      role: "Pharmacy fulfilment operations",
      summary:
        "The Ambulant+ pharmacy and delivery-rider operations layer for medicine continuity, dispatch, handover, tracking and proof-of-delivery.",
    },
    {
      name: "MedReach",
      role: "Diagnostics operations",
      summary:
        "The Ambulant+ diagnostics operations layer for home phlebotomy, specimen collection, laboratory coordination and result-routing workflows.",
    },
    {
      name: "InsightCore",
      role: "Governance-aware intelligence",
      summary:
        "The Ambulant+ intelligence layer for programme visibility, operational reporting, adherence signals, risk trends and workflow performance.",
    },
    {
      name: "DueCare",
      role: "Broader IoMT device portfolio",
      summary:
        "Cloven Technology Impilo’s broader range of Internet of Medical Things devices beyond the devices currently integrated into Ambulant+.",
    },
    {
      name: "MediRun",
      role: "Hospital Management System",
      summary:
        "A Hospital Management System owned by Cloven Technology Impilo. MediRun is separate from the Ambulant+ Contactless Medicine ecosystem.",
    },
  ],
};

export const complianceNotice =
  "Ambulant+ is designed to support privacy, security, clinical-governance and operational-control workflows. Regulatory status depends on jurisdiction, device, module, intended use, operating entity and formal approvals. Do not claim approval, certification or clearance unless verified by official documentation.";