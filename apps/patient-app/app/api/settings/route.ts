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

type AnySettings = z.infer<typeof schema> & { userId?: string };

function ensureSettings(userId: string): UserSettings {
  let s = store.settings.get(userId);
  if (!s) {
    s = {
      userId,
      contactEmail: 'patient@example.com',
      notifications: true,
      theme: 'system',
      shareData: true,
    };
    store.settings.set(userId, s);
  }
  return s;
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-uid') || 'anon';
  const s = ensureSettings(userId);
  return NextResponse.json(s);
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-uid') || 'anon';
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid settings', issues: parsed.error.issues }, { status: 400 });
  }

  // If it's glucose settings, persist under a sub-key
  if ('fastingHigh' in parsed.data) {
    const current = ensureSettings(userId) as any;
    const next = { ...(current || {}), glucose: { ...(current?.glucose || {}), ...parsed.data } };
    store.settings.set(userId, next);
    return NextResponse.json(next);
  }

  // Otherwise it's app-level settings
  const current = ensureSettings(userId);
  const next: UserSettings = { ...current, ...parsed.data };
  store.settings.set(userId, next);
  return NextResponse.json(next);
}
