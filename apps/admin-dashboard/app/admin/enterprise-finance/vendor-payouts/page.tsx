import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function VendorPayoutsPage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Vendor payouts",
    description:
      "Review scheduled vendor payouts, Paystack transfer readiness, paid vendor payments and linked expenditure entries.",
    endpoint: "vendor-payouts",
    responseKey: "payouts",
    emptyText: "No vendor payouts have been scheduled yet.",
    columns: [
      { key: "vendorName", label: "Vendor" },
      { key: "amountCents", label: "Amount", money: true },
      { key: "status", label: "Status" },
      { key: "payoutMethod", label: "Method" },
      { key: "paymentProvider", label: "Provider" },
      { key: "paidAt", label: "Paid", date: true },
    ],
  });
}
