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
    actionTitle: "Vendor payout workflow actions",
    actionIntro:
      "Schedule, approve and record vendor payouts with Paystack/manual-payment controls.",
    actions: [
      {
        label: "Schedule vendor payout",
        method: "POST",
        action: "schedule_vendor_payout",
        description: "Schedule a vendor payout against an uploaded invoice.",
        template: {
          vendorId: "vendor_id_here",
          vendorInvoiceId: "vendor_invoice_id_here",
          amount: 1000,
          payoutMethod: "manual_bank_transfer"
        }
      },
      {
        label: "Initiate vendor payout",
        method: "POST",
        action: "initiate_vendor_payout",
        description: "Initiate a payout where provider transfer is enabled.",
        template: {
          vendorId: "vendor_id_here",
          vendorInvoiceId: "vendor_invoice_id_here",
          amount: 1000,
          payoutMethod: "paystack_transfer"
        }
      },
      {
        label: "Approve vendor payout",
        method: "PATCH",
        action: "approve_vendor_payout",
        description: "Approve a scheduled payout for release.",
        template: {
          id: "vendor_payout_id_here"
        }
      },
      {
        label: "Mark vendor payout paid",
        method: "PATCH",
        action: "mark_vendor_payout_paid",
        description: "Record a completed vendor payout with proof/reference.",
        template: {
          id: "vendor_payout_id_here",
          paymentReference: "BANK-REFERENCE",
          proofOfPaymentUrl: "https://example.com/proof.pdf"
        }
      }
    ]
  });
}