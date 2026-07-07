export type SponsorType = "MEDICAL_AID" | "HMO" | "CORPORATE_SPONSOR";

export type SponsorPlan = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorType: SponsorType;
  name: string;
  summary: string;
  priceLabel: string;
  tags: string[];
  benefits?: string[];
  ctaLabel?: string;
};

export const SPONSOR_PLANS: SponsorPlan[] = [];

export function sponsorTypeLabel(type: SponsorType | string) {
  switch (type) {
    case "MEDICAL_AID": return "Medical Aid";
    case "HMO": return "HMO";
    case "CORPORATE_SPONSOR": return "Corporate Sponsor";
    default: return "Sponsor";
  }
}
