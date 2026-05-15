// apps/clinician-app/app/dental-workspace/page.tsx
import { redirect } from 'next/navigation';

export default function LegacyDentalWorkspaceRedirectPage() {
  redirect('/workspaces/dental');
}