import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function VendorInvoicesPage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Vendor invoices",
    description:
      "Review uploaded vendor invoices, verification state, balances, payment status and proof-of-payment requirements.",
    endpoint: "vendor-invoices",
    responseKey: "invoices",
    emptyText: "No vendor invoices have been uploaded yet.",
    columns: [
      { key: "invoiceNumber", label: "Invoice no." },
      { key: "vendorName", label: "Vendor" },
      { key: "totalCents", label: "Total", money: true },
      { key: "balanceCents", label: "Balance", money: true },
      { key: "invoiceStatus", label: "Status" },
      { key: "dueDate", label: "Due", date: true },
    ],
    actionTitle: "Vendor invoice workflow actions",
    actionIntro:
      "Create, verify and mark vendor invoices as paid while preserving uploaded invoice and proof-of-payment requirements.",
    actions: [
      {
        label: "Create vendor invoice",
        method: "POST",
        action: "create_vendor_invoice",
        description: "Create an uploaded vendor invoice record.",
        template: {
          vendorId: "vendor_id_here",
          invoiceNumber: "INV-001",
          total: 1000,
          invoiceUrl: "https://example.com/invoice.pdf",
          dueDate: "2026-07-31"
        }
      },
      {
        label: "Verify invoice",
        method: "PATCH",
        action: "verify_vendor_invoice",
        description: "Verify a submitted vendor invoice.",
        template: {
          id: "vendor_invoice_id_here"
        }
      },
      {
        label: "Mark invoice paid",
        method: "PATCH",
        action: "mark_vendor_invoice_paid",
        description: "Mark invoice paid with proof/reference.",
        template: {
          id: "vendor_invoice_id_here",
          paymentReference: "BANK-REFERENCE",
          proofOfPaymentUrl: "https://example.com/proof.pdf"
        }
      }
    ]
  });
}