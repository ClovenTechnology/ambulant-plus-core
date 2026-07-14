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
  });
}
