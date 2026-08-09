import type { Metadata } from 'next';
import ApplicationAccessClient from './ApplicationAccessClient';

export const metadata: Metadata = {
  title: 'Manage application | Ambulant+',
  description: 'Securely access your Ambulant+ application status and document requests.',
  robots: { index: false, follow: false, nocache: true },
};

export default function ApplicationsAccessPage({ searchParams }: { searchParams?: { reference?: string } }) {
  return <ApplicationAccessClient initialReference={String(searchParams?.reference || '')} />;
}
