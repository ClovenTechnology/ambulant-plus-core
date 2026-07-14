import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Inventory",
    description:
      "Review Admin Ops stock items including devices, branded items, CarePort-linked stock, MedReach stock and operational consumables.",
    endpoint: "inventory-items",
    responseKey: "items",
    emptyText: "No inventory items have been created yet.",
    columns: [
      { key: "name", label: "Item" },
      { key: "sku", label: "SKU" },
      { key: "itemType", label: "Type" },
      { key: "quantityOnHand", label: "On hand" },
      { key: "availableQuantity", label: "Available" },
      { key: "lowStockThreshold", label: "Low stock" },
      { key: "active", label: "Active", bool: true },
    ],
  });
}
