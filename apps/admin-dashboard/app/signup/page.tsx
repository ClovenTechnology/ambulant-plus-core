//apps/admin-dashboard/app/signup/page.tsx
import { redirect } from 'next/navigation';
export default function LegacySignupRedirect() {
  redirect('/auth/signup');
}
