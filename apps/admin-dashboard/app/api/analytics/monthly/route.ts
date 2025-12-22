// apps/admin-dashboard/app/api/analytics/monthly/route.ts
import { NextResponse } from 'next/server';

/* ---------- Types (keep in sync with frontend Monthly/Daily pages) ---------- */

type PayerMix = {
  card: number;
  medicalAid: number;
  voucher: number;
  other: number;
};

type DailyPoint = {
  date: string; // yyyy-mm-dd
  revenueZAR: number;
  consultations: number;
  deliveries: number;
  draws: number;

  rxPharmCount?: number;
  rxLabCount?: number;
  sickNotes?: number;
  fitnessCerts?: number;
  referralsInternal?: number;
  referralsExternal?: number;
  followUps?: number;
  appointments?: number;
  closedCases?: number;

  payerMix?: PayerMix;
  avgRating?: number;
};

type RatingEntity =
  | 'clinician'
  | 'phleb'
  | 'admin'
  | 'rider'
  | 'lab'
  | 'pharmacy';

type RatingSnapshot = {
  entity: RatingEntity;
  min: number;
  max: number;
  avg: number;
};

type TopPartner = {
  kind: 'lab' | 'pharmacy' | 'network' | 'other';
  name: string;
  revenueZAR: number;
};

type MonthlyPayload = {
  month: string; // yyyy-mm
  revenueZAR: number;
  deliveries: number;
  labTests: number;
  consultations: number;

  // Extended monthly metrics (all optional in UI)
  rxPharmCount?: number;
  rxLabCount?: number;
  sickNotes?: number;
  fitnessCerts?: number;
  referralsInternal?: number;
  referralsExternal?: number;
  followUps?: number;
  appointments?: number;
  closedCases?: number;
  erxFulfilledCareport?: number;
  erxFulfilledMedreach?: number;

  ratings?: RatingSnapshot[];
  daily?: DailyPoint[];
  topPartners?: TopPartner[];

  // Optional monthly-level payer mix (if you want later)
  payerMix?: PayerMix;
};

/* ---------- Helpers ---------- */

function daysInMonth(ym: string): number {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = Number(monthStr) || 1;
  return new Date(year, month, 0).getDate();
}

function currentMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function clampRating(v: number) {
  if (!Number.isFinite(v)) return 4.0;
  if (v < 3.0) return 3.0;
  if (v > 5.0) return 5.0;
  return v;
}

/* ---------- Fallback builder (single source of synthetic truth) ---------- */

function buildFallbackMonthly(month: string): MonthlyPayload {
  const baseRevenue = 512_000;
  const baseDeliveries = 842;
  const baseLabTests = 391;
  const baseConsults = 1_260;

  const days = daysInMonth(month);
  const daily: DailyPoint[] = Array.from(
    { length: days },
    (_, idx): DailyPoint => {
      const day = idx + 1;
      const t = (idx / days) * Math.PI * 2;
      const factor = 0.75 + 0.4 * Math.sin(t);
      const revenueZAR = Math.round((baseRevenue / days) * factor);
      const consultations = Math.round((baseConsults / days) * factor);
      const deliveries = Math.round((baseDeliveries / days) * factor);
      const draws = Math.round(
        (baseLabTests / days) * (0.6 + 0.3 * factor),
      );

      const rxPharmCount = Math.round(consultations * 0.7);
      const rxLabCount = Math.round(consultations * 0.3);
      const sickNotes = Math.round(consultations * 0.15);
      const referralsInternal = Math.round(consultations * 0.18);
      const referralsExternal = Math.round(consultations * 0.05);
      const followUps = Math.round(consultations * 0.25);
      const appointments = Math.round(consultations * 0.4);
      const closedCases = Math.round(consultations * 0.3);

      const payerTotal = Math.max(consultations, 1);
      const card = Math.round(payerTotal * 0.5);
      const medicalAid = Math.round(payerTotal * 0.3);
      const voucher = Math.round(payerTotal * 0.15);
      const other = Math.max(
        payerTotal - card - medicalAid - voucher,
        0,
      );

      const payerMix: PayerMix = {
        card,
        medicalAid,
        voucher,
        other,
      };

      const avgRating = clampRating(4.3 + 0.3 * Math.sin(t));

      const date = `${month}-${String(day).padStart(2, '0')}`;
      return {
        date,
        revenueZAR,
        consultations,
        deliveries,
        draws,
        rxPharmCount,
        rxLabCount,
        sickNotes,
        referralsInternal,
        referralsExternal,
        followUps,
        appointments,
        closedCases,
        payerMix,
        avgRating,
      };
    },
  );

  // Sum up extended monthly metrics from daily so things line up
  const monthlyRxPharm = daily.reduce(
    (acc, d) => acc + (d.rxPharmCount ?? 0),
    0,
  );
  const monthlyRxLab = daily.reduce(
    (acc, d) => acc + (d.rxLabCount ?? 0),
    0,
  );
  const monthlySickNotes = daily.reduce(
    (acc, d) => acc + (d.sickNotes ?? 0),
    0,
  );
  const monthlyRefInt = daily.reduce(
    (acc, d) => acc + (d.referralsInternal ?? 0),
    0,
  );
  const monthlyRefExt = daily.reduce(
    (acc, d) => acc + (d.referralsExternal ?? 0),
    0,
  );
  const monthlyFollowUps = daily.reduce(
    (acc, d) => acc + (d.followUps ?? 0),
    0,
  );
  const monthlyAppointments = daily.reduce(
    (acc, d) => acc + (d.appointments ?? 0),
    0,
  );
  const monthlyClosedCases = daily.reduce(
    (acc, d) => acc + (d.closedCases ?? 0),
    0,
  );

  const ratings: RatingSnapshot[] = [
    { entity: 'clinician', min: 3.9, max: 4.9, avg: 4.6 },
    { entity: 'phleb', min: 4.1, max: 5.0, avg: 4.7 },
    { entity: 'admin', min: 3.7, max: 4.8, avg: 4.3 },
    { entity: 'rider', min: 3.8, max: 4.9, avg: 4.5 },
    { entity: 'lab', min: 4.0, max: 4.9, avg: 4.6 },
    { entity: 'pharmacy', min: 3.8, max: 4.8, avg: 4.4 },
  ];

  const topPartners: TopPartner[] = [
    {
      kind: 'pharmacy',
      name: 'Ambulant Pharmacy Network',
      revenueZAR: 182_400,
    },
    {
      kind: 'lab',
      name: 'Ambulant Labs — Cape Town',
      revenueZAR: 126_900,
    },
    {
      kind: 'lab',
      name: 'Ambulant Labs — Johannesburg',
      revenueZAR: 98_500,
    },
    {
      kind: 'network',
      name: 'Ambulant+ External Network',
      revenueZAR: 52_200,
    },
  ];

  const payerMix: PayerMix = {
    card: Math.round(monthlyAppointments * 0.5),
    medicalAid: Math.round(monthlyAppointments * 0.3),
    voucher: Math.round(monthlyAppointments * 0.15),
    other: Math.round(monthlyAppointments * 0.05),
  };

  return {
    month,
    revenueZAR: baseRevenue,
    deliveries: baseDeliveries,
    labTests: baseLabTests,
    consultations: baseConsults,
    rxPharmCount: monthlyRxPharm,
    rxLabCount: monthlyRxLab,
    sickNotes: monthlySickNotes,
    fitnessCerts: Math.round(monthlyAppointments * 0.08),
    referralsInternal: monthlyRefInt,
    referralsExternal: monthlyRefExt,
    followUps: monthlyFollowUps,
    appointments: monthlyAppointments,
    closedCases: monthlyClosedCases,
    erxFulfilledCareport: Math.round(monthlyRxPharm * 0.82),
    erxFulfilledMedreach: Math.round(monthlyRxLab * 0.88),
    ratings,
    daily,
    topPartners,
    payerMix,
  };
}

/* ---------- GET handler (APIGW + fallback) ---------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const monthParam = url.searchParams.get('month') || currentMonthString();
  const month = monthParam.slice(0, 7); // normalise yyyy-mm-dd -> yyyy-mm

  // Optional APIGW integration:
  // Set for example ANALYTICS_APIGW_BASE_URL="https://api.yourdomain.com"
  const apigwBase =
    process.env.ANALYTICS_APIGW_BASE_URL ||
    process.env.AMBULANT_APIGW_URL ||
    '';

  if (apigwBase) {
    try {
      const upstream = new URL('/analytics/monthly', apigwBase);
      upstream.searchParams.set('month', month);

      const res = await fetch(upstream.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (res.ok) {
        const json = (await res.json()) as MonthlyPayload;
        // We trust upstream to send the full payload; if it at least has core fields,
        // the frontend will still fall back on its own optional defaults.
        return NextResponse.json(json);
      }
      // If upstream returns non-200, we fall through to local synthetic snapshot.
      console.error(
        '[analytics/monthly] Upstream APIGW non-OK:',
        res.status,
        await res.text().catch(() => ''),
      );
    } catch (e) {
      console.error(
        '[analytics/monthly] Upstream APIGW error:',
        e,
      );
    }
  }

  // Graceful fallback: local synthetic snapshot with daily breakdown
  const fallback = buildFallbackMonthly(month);
  return NextResponse.json(fallback);
}
