'use client';

import type { ReactNode } from 'react';
import { useUser, type MedReachRole } from '../context/UserContext';

type Props = {
  allowed: MedReachRole[];
  children: ReactNode;
  fallback?: ReactNode;
  hideWhenDenied?: boolean;
};

function prettyRole(role: MedReachRole) {
  if (role === 'lab_staff') return 'lab staff';
  return role;
}

export default function RoleGuard({
  allowed,
  children,
  fallback,
  hideWhenDenied = false,
}: Props) {
  const user = useUser();
  const permitted = allowed.includes(user.role);

  if (permitted) {
    return <>{children}</>;
  }

  if (hideWhenDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="font-semibold">Access restricted</div>
      <div className="mt-1 text-xs">
        Your current role is <span className="font-mono">{prettyRole(user.role)}</span>.
        This section is available to:{' '}
        <span className="font-mono">{allowed.map(prettyRole).join(', ')}</span>.
      </div>
    </div>
  );
}