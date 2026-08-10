export const PUBLIC_OPPORTUNITY_TYPES = [
  'CAREER_JOB',
  'INTERNSHIP_GRADUATE',
  'ONBOARDING',
  'PARTNERSHIP',
  'FRANCHISE',
  'VENDOR_PROVIDER',
  'RESEARCH_PILOT',
  'CUSTOM',
] as const;

export type PublicOpportunityType = (typeof PUBLIC_OPPORTUNITY_TYPES)[number];
export type PublicOpportunityAvailability = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'UNAVAILABLE';

export type PublicOpportunity = {
  slug: string;
  type: PublicOpportunityType;
  visibility: 'PUBLIC' | 'UNLISTED';
  title: string;
  summary?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  galleryImages?: Array<{
    id: string;
    imageUrl: string | null;
    altText: string;
    caption?: string | null;
    sortOrder: number;
  }>;
  tags: string[];
  referenceCode?: string | null;
  audienceLabel?: string | null;
  commitmentLabel?: string | null;
  commercialLabel?: string | null;
  ctaLabel?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aeoSummary?: string | null;
  aeoQuestions?: Array<{ question: string; answer: string }> | null;
  departmentLabel?: string | null;
  locationMode?: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE' | null;
  locationLabel?: string | null;
  countryCode?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  featured: boolean;
  availability: PublicOpportunityAvailability;
  publishedAt?: string | null;
  application:
    | { mode: 'ENTERPRISE_FORM'; available: boolean; href: string | null; formSlug: string | null }
    | { mode: 'EXTERNAL_URL'; available: boolean; href: string | null }
    | { mode: 'NONE'; available: false; href: null };
};

export type PublicOpportunityList = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: PublicOpportunity[];
};

function gatewayBase() {
  return String(
    process.env.APIGW_BASE ||
      process.env.APIGW_BASE_URL ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://api-gateway.ambulantplus.co.za'
        : 'http://localhost:3010'),
  ).replace(/\/+$/, '');
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function fetchPublicOpportunities(input: {
  q?: string;
  type?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PublicOpportunityList> {
  const url = new URL(`${gatewayBase()}/api/opportunities/public`);
  if (input.q?.trim()) url.searchParams.set('q', input.q.trim().slice(0, 240));
  if (input.type && PUBLIC_OPPORTUNITY_TYPES.includes(input.type as PublicOpportunityType)) {
    url.searchParams.set('type', input.type);
  }
  url.searchParams.set('page', String(Math.max(1, input.page || 1)));
  url.searchParams.set('pageSize', String(Math.min(50, Math.max(1, input.pageSize || 20))));

  const response = await fetch(url.toString(), { cache: 'no-store' });
  const json = await safeJson(response);
  if (!response.ok || !json?.ok || !Array.isArray(json.items)) {
    throw new Error(json?.error || 'public_opportunity_list_failed');
  }
  return json as PublicOpportunityList;
}

export async function fetchPublicOpportunity(slug: string): Promise<PublicOpportunity | null> {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) return null;

  const response = await fetch(
    `${gatewayBase()}/api/opportunities/public/${encodeURIComponent(cleanSlug)}`,
    { cache: 'no-store' },
  );
  const json = await safeJson(response);
  if (response.status === 404) return null;
  if (!response.ok || !json?.ok || !json.opportunity) {
    throw new Error(json?.error || 'public_opportunity_detail_failed');
  }
  return json.opportunity as PublicOpportunity;
}
