import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function ImportOrdersPage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Import orders",
    description:
      "Review imported devices, branded items and operational stock from order through payment, delivery, inspection and stock acceptance.",
    endpoint: "import-orders",
    responseKey: "importOrders",
    emptyText: "No import orders have been created yet.",
    columns: [
      { key: "orderNumber", label: "Order no." },
      { key: "itemName", label: "Item" },
      { key: "vendorName", label: "Vendor" },
      { key: "quantityOrdered", label: "Ordered" },
      { key: "quantityAccepted", label: "Accepted" },
      { key: "totalLandingCostCents", label: "Landed cost", money: true },
      { key: "status", label: "Status" },
    ],
  });
}
