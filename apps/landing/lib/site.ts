export const site = {
  name: "Ambulant+",
  legalName: "Ambulant+ Contactless Medicine",
  parentCompany: "Cloven Technology Impilo",
  tagline: "The operating layer for contactless medicine.",

  url: process.env.NEXT_PUBLIC_SITE_URL || "https://ambulantplus.co.za",

  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@cloventechnology.com",
  salesEmail: process.env.NEXT_PUBLIC_SALES_EMAIL || "hello@ambulantplus.co.za",

  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+27 69 669 0899",
  phoneHref: process.env.NEXT_PUBLIC_CONTACT_PHONE_HREF || "tel:+27696690899",

  address: {
    short: "0B Meadowbrook Lane, Epsom Downs, Bryanston 2152",
    full:
      "Cloven Technology Impilo, Block D FF, Saint Andrews Office Park, 0B Meadowbrook Lane, Epsom Downs, Bryanston 2152",
  },

  patientAppUrl: process.env.NEXT_PUBLIC_PATIENT_APP_URL || "https://patient.ambulantplus.co.za",
  clinicianAppUrl: process.env.NEXT_PUBLIC_CLINICIAN_APP_URL || "https://clinician.ambulantplus.co.za",
  medreachUrl: process.env.NEXT_PUBLIC_MEDREACH_URL || "https://medreach.ambulantplus.co.za",
  careportUrl: process.env.NEXT_PUBLIC_CAREPORT_URL || "https://careport.ambulantplus.co.za",
  clientAppUrl: process.env.NEXT_PUBLIC_CLIENT_APP_URL || "https://clients.ambulantplus.co.za",
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.ambulantplus.co.za",

  nationalEngagementVideoUrl: "https://www.youtube.com/watch?v=hRRe7qLhcAA",

  brandFamily: [
    {
      name: "Ambulant+",
      summary:
        "Contactless Medicine ecosystem for patient access, clinician workflows, connected devices, diagnostics, fulfilment and governance-aware intelligence.",
    },
    {
      name: "CarePort",
      summary:
        "Pharmacy fulfilment and delivery-rider operations for medicine continuity, handover, tracking and proof-of-delivery.",
    },
    {
      name: "MedReach",
      summary:
        "Diagnostics operations for home phlebotomy, specimen collection, laboratory coordination and result-routing workflows.",
    },
    {
      name: "InsightCore",
      summary:
        "Governance-aware intelligence for programme visibility, operational reporting and workflow performance.",
    },
    {
      name: "DueCare",
      summary:
        "Cloven Technology Impilo’s broader Internet of Medical Things range beyond the devices integrated into Ambulant+.",
    },
    {
      name: "MediRun",
      summary:
        "Hospital Management System owned by Cloven Technology Impilo. MediRun is separate from the Ambulant+ Contactless Medicine ecosystem.",
    },
  ],
};

export const complianceNotice =
  "Ambulant+ is designed to support privacy, security, clinical-governance and operational-control workflows. Regulatory status depends on jurisdiction, device, module, intended use, operating entity and formal approvals. Do not claim approval, certification or clearance unless verified by official documentation.";
