import { redirect } from 'next/navigation';
import AdminCommandCentre from '@/components/AdminCommandCentre';
import { getSessionFromGateway } from '@/src/lib/session';

export const metadata = {
  title: 'Admin Command Centre',
  description: 'Operational command centre for Ambulant+',
};

export default async function AdminHome() {
  const session = await getSessionFromGateway();
  const user = session?.user ?? null;

  if (!user?.email) {
    redirect('/auth/signin?next=%2F');
  }

  const tenant = (session as { tenant?: unknown } | null | undefined)?.tenant;
  const scopes: string[] = Array.isArray(user?.scopes) ? user.scopes : [];

  return (
    <AdminCommandCentre
      userName={user?.name || null}
      userEmail={user.email}
      tenant={tenant ? String(tenant) : null}
      scopes={scopes}
    />
  );
}
