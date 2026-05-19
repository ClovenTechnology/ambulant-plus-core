// apps/patient-app/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { store, UserSettings } from '@/lib/store';

export const dynamic = 'force-dynamic';

const appSettings = z.object({
  contactEmail: z.string().email(),
  notifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  shareData: z.boolean(),
});

const glucoseSettings = z.object({
  fastingHigh: z.number(),
  nonFastingHigh: z.number(),
  lowTarget: z.number(),
  alertCountThreshold: z.number(),
  alertWindowDays: z.number(),
  unit: z.enum(['mmol_l', 'mg_dl']),
  updatedAt: z.string().optional(),
});

const schema = z.union([appSettings, glucoseSettings]);

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function readUserId(req: NextRequest) {
  return (
    req.headers.get('x-ambulant-user-id') ||
    req.headers.get('x-user-id') ||
    req.headers.get('x-uid') ||
    ''
  ).trim();
}

function ensureSettings(userId: string): UserSettings {
  let s = store.settings.get(userId);

  if (!s) {
    s = {
      userId,
      contactEmail: '',
      notifications: true,
      theme: 'system',
      shareData: true,
    };
    store.settings.set(userId, s);
  }

  return s;
}

export async function GET(req: NextRequest) {
  const userId = readUserId(req);

  if (!userId) {
    return json({ ok: false, error: 'patient_identity_required' }, 401);
  }

  const s = ensureSettings(userId);
  return json({ ok: true, settings: s });
}

export async function POST(req: NextRequest) {
  const userId = readUserId(req);

  if (!userId) {
    return json({ ok: false, error: 'patient_identity_required' }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return json(
      { ok: false, message: 'Invalid settings', issues: parsed.error.issues },
      400,
    );
  }

  if ('fastingHigh' in parsed.data) {
    const current = ensureSettings(userId) as any;
    const next = {
      ...(current || {}),
      glucose: { ...(current?.glucose || {}), ...parsed.data },
    };

    store.settings.set(userId, next);
    return json({ ok: true, settings: next });
  }

  const current = ensureSettings(userId);
  const next: UserSettings = { ...current, ...parsed.data };

  store.settings.set(userId, next);
  return json({ ok: true, settings: next });
}