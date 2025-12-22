// apps/api-gateway/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { sendEmail, sendSms } from '@/src/lib/mailer';
import { verifyAdminRequest } from '../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST -> clinician signup (creates ClinicianProfile). Public.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();
    const specialty = (body.specialty || '').trim();
    const feeZAR = Number.isFinite(Number(body.feeZAR)) ? Math.round(Number(body.feeZAR) * 100) : 0;

    const userId = body.auth0UserId ?? (email || phone ? `${email || phone}` : `anon-${Date.now()}`);

    // persist in prisma
    const rec = await prisma.clinicianProfile.create({
      data: {
        userId,
        displayName: name,
        email: email || null,
        phone: phone || null,
        specialty: specialty || null,
        feeCents: feeZAR,
        status: 'pending',
        trainingCompleted: false,
      },
    });

    // send invites (best-effort) - use templated email/SMS
    const link = `${
      process.env.NEXT_PUBLIC_BASE_URL ?? ''
    }/training/schedule?clinicianId=${encodeURIComponent(rec.id)}`;

    if (email) {
      const subject = 'Ambulant+ — Complete your training to go live';
      const html = `<p>Hi ${name || ''},</p>
        <p>Thanks for signing up. Please schedule your mandatory clinician training here: <a href="${link}">Schedule training</a></p>`;
      sendEmail(email, subject, html).catch(() => {});
    }
    if (phone) {
      sendSms(phone, `Welcome to Ambulant+. Schedule training: ${link}`).catch(() => {});
    }

    return NextResponse.json({ ok: true, clinician: rec }, { status: 201 });
  } catch (err: any) {
    console.error('clinicians POST error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// GET -> admin-only: list clinicians
export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const where: any = {};
    if (status) where.status = status;

    const items = await prisma.clinicianProfile.findMany({ where, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ ok: true, clinicians: items });
  } catch (err: any) {
    console.error('clinicians GET error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// PATCH -> admin update status / schedule training / mark trainingCompleted
export async function PATCH(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const body = await req.json().catch(() => ({} as any));
    const id = body?.id;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

    const data: any = {};

    if (body.status) {
      const status = String(body.status);
      data.status = status;

      // keep boolean flags roughly in sync
      if (status === 'disabled') {
        data.disabled = true;
        data.archived = false;
      } else if (status === 'archived') {
        data.archived = true;
        data.disabled = false;
      } else {
        // active, pending, disciplinary, rejected, etc
        data.disabled = false;
        // only clear archived when explicitly re-activating
        if (status === 'active' || status === 'pending') data.archived = false;
      }
    }

    if (typeof body.trainingCompleted === 'boolean') data.trainingCompleted = body.trainingCompleted;
    if (body.trainingScheduledAt) data.trainingScheduledAt = new Date(body.trainingScheduledAt);
    if (typeof body.disabled === 'boolean') data.disabled = body.disabled;
    if (typeof body.archived === 'boolean') data.archived = body.archived;

    const updated = await prisma.clinicianProfile.update({ where: { id }, data });
    return NextResponse.json({ ok: true, clinician: updated });
  } catch (err: any) {
    console.error('clinicians PATCH error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// DELETE -> admin-only soft-archive (set status='archived')
export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const url = new URL(req.url);
    const id =
      url.searchParams.get('id') ||
      (await req.json().catch(() => ({})).then((b: any) => b?.id));
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

    const profile = await prisma.clinicianProfile.update({
      where: { id },
      data: { status: 'archived', archived: true, disabled: false },
    });
    return NextResponse.json({ ok: true, clinician: profile });
  } catch (err: any) {
    console.error('clinicians DELETE error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
