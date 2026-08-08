import type { Metadata } from 'next';
import PublicEnterpriseFormClient from './PublicEnterpriseFormClient';
import { normaliseOpportunityContextSlug } from './client-policy';

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
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { opportunity?: string };
}) {
  const opportunitySlug = normaliseOpportunityContextSlug(searchParams?.opportunity);
  return <PublicEnterpriseFormClient slug={params.slug} opportunitySlug={opportunitySlug || null} />;
}
