import type { ReactNode } from "react";
import { CarePortRoleShell } from "../_components/CarePortRoleShell";

const riderNavItems = [
  {
    href: "/rider",
    label: "Dashboard",
    description: "Rider readiness, active delivery and handover summary.",
  },
  {
    href: "/rider/jobs",
    label: "Jobs & deliveries",
    description: "Assigned delivery work, pickup progress and delivery status.",
  },
  {
    href: "/rider/pharmacy",
    label: "Pharmacy pickup",
    description: "Pickup and pharmacy handover surface for medicine delivery.",
  },
  {
    href: "/rider/kyi",
    label: "KYI verification",
    description: "Identity, vehicle and medicine-handling verification.",
  },
  {
    href: "/rider/payouts",
    label: "Payouts",
    description: "Trip earnings, settlement status and payout history.",
  },
  {
    label: "Profile / service area",
    description: "Profile, vehicle and service-area changes remain controlled through KYI/admin review.",
    status: "Controlled",
  },
];

export default function RiderLayout({ children }: { children: ReactNode }) {
  return (
    <CarePortRoleShell
      role="rider"
      eyebrow="CarePort rider"
      title="Rider workspace"
      description="KYI, jobs, pharmacy pickup, delivery handover and rider settlements."
      accent="border-indigo-200 bg-indigo-50 text-indigo-900"
      navItems={riderNavItems}
    >
      {children}
    </CarePortRoleShell>
  );
}
