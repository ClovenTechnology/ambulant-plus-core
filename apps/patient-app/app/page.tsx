import { redirect } from 'next/navigation';

import PatientHomeClient from './PatientHomeClient';
import { resolvePatientAppSession } from './api/_session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  const session = resolvePatientAppSession();

  if (!session) {
    redirect('/auth/login?next=/');
  }

  return <PatientHomeClient />;
}
