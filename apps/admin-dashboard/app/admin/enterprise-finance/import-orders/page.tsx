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
    actionTitle: "Import-order workflow actions",
    actionIntro:
      "Move import orders through create, receive, inspect and accept-stock workflow with landed-cost capture.",
    actions: [
      {
        label: "Create import order",
        method: "POST",
        action: "create_import_order",
        description: "Create an import order against an active registered vendor.",
        template: {
          vendorId: "vendor_id_here",
          itemName: "Imported device batch",
          itemType: "device",
          manufacturer: "Manufacturer name",
          quantityOrdered: 10,
          totalCostUsd: 500,
          zarEquivalent: 9500,
          invoiceUrl: "https://example.com/import-invoice.pdf",
          orderDate: "2026-07-14",
          expectedDeliveryDate: "2026-08-14"
        }
      },
      {
        label: "Receive import order",
        method: "PATCH",
        action: "receive_import_order",
        description: "Record received import quantity.",
        template: {
          id: "import_order_id_here",
          quantityReceived: 10
        }
      },
      {
        label: "Inspect import order",
        method: "PATCH",
        action: "inspect_import_order",
        description: "Record inspection status and discrepancies.",
        template: {
          id: "import_order_id_here",
          qualityStatus: "passed",
          inspectionNotes: "All units visually inspected.",
          discrepancyNotes: ""
        }
      },
      {
        label: "Accept import stock",
        method: "PATCH",
        action: "accept_import_stock",
        description: "Accept inspected stock into an inventory item and post stock movement.",
        template: {
          id: "import_order_id_here",
          inventoryItemId: "inventory_item_id_here",
          quantityAccepted: 10,
          qualityStatus: "accepted",
          importDuty: 100,
          tax: 0,
          vat: 150,
          msp: 0,
          shipping: 250,
          clearing: 100,
          handling: 50,
          otherLandingCost: 0
        }
      }
    ]
  });
}