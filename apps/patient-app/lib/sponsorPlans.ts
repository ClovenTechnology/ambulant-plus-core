export type SponsorType = "MEDICAL_AID" | "HMO" | "CORPORATE_SPONSOR";

export type SponsorPlan = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorType: SponsorType;
  name: string;
  priceLabel: string;
  summary: string;
  tags: string[];
};

export const SPONSOR_PLANS: SponsorPlan[] = [
  {
    id: "plan-demo-comprehensive-plus",
    sponsorId: "client-demo-medical-aid",
    sponsorName: "Ambulant Demo Medical Aid",
    sponsorType: "MEDICAL_AID",
    name: "Comprehensive Plus Option",
    priceLabel: "Demo pricing",
    summary:
      "Medical Aid option for virtual consults, chronic medicine, pathology, pregnancy visibility, wellness rewards, and claims flow.",
    tags: ["Medical Aid", "Claims", "Rewards", "Pre-auth"],
  },
  {
    id: "hmo-primary-care-plus",
    sponsorId: "hmo-demo-primary-care",
    sponsorName: "Ambulant Demo HMO",
    sponsorType: "HMO",
    name: "Primary Care Plus",
    priceLabel: "Employer/HMO priced",
    summary:
      "HMO-style primary-care package for visits, chronic care, medication adherence, and monitored referrals.",
    tags: ["HMO", "Primary care", "Referrals"],
  },
  {
    id: "corp-workforce-wellness",
    sponsorId: "corp-demo-workforce",
    sponsorName: "Demo Corporate Sponsor",
    sponsorType: "CORPORATE_SPONSOR",
    name: "Workforce Wellness & Chronic Care",
    priceLabel: "Sponsor funded",
    summary:
      "Corporate sponsor programme for eligible employees and dependants, wellness rewards, adherence signals, and managed claims.",
    tags: ["Corporate", "Employees", "Wellness"],
  },
];

export function sponsorTypeLabel(type: SponsorType | string) {
  return String(type || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}