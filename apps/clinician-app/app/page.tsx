// apps/clinician-app/app/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ClinicianDashboardClient from './ClinicianDashboardClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAMES = [
  process.env.CLINICIAN_SESSION_COOKIE || 'ambulant_clinician_session',
  '__Host-ambulant_clinician_session',
  'clinician_session',
  'ambulant_session',
  '__Host-ambulant_session',
  'ambulant.session',
  'auth_session',
  'session',
  'token',
];

function hasClinicianSession() {
  const jar = cookies();

  return SESSION_COOKIE_NAMES.some((name) => {
    const value = jar.get(name)?.value;
    return Boolean(value && value.trim().length > 16);
  });
}

export default function ClinicianHomePage() {
  if (!hasClinicianSession()) {
    redirect('/auth/login?next=/');
  }

  return <ClinicianDashboardClient />;
}
