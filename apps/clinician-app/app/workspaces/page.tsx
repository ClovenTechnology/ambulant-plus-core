// apps/clinician-app/app/workspaces/page.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Filter, Lock, Search, Video } from 'lucide-react';

type WorkspaceCategory =
  | 'all'
  | 'featured'
  | 'diagnostics'
  | 'procedural'
  | 'rehabilitation'
  | 'women-children'
  | 'vision-hearing'
  | 'specialty';

type VisitMode = 'televisit' | 'in-person' | 'hybrid';

type WorkspaceDef = {
  key: string;
  name: string;
  route: string;
  description: string;
  category: Exclude<WorkspaceCategory, 'all'>;
  enabled: boolean;
  featured?: boolean;
  supportsTelevisit: boolean;
  supportsInPerson: boolean;
  tags: string[];
  keywords: string[];
};

const CONTEXT_QUERY_KEYS = [
  'sessionId',
  'appointmentId',
  'encounterId',
  'caseId',
  'patientId',
  'subjectPatientId',
  'clinicianId',
  'providerId',
  'uid',
  'roomId',
  'visitMode',
  'patient',
  'encounter',
  'clinician',
] as const;

const CATEGORY_OPTIONS: Array<{ key: WorkspaceCategory; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'featured', label: 'Featured' },
  { key: 'specialty', label: 'Specialty' },
  { key: 'diagnostics', label: 'Diagnostics' },
  { key: 'procedural', label: 'Procedural' },
  { key: 'rehabilitation', label: 'Rehabilitation' },
  { key: 'women-children', label: 'Women & Children' },
  { key: 'vision-hearing', label: 'Vision & Hearing' },
];

const WORKSPACES: WorkspaceDef[] = [
  {
    key: 'cardiology',
    name: 'Cardiology',
    route: '/workspaces/cardiology',
    description: 'Cardiac diagnostics, ECG/stethoscope review, monitoring and care planning.',
    category: 'specialty',
    enabled: true,
    featured: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Cardiac', 'ECG', 'Monitoring'],
    keywords: ['heart', 'rhythm', 'bp', 'stethoscope', 'cardiac'],
  },
  {
    key: 'dental',
    name: 'Dental',
    route: '/workspaces/dental',
    description: 'Oral diagnostics, imaging, tooth charting and procedural planning.',
    category: 'procedural',
    enabled: true,
    featured: true,
    supportsTelevisit: false,
    supportsInPerson: true,
    tags: ['Oral care', 'Imaging', 'Procedure'],
    keywords: ['tooth', 'teeth', 'gum', 'xray', 'dentistry'],
  },
  {
    key: 'dermatology',
    name: 'Dermatology',
    route: '/workspaces/dermatology',
    description: 'Skin, lesion, wound and dermatological evidence capture.',
    category: 'specialty',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Skin', 'Images', 'Lesions'],
    keywords: ['rash', 'wound', 'mole', 'skin', 'derm'],
  },
  {
    key: 'endocrinology',
    name: 'Endocrinology',
    route: '/workspaces/endocrinology',
    description: 'Diabetes, thyroid, weight, foot-risk and metabolic care workflows.',
    category: 'specialty',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Diabetes', 'Thyroid', 'Metabolic'],
    keywords: ['glucose', 'hba1c', 'thyroid', 'weight', 'foot'],
  },
  {
    key: 'ent',
    name: 'ENT',
    route: '/workspaces/ent',
    description: 'Ear, nose, throat, airway, otoscope and hearing-related review.',
    category: 'vision-hearing',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Ear', 'Nose', 'Throat'],
    keywords: ['otoscope', 'hearing', 'sinus', 'airway', 'throat'],
  },
  {
    key: 'fertility',
    name: 'Fertility',
    route: '/workspaces/fertility',
    description: 'Reproductive health, fertility review and structured evidence capture.',
    category: 'women-children',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Reproductive', 'Fertility', 'Planning'],
    keywords: ['ivf', 'ovulation', 'fertility', 'reproductive'],
  },
  {
    key: 'neurology',
    name: 'Neurology',
    route: '/workspaces/neurology',
    description: 'Neurological examination, symptoms, events and evidence review.',
    category: 'specialty',
    enabled: true,
    featured: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Neuro', 'Exam', 'Monitoring'],
    keywords: ['brain', 'seizure', 'nerve', 'cognition', 'neuro'],
  },
  {
    key: 'obgyn',
    name: 'Obstetrics & Gynaecology',
    route: '/workspaces/obgyn',
    description: 'Women’s health, antenatal, gynaecology and reproductive care.',
    category: 'women-children',
    enabled: true,
    featured: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Women’s health', 'Pregnancy', 'Antenatal'],
    keywords: ['pregnancy', 'gynae', 'obstetrics', 'maternal', 'lady center'],
  },
  {
    key: 'occupational-therapy',
    name: 'Occupational Therapy',
    route: '/workspaces/occupational-therapy',
    description: 'Functional rehabilitation, ADLs, workplace and daily living support.',
    category: 'rehabilitation',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Function', 'ADL', 'Rehab'],
    keywords: ['occupational', 'function', 'workplace', 'daily living'],
  },
  {
    key: 'oncology',
    name: 'Oncology',
    route: '/workspaces/oncology',
    description: 'Cancer care review, treatment tracking and longitudinal monitoring.',
    category: 'specialty',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Cancer care', 'Treatment', 'Monitoring'],
    keywords: ['cancer', 'tumour', 'chemo', 'oncology'],
  },
  {
    key: 'optometry',
    name: 'Optometry',
    route: '/workspaces/optometry',
    description: 'Vision care, refraction, ocular screening and eye-health review.',
    category: 'vision-hearing',
    enabled: true,
    supportsTelevisit: false,
    supportsInPerson: true,
    tags: ['Vision', 'Eye health', 'Screening'],
    keywords: ['vision', 'eye', 'refraction', 'glasses', 'ocular'],
  },
  {
    key: 'paediatric',
    name: 'Paediatric Care',
    route: '/workspaces/paediatric',
    description: 'Child and adolescent health review, observations and care planning.',
    category: 'women-children',
    enabled: true,
    featured: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Children', 'Adolescent', 'Paediatric'],
    keywords: ['child', 'paediatric', 'pediatric', 'children'],
  },
  {
    key: 'physio',
    name: 'Physiotherapy',
    route: '/workspaces/physio',
    description: 'Musculoskeletal assessment, mobility review and rehabilitation planning.',
    category: 'rehabilitation',
    enabled: true,
    featured: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Mobility', 'MSK', 'Rehab'],
    keywords: ['physio', 'pain', 'rom', 'mobility', 'rehab'],
  },
  {
    key: 'speech-therapy',
    name: 'Speech Therapy',
    route: '/workspaces/speech-therapy',
    description: 'Speech, language, communication and swallowing therapy workflows.',
    category: 'rehabilitation',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Speech', 'Language', 'Therapy'],
    keywords: ['speech', 'swallow', 'language', 'communication'],
  },
  {
    key: 'std',
    name: 'STD Clinic',
    route: '/workspaces/std',
    description: 'Sexual health, STI screening, counselling and treatment workflow.',
    category: 'specialty',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Sexual health', 'STI', 'Screening'],
    keywords: ['std', 'sti', 'sexual health', 'infection'],
  },
  {
    key: 'substance-abuse',
    name: 'Substance Abuse',
    route: '/workspaces/substance-abuse',
    description: 'Addiction medicine, recovery support and risk monitoring.',
    category: 'specialty',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['Recovery', 'Addiction', 'Support'],
    keywords: ['substance', 'addiction', 'recovery', 'dependence'],
  },
  {
    key: 'surgery',
    name: 'Surgery',
    route: '/workspaces/surgery',
    description: 'Peri-operative planning, procedure events and post-operative care.',
    category: 'procedural',
    enabled: true,
    featured: true,
    supportsTelevisit: false,
    supportsInPerson: true,
    tags: ['Peri-op', 'Procedure', 'Post-op'],
    keywords: ['surgery', 'operation', 'procedure', 'postop', 'periop'],
  },
  {
    key: 'urology',
    name: 'Urology',
    route: '/workspaces/urology',
    description: 'Genitourinary diagnostics, urinary symptoms and procedural review.',
    category: 'specialty',
    enabled: true,
    supportsTelevisit: true,
    supportsInPerson: true,
    tags: ['GU', 'Urinary', 'Procedure'],
    keywords: ['urology', 'urinary', 'bladder', 'prostate', 'renal'],
  },
  {
    key: 'x-ray',
    name: 'X-ray',
    route: '/workspaces/x-ray',
    description: 'Plain-film imaging review, reporting support and evidence capture.',
    category: 'diagnostics',
    enabled: true,
    featured: true,
    supportsTelevisit: false,
    supportsInPerson: true,
    tags: ['Imaging', 'Diagnostics', 'X-ray'],
    keywords: ['xray', 'x-ray', 'radiograph', 'imaging', 'film'],
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectVisitMode(raw: string | null | undefined): VisitMode | null {
  const value = normalize(raw ?? '');
  if (!value) return null;
  if (value.includes('tele')) return 'televisit';
  if (value.includes('in person') || value.includes('inperson') || value.includes('clinic')) return 'in-person';
  if (value.includes('hybrid')) return 'hybrid';
  return null;
}

function visitModeLabel(mode: VisitMode | null) {
  if (mode === 'televisit') return 'Televisit';
  if (mode === 'in-person') return 'In-person';
  if (mode === 'hybrid') return 'Hybrid';
  return 'Any mode';
}

function modeAllowed(workspace: WorkspaceDef, mode: VisitMode | null) {
  if (!mode || mode === 'hybrid') return workspace.supportsTelevisit || workspace.supportsInPerson;
  if (mode === 'televisit') return workspace.supportsTelevisit;
  return workspace.supportsInPerson;
}

function modeLabel(workspace: WorkspaceDef) {
  if (workspace.supportsTelevisit && workspace.supportsInPerson) return 'Televisit + in-person';
  if (workspace.supportsTelevisit) return 'Televisit only';
  if (workspace.supportsInPerson) return 'In-person only';
  return 'Mode unavailable';
}

function buildHref(route: string, params: ReturnType<typeof useSearchParams>) {
  const next = new URLSearchParams();

  for (const key of CONTEXT_QUERY_KEYS) {
    const value = params?.get(key);
    if (value && value.trim()) next.set(key, value.trim());
  }

  const qs = next.toString();
  return qs ? `${route}?${qs}` : route;
}

function workspaceMatches(workspace: WorkspaceDef, query: string) {
  const q = normalize(query);
  if (!q) return true;

  const haystack = normalize(
    [
      workspace.key,
      workspace.name,
      workspace.description,
      workspace.category,
      ...workspace.tags,
      ...workspace.keywords,
    ].join(' '),
  );

  return haystack.includes(q);
}

function WorkspaceCard(props: {
  workspace: WorkspaceDef;
  href: string;
  unavailableReason: string | null;
}) {
  const { workspace, href, unavailableReason } = props;
  const available = workspace.enabled && !unavailableReason;

  const body = (
    <article
      aria-disabled={!available}
      className={[
        'group relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all',
        available ? 'hover:-translate-y-0.5 hover:shadow-md' : 'opacity-70',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-950">{workspace.name}</h2>
            {workspace.featured ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                Featured
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">{workspace.description}</p>
        </div>

        <div className="rounded-2xl border bg-gray-50 p-2 text-gray-500">
          {available ? <ArrowRight className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {workspace.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t pt-4 text-xs text-gray-500">
          <span>{modeLabel(workspace)}</span>
          <span className={available ? 'font-medium text-blue-700' : 'font-medium text-amber-700'}>
            {available ? 'Open workspace' : unavailableReason}
          </span>
        </div>
      </div>
    </article>
  );

  if (!available) return <div className="h-full">{body}</div>;

  return (
    <Link href={href} className="block h-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded-2xl">
      {body}
    </Link>
  );
}

export default function WorkspacesPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WorkspaceCategory>('all');

  const visitMode = detectVisitMode(searchParams?.get('visitMode'));

  const filtered = useMemo(() => {
    return WORKSPACES
      .filter((workspace) => {
        if (category === 'featured' && !workspace.featured) return false;
        if (category !== 'all' && category !== 'featured' && workspace.category !== category) return false;
        return workspaceMatches(workspace, query);
      })
      .sort((a, b) => {
        const aAvailable = a.enabled && modeAllowed(a, visitMode);
        const bAvailable = b.enabled && modeAllowed(b, visitMode);

        if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [category, query, visitMode]);

  const enabledCount = WORKSPACES.filter((workspace) => workspace.enabled).length;
  const modeCount = WORKSPACES.filter((workspace) => workspace.enabled && modeAllowed(workspace, visitMode)).length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                <Video className="h-3.5 w-3.5" />
                Workspace launcher
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
                Clinical workspaces
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                Launch specialty environments with patient, encounter, clinician, appointment and visit context preserved.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-gray-50 px-4 py-3">
                <div className="text-xs text-gray-500">Enabled</div>
                <div className="mt-1 text-xl font-semibold text-gray-950">{enabledCount}</div>
              </div>
              <div className="rounded-2xl border bg-gray-50 px-4 py-3">
                <div className="text-xs text-gray-500">Mode</div>
                <div className="mt-1 text-sm font-semibold text-gray-950">{visitModeLabel(visitMode)}</div>
              </div>
              <div className="rounded-2xl border bg-gray-50 px-4 py-3">
                <div className="text-xs text-gray-500">Available now</div>
                <div className="mt-1 text-xl font-semibold text-gray-950">{modeCount}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Search workspaces</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-2xl border bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10"
                placeholder="Search by specialty, capability or keyword…"
              />
            </label>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Filter className="hidden h-4 w-4 text-gray-400 sm:block" />
              {CATEGORY_OPTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key)}
                  className={[
                    'whitespace-nowrap rounded-2xl border px-3 py-2 text-xs font-medium transition',
                    category === item.key
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'bg-white text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing <span className="font-semibold text-gray-950">{filtered.length}</span> workspace
            {filtered.length === 1 ? '' : 's'}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Context is preserved in workspace links
          </div>
        </div>

        {filtered.length ? (
          <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((workspace) => {
              const unavailableReason = !workspace.enabled
                ? 'Unavailable'
                : !modeAllowed(workspace, visitMode)
                  ? `Not for ${visitModeLabel(visitMode)}`
                  : null;

              return (
                <WorkspaceCard
                  key={workspace.key}
                  workspace={workspace}
                  href={buildHref(workspace.route, searchParams)}
                  unavailableReason={unavailableReason}
                />
              );
            })}
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border bg-gray-50">
              <Search className="h-5 w-5 text-gray-500" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-950">No workspaces found</h2>
            <p className="mt-2 text-sm text-gray-600">
              Try a broader specialty term, clear the search, or switch category.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
