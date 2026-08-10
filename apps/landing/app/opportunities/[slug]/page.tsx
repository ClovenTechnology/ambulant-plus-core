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

function isoDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function countryName(code: unknown) {
  const countryCode = String(code || '').trim().toUpperCase();
  if (!countryCode) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

function jobPostingStructuredData(opportunity: any) {
  if (!['CAREER_JOB', 'INTERNSHIP_GRADUATE'].includes(opportunity.type)) return null;

  const datePosted = isoDate(opportunity.publishedAt);
  if (!datePosted) return null;

  const commitment = String(opportunity.commitmentLabel || '').toUpperCase();
  const employmentType = opportunity.type === 'INTERNSHIP_GRADUATE'
    ? 'INTERN'
    : commitment.includes('PART')
      ? 'PART_TIME'
      : commitment.includes('CONTRACT')
        ? 'CONTRACTOR'
        : commitment.includes('TEMP')
          ? 'TEMPORARY'
          : 'FULL_TIME';

  const locationMode = String(opportunity.locationMode || '').toUpperCase();
  const remote = locationMode === 'REMOTE';
  const applicantCountry = countryName(opportunity.countryCode);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: opportunity.title,
    description:
      opportunity.description ||
      opportunity.aeoSummary ||
      opportunity.summary ||
      opportunity.title,
    datePosted,
    validThrough: isoDate(opportunity.closesAt),
    employmentType,
    identifier: opportunity.referenceCode
      ? {
          '@type': 'PropertyValue',
          name: 'Ambulant+',
          value: opportunity.referenceCode,
        }
      : undefined,
    directApply: opportunity.application?.mode === 'ENTERPRISE_FORM',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Ambulant+',
      sameAs: absoluteUrl('/'),
    },
    ...(remote
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: applicantCountry
            ? {
                '@type': 'Country',
                name: applicantCountry,
              }
            : undefined,
        }
      : opportunity.locationLabel
        ? {
            jobLocation: {
              '@type': 'Place',
              address: {
                '@type': 'PostalAddress',
                addressLocality: opportunity.locationLabel,
                addressCountry: opportunity.countryCode || 'ZA',
              },
            },
          }
        : {}),
  };

  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );
}

function faqStructuredData(opportunity: any) {
  const questions = Array.isArray(opportunity.aeoQuestions)
    ? opportunity.aeoQuestions
        .filter((item: any) => String(item?.question || '').trim() && String(item?.answer || '').trim())
        .slice(0, 12)
    : [];

  if (!questions.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item: any) => ({
      '@type': 'Question',
      name: String(item.question).trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: String(item.answer).trim(),
      },
    })),
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

  const structuredJob = jobPostingStructuredData(opportunity);
  const structuredFaq = faqStructuredData(opportunity);

  return (
    <main className="min-h-screen bg-slate-50">
      {structuredJob ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredJob).replace(/</g, '\\u003c') }}
        />
      ) : null}
      {structuredFaq ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredFaq).replace(/</g, '\\u003c') }}
        />
      ) : null}
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

              {opportunity.aeoSummary ? (
                <section className="mt-7 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-5">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-800">At a glance</h2>
                  <p className="mt-2 text-[15px] leading-7 text-slate-700">{opportunity.aeoSummary}</p>
                </section>
              ) : null}

              {opportunity.tags.length ? <div className="mt-6 flex flex-wrap gap-2">{opportunity.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag}</span>)}</div> : null}

              {opportunity.description ? <div className="mt-8 whitespace-pre-wrap border-t pt-8 text-[15px] leading-8 text-slate-700">{opportunity.description}</div> : null}

              {Array.isArray(opportunity.galleryImages) && opportunity.galleryImages.length ? (
                <section className="mt-8 border-t pt-8">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Gallery</h2>
                    <span className="text-sm text-slate-400">{opportunity.galleryImages.length} {opportunity.galleryImages.length === 1 ? 'image' : 'images'}</span>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {opportunity.galleryImages.map((image) => (
                      <figure key={image.id} className="overflow-hidden rounded-2xl border bg-slate-50">
                        {image.imageUrl ? <img src={image.imageUrl} alt={image.altText || ''} className="h-64 w-full object-cover" /> : null}
                        {image.caption ? <figcaption className="px-4 py-3 text-sm leading-6 text-slate-600">{image.caption}</figcaption> : null}
                      </figure>
                    ))}
                  </div>
                </section>
              ) : null}

              {Array.isArray(opportunity.aeoQuestions) && opportunity.aeoQuestions.length ? (
                <section className="mt-8 border-t pt-8">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Common questions</h2>
                  <div className="mt-4 divide-y rounded-2xl border">
                    {opportunity.aeoQuestions.map((item, index) => (
                      <details key={`${item.question}-${index}`} className="group p-4">
                        <summary className="cursor-pointer list-none font-semibold text-slate-900">{item.question}</summary>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              ) : null}
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
