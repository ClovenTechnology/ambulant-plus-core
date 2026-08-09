import type { Metadata } from 'next';
import ApplicationPortalClient from './ApplicationPortalClient';

export const metadata: Metadata = {
  title: 'Secure application portal | Ambulant+',
  description: 'Secure Ambulant+ application status and document portal.',
  robots: { index: false, follow: false, nocache: true },
};

export default function ApplicationPortalPage({ params }: { params: { reference: string } }) {
  return <ApplicationPortalClient reference={params.reference} />;
}
