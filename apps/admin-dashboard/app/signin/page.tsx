//apps/admin-dashboard/app/signin/page.tsx
import { redirect } from 'next/navigation';
export default function LegacySigninRedirect() {
  redirect('/auth/signin');
}
