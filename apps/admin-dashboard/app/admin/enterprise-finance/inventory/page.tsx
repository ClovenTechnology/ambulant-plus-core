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
    actionTitle: "Inventory workflow actions",
    actionIntro:
      "Create stock items and perform controlled quantity, reservation and release adjustments.",
    actions: [
      {
        label: "Create inventory item",
        method: "POST",
        action: "create_inventory_item",
        description: "Create an Admin Ops inventory item.",
        template: {
          name: "NexRing demo device",
          sku: "NEXRING-DEMO-001",
          itemType: "device",
          quantityOnHand: 0,
          lowStockThreshold: 5,
          adminVisible: true
        }
      },
      {
        label: "Adjust stock quantity",
        method: "PATCH",
        action: "adjust_inventory_quantity",
        description: "Post a manual stock movement and update quantity on hand.",
        template: {
          id: "inventory_item_id_here",
          quantityDelta: 10,
          narration: "Manual stock adjustment"
        }
      },
      {
        label: "Reserve stock",
        method: "PATCH",
        action: "reserve_inventory_quantity",
        description: "Reserve quantity against available stock.",
        template: {
          id: "inventory_item_id_here",
          quantity: 1
        }
      },
      {
        label: "Release reservation",
        method: "PATCH",
        action: "release_inventory_reservation",
        description: "Release previously reserved quantity.",
        template: {
          id: "inventory_item_id_here",
          quantity: 1
        }
      }
    ]
  });
}