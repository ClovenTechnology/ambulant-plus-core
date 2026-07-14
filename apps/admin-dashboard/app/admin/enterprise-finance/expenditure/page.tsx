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
    actionTitle: "Expenditure workflow actions",
    actionIntro:
      "Create, approve and mark expenditure entries as paid while preserving proof-of-payment controls.",
    actions: [
      {
        label: "Create expenditure",
        method: "POST",
        action: "create_expenditure",
        description: "Record a new unpaid expenditure ledger entry.",
        template: {
          vendorId: "vendor_id_here",
          narration: "Operational purchase",
          amount: 1000,
          category: "operations",
          occurredAt: "2026-07-14"
        }
      },
      {
        label: "Record paid expenditure",
        method: "POST",
        action: "record_paid_expenditure",
        description: "Record an already-paid expenditure with payment proof/reference fields.",
        template: {
          vendorId: "vendor_id_here",
          narration: "Paid supplier invoice",
          amount: 1000,
          paymentMethod: "bank_transfer",
          paymentReference: "BANK-REFERENCE",
          proofOfPaymentUrl: "https://example.com/proof.pdf"
        }
      },
      {
        label: "Approve expenditure",
        method: "PATCH",
        action: "approve_expenditure",
        description: "Approve a pending expenditure entry.",
        template: {
          id: "expenditure_entry_id_here"
        }
      },
      {
        label: "Mark expenditure paid",
        method: "PATCH",
        action: "mark_expenditure_paid",
        description: "Mark approved expenditure as paid with proof/reference.",
        template: {
          id: "expenditure_entry_id_here",
          paymentReference: "BANK-REFERENCE",
          proofOfPaymentUrl: "https://example.com/proof.pdf"
        }
      }
    ]
  });
}