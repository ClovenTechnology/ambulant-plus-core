import { EnterpriseFinanceProcurementReadPage } from "../_components/procurement-page";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  return EnterpriseFinanceProcurementReadPage({
    title: "Vendors",
    description:
      "Review registered vendors, approval state, payout eligibility and public registration submissions before payment workflows are enabled.",
    endpoint: "vendors",
    responseKey: "vendors",
    emptyText: "No vendors have been registered yet.",
    columns: [
      { key: "legalName", label: "Legal name" },
      { key: "tradingName", label: "Trading name" },
      { key: "status", label: "Status" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "payoutEligible", label: "Payout eligible", bool: true },
    ],
    actionTitle: "Vendor workflow actions",
    actionIntro:
      "Create approved vendors, approve public registrations and enable payout eligibility from one controlled console.",
    actions: [
      {
        label: "Create vendor",
        method: "POST",
        action: "create_vendor",
        description: "Create a registered vendor record from Admin.",
        template: {
          legalName: "Example Supplier Pty Ltd",
          tradingName: "Example Supplier",
          vendorType: "supplier",
          email: "accounts@example.com",
          phone: "+27000000000",
          approveNow: false
        }
      },
      {
        label: "Approve vendor",
        method: "PATCH",
        action: "approve_vendor",
        description: "Approve an existing vendor after registration review.",
        template: {
          id: "vendor_id_here"
        }
      },
      {
        label: "Enable vendor payout",
        method: "PATCH",
        action: "enable_vendor_payout",
        description: "Mark an active vendor as payout eligible.",
        template: {
          id: "vendor_id_here"
        }
      }
    ]
  });
}