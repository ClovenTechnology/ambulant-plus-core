// apps/patient-app/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendSms } from '@/src/lib/mailer';
import { prisma } from '@/src/lib/prisma';
import { authorizeAdminFromHeaders } from '@/src/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ClinicianCreateBody = {
  name?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  feeZAR?: number;
  auth0UserId?: string;
};

// in-memory fallback store (dev only)
let IN_MEM: any[] = [];

// Helper: lightweight Auth0 user creation (best-effort).
// NOTE: operation requires AUTH0_* env vars; if not set, this step is skipped.
async function createAuth0User(email: string, name?: string, password?: string) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) {
    return { ok: false, error: 'missing_auth0' };
  }

  try {
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
        grant_type: 'client_credentials',
      }),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => '');
      return { ok: false, error: 'token_fetch_failed', info: txt };
    }
    const tokenData = await tokenRes.json();
    const mgmtToken = tokenData.access_token;

    const createRes = await fetch(`https://${domain}/api/v2/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        connection: 'Username-Password-Authentication',
        email,
        name,
        password: password ?? `${Math.random().toString(36).slice(2)}A!1`,
        email_verified: false,
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => '');
      return { ok: false, error: `create_failed:${createRes.status}`, info: txt };
    }
    const data = await createRes.json();
    return { ok: true, user: data };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as ClinicianCreateBody));
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').trim();
    const specialty = (body.specialty || '').trim();
    const feeZAR = Number.isFinite(Number(body.feeZAR)) ? Math.round(Number(body.feeZAR) * 100) : 0;

    // Create Auth0 user if email provided and no auth0UserId
    let auth0UserId = body.auth0UserId;
    if (!auth0UserId && email) {
      const authRes = await createAuth0User(email, name);
      if (authRes.ok && authRes.user && authRes.user.user_id) {
        auth0UserId = authRes.user.user_id;
      } else {
        console.warn('Auth0 create user failed', authRes);
      }
    }

    // Persist to Prisma if available
    let rec: any = null;
    try {
      if (prisma && (prisma as any).clinicianProfile) {
        const p = await prisma.clinicianProfile.create({
          data: {
            userId: auth0UserId ?? (email || phone || `anon-${Date.now()}`),
            displayName: name,
            specialty,
            feeCents: feeZAR,
            status: 'pending',
          },
        });
        rec = p;
      } else {
        throw new Error('prisma.clinicianProfile missing');
      }
    } catch (err) {
      const id = `c-${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();
      const item = {
        id,
        userId: auth0UserId ?? email ?? id,
        displayName: name,
        specialty,
        feeCents: feeZAR,
        status: 'pending',
        trainingCompleted: false,
        createdAt: now,
      };
      IN_MEM.unshift(item);
      rec = item;
    }

    // Send training invite via email & SMS (best-effort)
    const trainingLink = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/training/schedule?clinicianId=${encodeURIComponent(rec.id ?? rec.userId ?? '')}`;
    if (email) {
      const subject = 'Ambulant+ Registration Successful — Welcome onboard!';
      const html = `<p>Hi ${name || ''},</p>
        <p>Thanks for signing up. Conclude your mandatory training to start practicing on Ambulant+. Pick a slot: <a href="${trainingLink}">Schedule training</a></p>
        <p>If you have any issues, contact support.</p>`;
      sendEmail(email, subject, html).catch(() => {});
    }
    if (phone) {
      const sms = `Welcome to Ambulant+. Schedule training: ${trainingLink}`;
      sendSms(phone, sms).catch(() => {});
    }

    return NextResponse.json({ ok: true, clinician: rec }, { status: 201 });
  } catch (err: any) {
    console.error('clinicians POST error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // require admin
    const auth = await authorizeAdminFromHeaders(req.headers);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: 'admin_required', reason: auth.reason }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;

    if (prisma && (prisma as any).clinicianProfile) {
      const where: any = {};
      if (status) where.status = status;
      const items = await prisma.clinicianProfile.findMany({ where, orderBy: { createdAt: 'desc' } });
      return NextResponse.json({ ok: true, clinicians: items });
    }

    const items = status ? IN_MEM.filter(i => (i.status ?? '') === status) : IN_MEM.slice();
    return NextResponse.json({ ok: true, clinicians: items });
  } catch (err: any) {
    console.error('clinicians GET error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authorizeAdminFromHeaders(req.headers);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: 'admin_required', reason: auth.reason }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = body?.id ?? body?.userId;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

    const update: any = {};
    if (typeof body.trainingCompleted === 'boolean') update.trainingCompleted = body.trainingCompleted;
    if (body.trainingScheduledAt) update.trainingScheduledAt = new Date(body.trainingScheduledAt);
    if (body.status) update.status = body.status;
    if (typeof body.disabled === 'boolean') update.disabled = body.disabled;
    if (typeof body.archived === 'boolean') update.archived = body.archived;

    try {
      if (prisma && (prisma as any).clinicianProfile) {
        let profile = await prisma.clinicianProfile.findUnique({ where: { userId: id } }).catch(() => null);
        if (!profile) profile = await prisma.clinicianProfile.findUnique({ where: { id } }).catch(() => null);
        if (!profile) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
        const upd = await prisma.clinicianProfile.update({ where: { id: profile.id }, data: update });
        return NextResponse.json({ ok: true, clinician: upd });
      }
      throw new Error('prisma missing');
    } catch (err) {
      const idx = IN_MEM.findIndex(i => i.id === id || i.userId === id);
      if (idx < 0) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      IN_MEM[idx] = { ...IN_MEM[idx], ...update };
      return NextResponse.json({ ok: true, clinician: IN_MEM[idx] });
    }
  } catch (err: any) {
    console.error('clinicians PATCH error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await authorizeAdminFromHeaders(req.headers);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: 'admin_required', reason: auth.reason }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id') || (await req.json().catch(() => ({})).then((b:any)=>b?.id));
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

    try {
      if (prisma && (prisma as any).clinicianProfile) {
        const profile = await prisma.clinicianProfile.update({ where: { id }, data: { status: 'archived', archived: true } });
        return NextResponse.json({ ok: true, clinician: profile });
      }
      throw new Error('prisma not available');
    } catch (err) {
      const idx = IN_MEM.findIndex(i => i.id === id || i.userId === id);
      if (idx >= 0) {
        const removed = IN_MEM.splice(idx, 1)[0];
        return NextResponse.json({ ok: true, removed });
      }
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
  } catch (err: any) {
    console.error('clinicians DELETE error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
