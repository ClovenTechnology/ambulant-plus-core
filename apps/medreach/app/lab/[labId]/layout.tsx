import type { ReactNode } from "react";
import { MedReachRoleShell } from "../../_components/MedReachRoleShell";

export default function LabWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { labId: string };
}) {
  const labId = encodeURIComponent(params.labId);

  const labNavItems = [
    {
      href: `/lab/${labId}`,
      label: "Overview",
      description: "Lab orders, result flow and operational summary.",
    },
    {
      href: `/lab/${labId}/dashboard`,
      label: "Dashboard",
      description: "Operational analytics and current lab workload.",
    },
    {
      href: `/lab/${labId}/tests`,
      label: "Test catalogue",
      description: "Lab test catalogue, pricing and availability settings.",
    },
    {
      href: `/lab/${labId}/settings`,
      label: "Settings / staff",
      description: "Lab profile, branches, staff and operational configuration.",
    },
    {
      href: "/lab-networks",
      label: "Lab networks",
      description: "Network, branch and staff management for lab organisations.",
    },
    {
      label: "Payouts / commercial policy",
      description: "Lab commercial policy is scheduled for the next MedReach commercial patch.",
      status: "Pending",
    },
  ];

  return (
    <MedReachRoleShell
      role="lab"
      eyebrow="MedReach lab"
      title="Lab workspace"
      description="Orders, results, test catalogue, staff and lab network operations only."
      accent="border-sky-200 bg-sky-50 text-sky-900"
      navItems={labNavItems}
    >
      {children}
    </MedReachRoleShell>
  );
}
