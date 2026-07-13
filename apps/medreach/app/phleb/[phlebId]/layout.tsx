import type { ReactNode } from "react";
import { MedReachRoleShell } from "../../_components/MedReachRoleShell";

export default function PhlebWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { phlebId: string };
}) {
  const phlebId = encodeURIComponent(params.phlebId);

  const phlebNavItems = [
    {
      href: `/phleb/${phlebId}`,
      label: "Jobs",
      description: "Assigned phlebotomy jobs and specimen collection workflow.",
    },
    {
      href: `/phleb/${phlebId}/dashboard`,
      label: "Dashboard",
      description: "Phleb workload, readiness and completion summary.",
    },
    {
      href: `/phleb/${phlebId}/profile`,
      label: "Profile / credentials",
      description: "Phleb professional profile, contact and credential visibility.",
    },
    {
      href: `/phleb/${phlebId}/payouts`,
      label: "Payouts",
      description: "Phleb payout visibility and settlement status.",
    },
    {
      label: "Specimen labels / custody",
      description: "Specimen labels open from assigned job/order pages to preserve chain-of-custody context.",
      status: "Job-linked",
    },
    {
      label: "Preferences / service area",
      description: "Availability, preferred labs and service-area controls are scheduled for the phleb preferences patch.",
      status: "Pending",
    },
  ];

  return (
    <MedReachRoleShell
      role="phleb"
      eyebrow="MedReach phleb"
      title="Phlebotomist workspace"
      description="Assigned jobs, specimen custody, profile and phleb payout operations only."
      accent="border-violet-200 bg-violet-50 text-violet-900"
      navItems={phlebNavItems}
    >
      {children}
    </MedReachRoleShell>
  );
}
