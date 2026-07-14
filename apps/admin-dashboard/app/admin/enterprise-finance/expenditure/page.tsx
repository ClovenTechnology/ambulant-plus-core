import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function ExpenditurePage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Expenditure ledger",
    description:
      "Review operating expenditure, vendor-bound payment entries, proof-of-payment backed bank payments and linked payout ledger records.",
    endpoint: "expenditure",
    responseKey: "entries",
    emptyText: "No expenditure ledger entries have been recorded yet.",
    columns: [
      { key: "occurredAt", label: "Date", date: true },
      { key: "vendorName", label: "Vendor" },
      { key: "narration", label: "Narration" },
      { key: "amountCents", label: "Amount", money: true },
      { key: "paymentStatus", label: "Payment" },
      { key: "status", label: "Status" },
    ],
  });
}
