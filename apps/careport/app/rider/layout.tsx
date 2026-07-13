import type { ReactNode } from "react";
import { CarePortRoleShell } from "../_components/CarePortRoleShell";

const riderNavItems = [
  {
    href: "/rider",
    label: "Dashboard",
    description: "Rider readiness, active delivery and handover summary.",
  },
  {
    href: "/rider/kyi",
    label: "KYI verification",
    description: "Identity, vehicle and medicine-handling verification.",
  },
  {
    href: "/rider/jobs",
    label: "Jobs",
    description: "Assigned delivery jobs and status updates.",
  },
  {
    href: "/rider/pharmacy",
    label: "Pharmacy pickup",
    description: "Pickup and pharmacy handover surface for rider delivery flow.",
  },
  {
    label: "Payouts",
    description: "Rider settlement view will be exposed after rider payout policy is finalised.",
    status: "Pending",
  },
  {
    label: "Profile / service area",
    description: "Rider profile, vehicle and service-area updates remain controlled through KYI/admin review.",
    status: "Controlled",
  },
];

export default function RiderLayout({ children }: { children: ReactNode }) {
  return (
    <CarePortRoleShell
      role="rider"
      eyebrow="CarePort rider"
      title="Rider workspace"
      description="KYI, delivery jobs, pickup handover and rider operations only."
      accent="border-indigo-200 bg-indigo-50 text-indigo-900"
      navItems={riderNavItems}
    >
      {children}
    </CarePortRoleShell>
  );
}
