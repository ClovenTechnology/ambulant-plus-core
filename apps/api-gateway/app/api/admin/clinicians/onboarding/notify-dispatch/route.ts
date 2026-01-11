//apps/api-gateway/app/api/admin/clinicians/onboarding/notify-dispatch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { sendEmail, sendSms } from '@/src/lib/mailer';
import { verifyAdminRequest } from '../../../../utils/auth';

import {
  buildStarterKitDispatchEmail,
  type ClinicianDispatchItem as EmailDispatchItem,
} from '@/src/emails/buildStarterKitDispatchEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(v: any, max = 240): string | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeKind(v: any): EmailDispatchItem['kind'] {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (s === 'device' || s === 'merch' || s === 'paperwork' || s === 'other') return s as any;
  if (s.includes('device') || s.includes('iot') || s.includes('monitor')) return 'device';
  if (s.includes('merch') || s.includes('hoodie') || s.includes('shirt')) return 'merch';
  if (s.includes('paper') || s.includes('doc')) return 'paperwork';
  return 'other';
}

/**
 * POST /api/admin/clinicians/onboarding/notify-dispatch
 * Body:
 * {
 *   dispatchId: string,
 *   channels?: Array<'email'|'sms'>,   // default: ['email'] if clinician has email else ['sms']
 *   overrideEmail?: string,
 *   overridePhone?: string,
 *   supportEmail?: string,
 *   supportPhone?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as any;
    const dispatchId = cleanStr(body.dispatchId, 80);
    if (!dispatchId) return NextResponse.json({ ok: false, error: 'dispatchId required' }, { status: 400 });

    const dispatch = await prisma.clinicianDispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });

    if (!dispatch) return NextResponse.json({ ok: false, error: 'dispatch_not_found' }, { status: 404 });

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: dispatch.clinicianId },
    });

    if (!clinician) {
      return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });
    }

    const clinicianName = (clinician.displayName || '').trim() || 'there';

    const overrideEmail = cleanStr(body.overrideEmail, 320);
    const overridePhone = cleanStr(body.overridePhone, 64);

    const clinicianEmail = overrideEmail || cleanStr(clinician.email, 320);
    const clinicianPhone = overridePhone || cleanStr(clinician.phone, 64);

    const requestedChannels = Array.isArray(body.channels) ? (body.channels as any[]) : null;
    const channels: Array<'email' | 'sms'> = requestedChannels?.length
      ? requestedChannels.filter((c) => c === 'email' || c === 'sms')
      : clinicianEmail
        ? ['email']
        : ['sms'];

    const items: EmailDispatchItem[] = (dispatch.items || []).map((it) => ({
      id: it.id,
      dispatchId: dispatch.id,
      kind: normalizeKind(it.kind),
      name: it.label || 'Item',
      sku: null,
      deviceId: it.deviceId ?? null,
      serialNumber: null,
      quantity: it.quantity ?? 1,
    }));

    const emailSent: { ok: boolean; error?: string } = { ok: false };
    const smsSent: { ok: boolean; error?: string } = { ok: false };

    // Email
    if (channels.includes('email')) {
      if (!clinicianEmail) {
        emailSent.ok = false;
        emailSent.error = 'no_email_on_profile';
      } else {
        const payload = buildStarterKitDispatchEmail({
          clinicianName,
          clinicianEmail,
          dispatchId: dispatch.id,
          courierName: dispatch.courier || null,
          trackingCode: dispatch.trackingCode || null,
          trackingUrl: dispatch.trackingUrl || null,
          estimatedDeliveryDate: dispatch.etaDate ? dispatch.etaDate.toDateString() : null,
          items,
          supportEmail: cleanStr(body.supportEmail, 320) || undefined,
          supportPhone: cleanStr(body.supportPhone, 64) || undefined,
        });

        try {
          await sendEmail(payload.to, payload.subject, payload.html);
          emailSent.ok = true;
        } catch (e: any) {
          emailSent.ok = false;
          emailSent.error = String(e?.message || e);
        }
      }
    }

    // SMS
    if (channels.includes('sms')) {
      if (!clinicianPhone) {
        smsSent.ok = false;
        smsSent.error = 'no_phone_on_profile';
      } else {
        const bits: string[] = [];
        bits.push(`Ambulant+: Your starter kit is on the way.`);
        bits.push(`Dispatch ID: ${dispatch.id}`);
        if (dispatch.courier) bits.push(`Courier: ${dispatch.courier}`);
        if (dispatch.trackingCode) bits.push(`Tracking: ${dispatch.trackingCode}`);
        if (dispatch.trackingUrl) bits.push(`Track: ${dispatch.trackingUrl}`);
        try {
          await sendSms(clinicianPhone, bits.join(' | '));
          smsSent.ok = true;
        } catch (e: any) {
          smsSent.ok = false;
          smsSent.error = String(e?.message || e);
        }
      }
    }

    return NextResponse.json({ ok: true, dispatchId, emailSent, smsSent });
  } catch (err: any) {
    console.error('notify-dispatch error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
