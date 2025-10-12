// ============================================================================
// apps/patient-app/app/api/push/test/route.ts
// Sends a test push to the stored subscription if VAPID keys are set.
// ============================================================================
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { __getSubs } from '../subscribe/route';

export async function POST() {
  const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ ok: false, error: 'VAPID keys not set' }, { status: 501 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const subs = __getSubs();
  if (!subs.length) return NextResponse.json({ ok: false, error: 'no subscribers' }, { status: 404 });

  try {
    await webpush.sendNotification(subs[0], JSON.stringify({ title: 'DueCare', body: 'Test push reminder', url: '/' }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'send failed' }, { status: 500 });
  }
}
