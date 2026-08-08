import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Briefcase, MapPin, Search, Sparkles } from 'lucide-react';
import { absoluteUrl } from '@/lib/seo';
import { fetchPublicOpportunities, PUBLIC_OPPORTUNITY_TYPES } from '@/lib/public-opportunities';
import { PUBLIC_TYPE_LABELS, publicAvailabilityClass, publicAvailabilityLabel } from './opportunity-ui';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Opportunities | Careers, Partnerships, Programmes and Research',
  description: 'Explore current Ambulant+ careers, internships, graduate programmes, partnerships, franchise opportunities, provider opportunities and research pilots.',
  alternates: { canonical: absoluteUrl('/opportunities') },
  openGraph: {
    title: 'Ambulant+ Opportunities',
    description: 'Careers, programmes, partnerships, provider opportunities and research pilots across the Ambulant+ ecosystem.',
    url: absoluteUrl('/opportunities'),
    type: 'website',
  },
};

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const q = param(searchParams?.q).slice(0, 240);
  const rawType = param(searchParams?.type).toUpperCase();
  const type = PUBLIC_OPPORTUNITY_TYPES.includes(rawType as any) ? rawType : '';
  const page = Math.max(1, Number.parseInt(param(searchParams?.page) || '1', 10) || 1);

  let result;
  let error = '';
  try {
    result = await fetchPublicOpportunities({ q, type, page, pageSize: 20 });
  } catch {
    error = 'Current opportunities could not be loaded. Please try again shortly.';
    result = { ok: false, page, pageSize: 20, total: 0, items: [] };
  }

  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const queryForPage = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (nextPage > 1) params.set('page', String(nextPage));
    return `/opportunities${params.toString() ? `?${params}` : ''}`;
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-4xl">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700">Work, build and partner with us</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">Opportunities across the Ambulant+ ecosystem</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">Discover careers, internships, graduate programmes, partnerships, franchise opportunities, service-provider opportunities and research pilots published through our governed application platform.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <form className="grid gap-3 rounded-3xl border bg-white p-4 shadow-sm lg:grid-cols-[1fr_280px_auto]" action="/opportunities" method="get">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Search opportunities" className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm" />
          </label>
          <select name="type" defaultValue={type} className="rounded-xl border px-3 py-2.5 text-sm">
            <option value="">All opportunity types</option>
            {PUBLIC_OPPORTUNITY_TYPES.map((value) => <option key={value} value={value}>{PUBLIC_TYPE_LABELS[value]}</option>)}
          </select>
          <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Search</button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">{result.total} current {result.total === 1 ? 'opportunity' : 'opportunities'}</p>
          {(q || type) ? <Link href="/opportunities" className="text-sm font-medium text-cyan-700 hover:underline">Clear filters</Link> : null}
        </div>

        {error ? <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

        {result.items.length === 0 && !error ? (
          <div className="mt-8 rounded-3xl border bg-white p-12 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No matching opportunities</h2>
            <p className="mt-2 text-sm text-slate-500">Try a different search or check back as new opportunities are published.</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {result.items.map((item) => (
            <article key={item.slug} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt || ''} className="h-56 w-full object-cover" /> : <div className="flex h-40 items-center justify-center bg-gradient-to-br from-cyan-50 to-slate-100"><Briefcase className="h-10 w-10 text-cyan-700/40" /></div>}
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${publicAvailabilityClass(item.availability)}`}>{publicAvailabilityLabel(item.availability)}</span>
                  {item.featured ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><Sparkles className="h-3.5 w-3.5" /> Featured</span> : null}
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">{PUBLIC_TYPE_LABELS[item.type]}</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"><Link href={`/opportunities/${encodeURIComponent(item.slug)}`} className="hover:text-cyan-800">{item.title}</Link></h2>
                {item.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.summary}</p> : null}
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                  {item.departmentLabel ? <span>{item.departmentLabel}</span> : null}
                  {(item.locationLabel || item.locationMode) ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {item.locationLabel || item.locationMode}</span> : null}
                  {item.commitmentLabel ? <span>{item.commitmentLabel}</span> : null}
                </div>
                {item.tags.length ? <div className="mt-4 flex flex-wrap gap-2">{item.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>)}</div> : null}
                <Link href={`/opportunities/${encodeURIComponent(item.slug)}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">View opportunity <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </article>
          ))}
        </div>

        {pages > 1 ? (
          <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Opportunity pages">
            {page > 1 ? <Link href={queryForPage(page - 1)} className="rounded-xl border bg-white px-4 py-2 text-sm">Previous</Link> : null}
            <span className="text-sm text-slate-500">Page {page} of {pages}</span>
            {page < pages ? <Link href={queryForPage(page + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm">Next</Link> : null}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
