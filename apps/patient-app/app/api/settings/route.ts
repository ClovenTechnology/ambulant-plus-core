// apps/patient-app/app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { store, UserSettings } from '@/lib/store';

export const dynamic = 'force-dynamic';

const schema = z.object({
  contactEmail: z.string().email(),
  notifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  shareData: z.boolean(),
});

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
  const current = ensureSettings(userId);
  const next: UserSettings = { ...current, ...parsed.data };
  store.settings.set(userId, next);
  return NextResponse.json(next);
}
