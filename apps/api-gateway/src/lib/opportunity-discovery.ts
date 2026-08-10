export type OpportunityDiscoveryInput = {
  title: string;
  type?: string | null;
  summary?: string | null;
  description?: string | null;
  tags?: string[] | null;
  audienceLabel?: string | null;
  commitmentLabel?: string | null;
  commercialLabel?: string | null;
  departmentLabel?: string | null;
  locationMode?: string | null;
  locationLabel?: string | null;
  countryCode?: string | null;
  opensAt?: Date | string | null;
  closesAt?: Date | string | null;
  ctaLabel?: string | null;
};

export type OpportunityAnswer = {
  question: string;
  answer: string;
};

const GENERATOR_VERSION = 'opportunity-discovery-v1';

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sentence(value: unknown, max: number) {
  const text = clean(value, max);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function plainText(value: unknown, max: number) {
  return clean(
    String(value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[*_#>`~-]+/g, ' '),
    max,
  );
}

function firstUsefulSentence(value: unknown, max: number) {
  const text = plainText(value, max * 3);
  if (!text) return '';
  const match = text.match(/^(.{30,}?[.!?])(?:\s|$)/);
  return clean(match?.[1] || text, max);
}

function humanType(value: unknown) {
  const raw = clean(value, 80).toUpperCase();
  const labels: Record<string, string> = {
    CAREER_JOB: 'career opportunity',
    INTERNSHIP_GRADUATE: 'internship or graduate opportunity',
    ONBOARDING: 'onboarding opportunity',
    PARTNERSHIP: 'partnership opportunity',
    FRANCHISE: 'franchise opportunity',
    VENDOR_PROVIDER: 'service-provider opportunity',
    RESEARCH_PILOT: 'research opportunity',
    CUSTOM: 'opportunity',
  };
  return labels[raw] || 'opportunity';
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'long',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}

function locationAnswer(input: OpportunityDiscoveryInput) {
  const label = clean(input.locationLabel, 240);
  const mode = clean(input.locationMode, 80).toLowerCase();
  const country = clean(input.countryCode, 2).toUpperCase();
  if (label && mode) return `${label} (${mode.replace(/_/g, ' ')}).`;
  if (label) return `${label}.`;
  if (mode) return `${mode.replace(/_/g, ' ')}${country ? ` in ${country}` : ''}.`;
  return country ? `The opportunity is listed for ${country}.` : '';
}

function makeSeoTitle(input: OpportunityDiscoveryInput) {
  const base = clean(input.title, 160);
  const location = clean(input.locationLabel, 80);
  const department = clean(input.departmentLabel, 80);
  const suffix = location || department;
  const candidate = suffix ? `${base} | ${suffix} | Ambulant+` : `${base} | Ambulant+`;
  if (candidate.length <= 70) return candidate;
  const compact = `${base} | Ambulant+`;
  return compact.length <= 70 ? compact : clean(base, 68);
}

function makeSeoDescription(input: OpportunityDiscoveryInput) {
  const summary = firstUsefulSentence(input.summary, 155);
  if (summary) return clean(summary, 160);
  const description = firstUsefulSentence(input.description, 155);
  if (description) return clean(description, 160);

  const parts = [
    `Explore ${clean(input.title, 100)} with Ambulant+.`,
    clean(input.audienceLabel, 80) ? `For ${clean(input.audienceLabel, 80)}.` : '',
    locationAnswer(input),
    clean(input.commitmentLabel, 80) ? `${clean(input.commitmentLabel, 80)}.` : '',
  ].filter(Boolean);
  return clean(parts.join(' '), 160);
}

function makeAeoSummary(input: OpportunityDiscoveryInput) {
  const summary = firstUsefulSentence(input.summary, 340);
  const description = firstUsefulSentence(input.description, 340);
  const parts = [
    summary || description || `${clean(input.title, 180)} is an Ambulant+ ${humanType(input.type)}.`,
    clean(input.audienceLabel, 180) ? `It is intended for ${clean(input.audienceLabel, 180)}.` : '',
    locationAnswer(input),
    clean(input.commitmentLabel, 180) ? `Commitment: ${clean(input.commitmentLabel, 180)}.` : '',
    dateLabel(input.closesAt) ? `Applications close ${dateLabel(input.closesAt)}.` : '',
  ].filter(Boolean);
  return clean(parts.join(' '), 1000);
}

function makeQuestions(input: OpportunityDiscoveryInput): OpportunityAnswer[] {
  const answers: OpportunityAnswer[] = [];
  const push = (question: string, answer: string) => {
    const q = clean(question, 240);
    const a = clean(answer, 1000);
    if (q && a) answers.push({ question: q, answer: sentence(a, 1000) });
  };

  push(
    'What is this opportunity?',
    firstUsefulSentence(input.summary, 600) ||
      firstUsefulSentence(input.description, 600) ||
      `${clean(input.title, 180)} is an Ambulant+ ${humanType(input.type)}`,
  );

  if (clean(input.audienceLabel, 200)) {
    push('Who is this opportunity for?', clean(input.audienceLabel, 500));
  }

  const location = locationAnswer(input);
  if (location) push('Where is the opportunity based?', location);

  if (clean(input.commitmentLabel, 200)) {
    push('What is the expected commitment?', clean(input.commitmentLabel, 500));
  }

  if (clean(input.commercialLabel, 240)) {
    push('What are the compensation or commercial terms?', clean(input.commercialLabel, 700));
  }

  const close = dateLabel(input.closesAt);
  if (close) push('When do applications close?', `Applications close ${close}`);

  const open = dateLabel(input.opensAt);
  if (open) push('When do applications open?', `Applications open ${open}`);

  push(
    'How do I apply?',
    clean(input.ctaLabel, 80)
      ? `${clean(input.ctaLabel, 80)} using the application option on this opportunity page`
      : 'Use the application option shown on this opportunity page',
  );

  return answers.slice(0, 8);
}

export function generateOpportunityDiscovery(input: OpportunityDiscoveryInput) {
  const seoTitle = makeSeoTitle(input);
  const seoDescription = makeSeoDescription(input);
  const aeoSummary = makeAeoSummary(input);
  const aeoQuestions = makeQuestions(input);

  return {
    seoTitle,
    seoDescription,
    aeoSummary,
    aeoQuestions,
    discoveryMeta: {
      generator: GENERATOR_VERSION,
      generatedAt: new Date().toISOString(),
      principles: [
        'people-first',
        'visible-content-only',
        'structured-facts',
        'manual-edits-preserved',
      ],
    },
  };
}

export function opportunityDiscoveryGeneratorVersion() {
  return GENERATOR_VERSION;
}
