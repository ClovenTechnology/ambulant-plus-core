// apps/admin-dashboard/src/lib/widgets.tsx
import type { ReactNode } from 'react';

// Widget components
import PendingSignupsTile from '@/components/widgets/PendingSignupsTile';
import RoleRequestsTile from '@/components/widgets/RoleRequestsTile';
import PayoutsDueTile from '@/components/widgets/PayoutsDueTile';
import DevicesOnlineTile from '@/components/widgets/DevicesOnlineTile';

export type HomeWidget = {
  id: string;
  title: string;
  requires: string | string[];
  component: ReactNode;
  href?: string; // optional “Open” link target for the card wrapper
};

export const HOME_WIDGETS: HomeWidget[] = [
  {
    id: 'pendingSignups',
    title: 'Pending Signups',
    requires: ['staff.roles.manage', 'staff.hr.manage', 'hr:manage', 'hr', 'manageRoles'],
    component: <PendingSignupsTile />,
    href: '/settings/people/role-requests',
  },
  {
    id: 'roleRequests',
    title: 'Role Requests',
    requires: ['staff.roles.manage', 'staff.hr.manage', 'hr:manage', 'hr', 'manageRoles'],
    component: <RoleRequestsTile />,
    href: '/settings/people/role-requests',
  },
  {
    id: 'financePayouts',
    title: 'Payouts Due',
    requires: ['finance:read', 'finance:manage', 'finance'],
    component: <PayoutsDueTile />,
    href: '/settings/payouts',
  },
  {
    id: 'devicesOnline',
    title: 'Devices Online',
    requires: ['devices:read', 'devices:manage', 'tech:read', 'tech:manage', 'tech'],
    component: <DevicesOnlineTile />,
    href: '/devices',
  },
  // …add more as needed
];
