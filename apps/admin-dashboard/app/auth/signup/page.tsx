import { Suspense } from 'react';
import SignupClient from './SignupClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AdminSignupPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-gray-600">Loading signup...</main>}>
      <SignupClient />
    </Suspense>
  );
}
