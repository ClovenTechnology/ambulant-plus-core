import type { Metadata } from 'next';
import PublicEnterpriseFormClient from './PublicEnterpriseFormClient';

export const metadata: Metadata = {
  title: 'Secure form',
  description: 'Complete a secure Ambulant+ form.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PublicEnterpriseFormPage({
  params,
}: {
  params: { slug: string };
}) {
  return <PublicEnterpriseFormClient slug={params.slug} />;
}
