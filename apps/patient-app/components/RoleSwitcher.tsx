// apps/patient-app/components/RoleSwitcher.tsx
'use client';

import * as React from 'react';
import { useAuth } from 'ambulant-mock-auth/context/AuthContext';

const ROLES = ['patient', 'clinician', 'admin'] as const;
type Role = (typeof ROLES)[number];

export default function RoleSwitcher() {
  const { role, setRole } = useAuth();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRole?.(e.target.value as Role);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <label className="text-sm text-gray-600">Role</label>
      <select
        className="border rounded px-2 py-1 text-sm"
        value={role ?? 'patient'}
        onChange={onChange}
      >
        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  );
}
