//apps/patient-app/app/auto-triage/page.tsx
import { redirect } from 'next/navigation';

export default function AutoTriageRedirectPage() {
  redirect('/self-check');
}