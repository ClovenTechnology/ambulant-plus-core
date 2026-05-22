// apps/patient-app/app/careport/reorder-test/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ReorderTestRedirect({
  searchParams,
}: {
  searchParams?: { reportId?: string; encId?: string; id?: string };
}) {
  const encId = String(searchParams?.encId || searchParams?.id || '').trim();

  if (encId) {
    redirect(`/careport?encId=${encodeURIComponent(encId)}`);
  }

  redirect('/careport');
}
