//apps/admin-dashboard/app/admin/training/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function AdminTrainingPage() {
  redirect('/admin/calendar');
}
