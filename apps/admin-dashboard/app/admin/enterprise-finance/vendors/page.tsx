import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Vendors",
    description:
      "Review registered vendors, approval state, payout eligibility and public registration submissions before payment workflows are enabled.",
    endpoint: "vendors",
    responseKey: "vendors",
    emptyText: "No vendors have been registered yet.",
    columns: [
      { key: "legalName", label: "Legal name" },
      { key: "tradingName", label: "Trading name" },
      { key: "status", label: "Status" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "payoutEligible", label: "Payout eligible", bool: true },
    ],
  });
}
