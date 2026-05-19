// apps/patient-app/app/role/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RolePage() {
  redirect('/');
}