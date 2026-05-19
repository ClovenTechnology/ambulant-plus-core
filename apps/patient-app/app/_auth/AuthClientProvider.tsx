// apps/patient-app/app/_auth/AuthClientProvider.tsx
'use client';

import type { ReactNode } from 'react';

/**
 * Patient-app auth is handled by the production auth routes, cookies,
 * middleware, and API identity headers.
 */
export default function AuthClientProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}