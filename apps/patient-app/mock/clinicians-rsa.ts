// apps/patient-app/mock/clinicians-rsa.ts
// apps/patient-app/mock/clinicians-rsa.ts
import { buildCliniciansForCountry, type Clinician } from './clinicians.factory';

export const COUNTRY_RSA = {
  code: 'ZA',
  name: 'South Africa',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
};

const RSA_BASE_PRICE_CENTS = {
  doctor: 65000,
  allied: 45000,
  wellness: 35000,
} as const;

function resolveTier(c: any): keyof typeof RSA_BASE_PRICE_CENTS {
  const t = String(
    c?.tier ??
      c?.kind ??
      c?.role ??
      c?.type ??
      c?.profession ??
      c?.providerType ??
      '',
  ).toLowerCase();

  if (/(doctor|gp|physician|specialist|surgeon)/.test(t)) return 'doctor';
  if (/(allied|nurse|therap|physio|psych|diet|counsel|optom|pharmac|radiograph)/.test(t)) return 'allied';
  if (/(wellness|coach|fitness|lifestyle)/.test(t)) return 'wellness';

  const s = String(c?.specialty ?? c?.speciality ?? '').toLowerCase();
  if (/(gp|doctor|physician|specialist|surgeon)/.test(s)) return 'doctor';
  if (/(nurse|therap|physio|psych|diet|counsel|optom|pharmac)/.test(s)) return 'allied';

  // safest default for demo: doctor
  return 'doctor';
}

function normalizeFees(c: any) {
  const tier = resolveTier(c);
  const priceCents = Number.isFinite(Number(c?.priceCents))
    ? Number(c.priceCents)
    : RSA_BASE_PRICE_CENTS[tier];

  // sensible defaults (used by booking-profile + calendar UI)
  const durationMin =
    Number.isFinite(Number(c?.durationMin))
      ? Number(c.durationMin)
      : tier === 'doctor'
        ? 45
        : tier === 'allied'
          ? 40
          : 30;

  const bufferMin =
    Number.isFinite(Number(c?.bufferMin))
      ? Number(c.bufferMin)
      : 5;

  const currency = (c?.currency || COUNTRY_RSA.currency) as string;

  // Provide multiple back-compat fee fields used across older screens/routes.
  // Extra props are fine at runtime even if Clinician type doesn’t declare them.
  return {
    ...c,
    countryCode: c?.countryCode || COUNTRY_RSA.code,
    countryName: c?.countryName || COUNTRY_RSA.name,
    timezone: c?.timezone || COUNTRY_RSA.timezone,
    currency,

    // Common “single fee” fields:
    priceCents,
    feeCents: priceCents,
    consultFeeCents: priceCents,
    startingFromCents: priceCents,

    // Booking-profile-style shape:
    fees: c?.fees ?? {
      standard: { priceCents, currency, durationMin, bufferMin },
      followUp: {
        priceCents: Math.max(1000, Math.round(priceCents * 0.6)),
        currency,
        durationMin: Math.max(10, Math.round(durationMin * 0.6)),
        bufferMin,
      },
    },
  };
}

const RAW_RSA = buildCliniciansForCountry({
  seed: 'ZA-rsa-v1',
  countryCode: 'ZA',
  countryName: 'South Africa',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  nameStyle: 'southern_africa',
  cities: [
    'Johannesburg',
    'Cape Town',
    'Durban',
    'Pretoria',
    'Gqeberha',
    'Bloemfontein',
    'Polokwane',
    'Mbombela',
    'Kimberley',
    'Rustenburg',
    'East London',
    'Pietermaritzburg',
  ],
  languages: ['English', 'Afrikaans', 'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana'],
  basePriceCents: { doctor: 65000, allied: 45000, wellness: 35000 },
  counts: { doctors: 28, allied: 20, wellness: 14 },
});

// ✅ Normalized so ZA clinicians always have fee fields expected by UI/routes.
export const CLINICIANS_RSA: Clinician[] = RAW_RSA.map((c) => normalizeFees(c) as Clinician);
