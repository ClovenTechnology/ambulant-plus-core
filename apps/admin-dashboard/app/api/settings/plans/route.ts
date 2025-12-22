// apps/admin-dashboard/app/api/settings/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), '../../packages/admin/plans.json');

type ClinicianPlan = {
  id: 'solo' | 'starter' | 'team' | 'group'; // for now, fixed IDs
  actor: 'clinician';
  label: string;
  description: string;
  currency: 'ZAR';
  monthlySubscriptionZar: number;
  payoutSharePct: number;
  includedAdminSlots: number;
  maxAdminSlots: number;
  extraAdminSlotZar?: number | null;
  recommendedFor: string;
  highlight?: boolean;
  enabled: boolean;
};

type PlansConfig = {
  clinicianPlans: ClinicianPlan[];
};

async function readJsonSafe(p: string): Promise<PlansConfig> {
  try {
    const txt = await fs.readFile(p, 'utf-8');
    const clean = txt.replace(/^\uFEFF/, '');
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed.clinicianPlans)) {
      throw new Error('invalid_plans_format');
    }
    return parsed as PlansConfig;
  } catch {
    // fallback to defaults matching your current UI
    const fallback: PlansConfig = {
      clinicianPlans: [
        {
          id: 'solo',
          actor: 'clinician',
          label: 'Solo (Free)',
          description:
            'Single clinician, no additional admin staff. Ideal for early adopters testing Ambulant+.',
          currency: 'ZAR',
          monthlySubscriptionZar: 0,
          payoutSharePct: 0.8,
          includedAdminSlots: 0,
          maxAdminSlots: 1,
          extraAdminSlotZar: null,
          recommendedFor: 'Part-time virtual clinics and side practices.',
          highlight: false,
          enabled: true,
        },
        {
          id: 'starter',
          actor: 'clinician',
          label: 'Starter (Premium)',
          description:
            'Clinician + 1 admin assistant for booking, follow-ups and Smart ID dispatch.',
          currency: 'ZAR',
          monthlySubscriptionZar: 399,
          payoutSharePct: 0.82,
          includedAdminSlots: 1,
          maxAdminSlots: 2,
          extraAdminSlotZar: 149,
          recommendedFor:
            'Solo practices with one receptionist or practice manager.',
          highlight: true,
          enabled: true,
        },
        {
          id: 'team',
          actor: 'clinician',
          label: 'Team',
          description:
            'Designed for small group practices with shared admin pool.',
          currency: 'ZAR',
          monthlySubscriptionZar: 799,
          payoutSharePct: 0.84,
          includedAdminSlots: 3,
          maxAdminSlots: 5,
          extraAdminSlotZar: 129,
          recommendedFor:
            '2–4 clinicians sharing 2–3 admin assistants.',
          highlight: false,
          enabled: true,
        },
        {
          id: 'group',
          actor: 'clinician',
          label: 'Group',
          description:
            'High-volume multi-disciplinary practices with more complex admin workflows.',
          currency: 'ZAR',
          monthlySubscriptionZar: 1499,
          payoutSharePct: 0.86,
          includedAdminSlots: 5,
          maxAdminSlots: 10,
          extraAdminSlotZar: 99,
          recommendedFor:
            'Clinics with centralised admin/call-centre staff.',
          highlight: false,
          enabled: true,
        },
      ],
    };
    return fallback;
  }
}

function validate(body: any): PlansConfig {
  const out: PlansConfig = {
    clinicianPlans: [],
  };

  const arr = Array.isArray(body?.clinicianPlans)
    ? body.clinicianPlans
    : [];

  const clampPct = (v: any) =>
    Math.max(0, Math.min(1, Number(v ?? 0)));

  for (const raw of arr) {
    const id = String(raw.id || '').trim() as ClinicianPlan['id'];
    if (!['solo', 'starter', 'team', 'group'].includes(id)) {
      // for now we only allow these four IDs; later we can relax this
      continue;
    }
    const plan: ClinicianPlan = {
      id,
      actor: 'clinician',
      label: String(raw.label || '').trim() || id,
      description: String(raw.description || '').trim(),
      currency: 'ZAR',
      monthlySubscriptionZar: Math.max(
        0,
        Math.round(Number(raw.monthlySubscriptionZar || 0)),
      ),
      payoutSharePct: clampPct(raw.payoutSharePct),
      includedAdminSlots: Math.max(
        0,
        Math.round(Number(raw.includedAdminSlots || 0)),
      ),
      maxAdminSlots: Math.max(
        0,
        Math.round(Number(raw.maxAdminSlots || 0)),
      ),
      extraAdminSlotZar:
        raw.extraAdminSlotZar != null
          ? Math.max(
              0,
              Math.round(Number(raw.extraAdminSlotZar || 0)),
            )
          : null,
      recommendedFor: String(raw.recommendedFor || '').trim(),
      highlight: Boolean(raw.highlight),
      enabled: raw.enabled === false ? false : true,
    };
    out.clinicianPlans.push(plan);
  }

  // Ensure we always have at least one plan
  if (out.clinicianPlans.length === 0) {
    return (body as PlansConfig) ?? { clinicianPlans: [] };
  }

  return out;
}

export async function GET() {
  const cfg = await readJsonSafe(filePath);
  return NextResponse.json(cfg);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const clean = validate(body);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(clean, null, 2),
    'utf-8',
  );
  return NextResponse.json({ ok: true });
}
