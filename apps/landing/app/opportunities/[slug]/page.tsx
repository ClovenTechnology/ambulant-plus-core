import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPin } from 'lucide-react';
import { absoluteUrl } from '@/lib/seo';
import { fetchPublicOpportunity } from '@/lib/public-opportunities';
import { applicationCta, opportunityDateLabel, PUBLIC_TYPE_LABELS, publicAvailabilityClass, publicAvailabilityLabel } from '../opportunity-ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const opportunity = await fetchPublicOpportunity(params.slug).catch(() => null);
  if (!opportunity) return { title: 'Opportunity not found' };

  const title = opportunity.seoTitle || opportunity.title;
  const description = opportunity.seoDescription || opportunity.summary || `Explore ${opportunity.title} with Ambulant+.`;
  const canonical = absoluteUrl(`/opportunities/${opportunity.slug}`);
  const images = opportunity.imageUrl ? [{ url: opportunity.imageUrl, alt: opportunity.imageAlt || opportunity.title }] : undefined;

  return {
    title,
    description,
    alternates: opportunity.visibility === 'PUBLIC' ? { canonical } : undefined,
    robots: opportunity.visibility === 'PUBLIC' ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
    openGraph: { title, description, url: canonical, type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: opportunity.imageUrl ? [opportunity.imageUrl] : undefined },
  };
}

export default async function OpportunityDetailPage({ params }: { params: { slug: string } }) {
  const opportunity = await fetchPublicOpportunity(params.slug).catch(() => null);
  if (!opportunity) notFound();

  const cta = applicationCta(opportunity);
  const opens = opportunityDateLabel(opportunity.opensAt);
  const closes = opportunityDateLabel(opportunity.closesAt);
  const applicationNote = cta.href && !cta.disabled
    ? (closes ? `Applications are open until ${closes}.` : 'Applications are currently open.')
    : opportunity.availability === 'UPCOMING'
      ? (opens ? `Applications open ${opens}.` : 'Applications are not open yet.')
      : opportunity.availability === 'CLOSED'
        ? 'Applications are closed.'
        : 'Applications are currently unavailable.';

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <Link href="/opportunities" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> All opportunities</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-16">
        <div className="space-y-8">
          <article className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            {opportunity.imageUrl ? <img src={opportunity.imageUrl} alt={opportunity.imageAlt || ''} className="max-h-[520px] w-full object-cover" /> : null}
            <div className="p-6 md:p-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${publicAvailabilityClass(opportunity.availability)}`}>{publicAvailabilityLabel(opportunity.availability)}</span>
                {opportunity.featured ? <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Featured</span> : null}
              </div>
              <div className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-cyan-700">{PUBLIC_TYPE_LABELS[opportunity.type]}</div>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">{opportunity.title}</h1>
              {opportunity.summary ? <p className="mt-5 text-lg leading-8 text-slate-600">{opportunity.summary}</p> : null}

              {opportunity.tags.length ? <div className="mt-6 flex flex-wrap gap-2">{opportunity.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag}</span>)}</div> : null}

              {opportunity.description ? <div className="mt-8 whitespace-pre-wrap border-t pt-8 text-[15px] leading-8 text-slate-700">{opportunity.description}</div> : null}
            </div>
          </article>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Opportunity details</h2>
            <dl className="mt-5 space-y-4 text-sm">
              {opportunity.referenceCode ? <div><dt className="text-slate-400">Reference</dt><dd className="mt-1 font-medium text-slate-800">{opportunity.referenceCode}</dd></div> : null}
              {opportunity.departmentLabel ? <div><dt className="text-slate-400">Programme / department</dt><dd className="mt-1 font-medium text-slate-800">{opportunity.departmentLabel}</dd></div> : null}
              {opportunity.audienceLabel ? <div><dt className="text-slate-400">Who this is for</dt><dd className="mt-1 font-medium text-slate-800">{opportunity.audienceLabel}</dd></div> : null}
              {opportunity.commitmentLabel ? <div><dt className="text-slate-400">Commitment</dt><dd className="mt-1 font-medium text-slate-800">{opportunity.commitmentLabel}</dd></div> : null}
              {opportunity.commercialLabel ? <div><dt className="text-slate-400">Commercial / compensation</dt><dd className="mt-1 font-medium text-slate-800">{opportunity.commercialLabel}</dd></div> : null}
              {(opportunity.locationLabel || opportunity.locationMode) ? <div><dt className="text-slate-400">Location</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-slate-800"><MapPin className="h-4 w-4" /> {opportunity.locationLabel || opportunity.locationMode}{opportunity.countryCode ? ` · ${opportunity.countryCode}` : ''}</dd></div> : null}
              {opens ? <div><dt className="text-slate-400">Applications open</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-slate-800"><CalendarDays className="h-4 w-4" /> {opens}</dd></div> : null}
              {closes ? <div><dt className="text-slate-400">Applications close</dt><dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-slate-800"><CalendarDays className="h-4 w-4" /> {closes}</dd></div> : null}
            </dl>
          </section>

          <section className="rounded-3xl border bg-slate-950 p-6 text-white shadow-sm">
            <h2 className="text-lg font-semibold">Next step</h2>
            {cta.href && !cta.disabled ? (
              cta.external ? (
                <a href={cta.href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">{cta.label} <ExternalLink className="h-4 w-4" /></a>
              ) : (
                <Link href={cta.href} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950">{cta.label} <ArrowRight className="h-4 w-4" /></Link>
              )
            ) : (
              <div className="mt-5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/75">{cta.label}</div>
            )}
            <p className="mt-4 text-xs leading-5 text-white/60">{applicationNote}</p>
          </section>
        </aside>
      </section>
    </main>
  );
}
