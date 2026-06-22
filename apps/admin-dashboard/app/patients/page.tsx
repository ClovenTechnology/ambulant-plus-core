
// apps/admin-dashboard/app/patients/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PatientsAliasPage() {
  redirect('/admin/patients');
}
