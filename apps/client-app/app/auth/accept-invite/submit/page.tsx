// apps/client-app/app/auth/accept-invite/submit/page.tsx
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AcceptInviteSubmitPage() {
  redirect('/auth/accept-invite');
}