import type { ReactNode } from "react";
import { CarePortRoleShell } from "../_components/CarePortRoleShell";

const pharmacyNavItems = [
  {
    href: "/pharmacy",
    label: "Dashboard",
    description: "Pharmacy readiness, invitations and fulfilment summary.",
  },
  {
    href: "/pharmacy/orders",
    label: "Orders",
    description: "Accepted eRx and marketplace fulfilment workload.",
  },
  {
    href: "/pharmacy/offers",
    label: "Offers",
    description: "Incoming fulfilment invitations requiring pharmacy action.",
  },
  {
    href: "/pharmacy/inventory",
    label: "Inventory",
    description: "CarePort SKU catalogue and medicine availability.",
  },
  {
    href: "/pharmacy/inventory/import",
    label: "Import inventory",
    description: "Bulk upload and update pharmacy stock items.",
  },
  {
    label: "Payouts",
    description: "Pharmacy settlement view will be exposed after partner payout policy is finalised.",
    status: "Pending",
  },
  {
    label: "Profile / KYC",
    description: "Pharmacy profile and KYC updates remain controlled through onboarding/admin review.",
    status: "Controlled",
  },
];

export default function PharmacyLayout({ children }: { children: ReactNode }) {
  return (
    <CarePortRoleShell
      role="pharmacy"
      eyebrow="CarePort pharmacy"
      title="Pharmacy workspace"
      description="Inventory, offers, eRx orders and pharmacy fulfilment only."
      accent="border-emerald-200 bg-emerald-50 text-emerald-900"
      navItems={pharmacyNavItems}
    >
      {children}
    </CarePortRoleShell>
  );
}
