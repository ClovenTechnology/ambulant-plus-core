// apps/patient-app/app/api/rtc/token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return s.replace(/\/+$/, '');
}

function pickBase() {
  return (
    process.env.APIGW_BASE_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    ''
  ).trim();
}

type PatientRtcAuthRole = 'patient' | 'observer';

function normalisePatientRtcAuthRole(value: unknown): PatientRtcAuthRole {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'observer' ? 'observer' : 'patient';
}

function normalisePatientParticipantRole(value: unknown) {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return 'patient';

  if (['patient', 'parent', 'mother', 'father', 'mum', 'mom', 'dad', 'guardian', 'legal-guardian', 'caregiver', 'carer', 'care-ally', 'care-giver', 'partner', 'spouse', 'wife', 'husband', 'couple', 'interpreter', 'translator', 'guest', 'observer'].includes(raw)) {
    if (['mother', 'father', 'mum', 'mom', 'dad'].includes(raw)) return 'parent';
    if (raw === 'legal-guardian') return 'guardian';
    if (['carer', 'care-ally', 'care-giver'].includes(raw)) return 'caregiver';
    if (['spouse', 'wife', 'husband', 'couple'].includes(raw)) return 'partner';
    if (raw === 'translator') return 'interpreter';
    return raw;
  }

  return 'patient';
}

function readRefererContext(req: NextRequest) {
  try {
    const ref = req.headers.get('referer') || '';
    if (!ref) return {} as Record<string, string>;
    const u = new URL(ref);
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const v = u.searchParams.get(key);
        if (v && v.trim()) return v.trim();
      }
      return '';
    };

    return {
      participantRole: get('participantRole', 'speakerRole', 'role'),
      relationshipToPatient: get('relationshipToPatient', 'relationship'),
      participantName: get('participantName', 'displayName', 'name'),
      encounterId: get('encounterId', 'encounter', 'enc'),
      appointmentId: get('appointmentId', 'appointment', 'appt'),
      visitId: get('visitId', 'visit'),
    };
  } catch {
    return {} as Record<string, string>;
  }
}

export async function POST(req: NextRequest) {
  const base = pickBase();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'Missing APIGW_BASE_URL (or NEXT_PUBLIC_APIGW_BASE)' },
      { status: 500 },
    );
  }

  const url = `${trimSlash(base)}/api/rtc/token`;

  let bodyText = '';
  try {
    bodyText = await req.text();
  } catch {
    bodyText = '';
  }

  let body: any = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = {};
  }

  const refererJoinToken = (() => {
    try {
      const ref = req.headers.get('referer') || '';
      if (!ref) return '';
      const url = new URL(ref);
      return url.searchParams.get('joinToken') || url.searchParams.get('jt') || '';
    } catch {
      return '';
    }
  })();

  const uid =
    req.headers.get('x-uid') ||
    req.nextUrl.searchParams.get('uid') ||
    req.nextUrl.searchParams.get('identity') ||
    String(body?.uid || body?.identity || body?.user || body?.participantId || '').trim();

  const requestedAuthRole =
    req.headers.get('x-role') ||
    req.nextUrl.searchParams.get('authRole') ||
    String(body?.authRole || body?.role || 'patient').trim() ||
    'patient';

  const role = normalisePatientRtcAuthRole(requestedAuthRole);

  const joinToken =
    req.headers.get('x-join-token') ||
    req.nextUrl.searchParams.get('joinToken') ||
    req.nextUrl.searchParams.get('jt') ||
    String(body?.joinToken || body?.jt || body?.ticket?.token || '').trim() ||
    refererJoinToken ||
    '';

  const refererCtx = readRefererContext(req);

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const participantRole = normalisePatientParticipantRole(
      body?.participantRole ||
        body?.speakerRole ||
        body?.relationshipToPatient ||
        refererCtx.participantRole ||
        refererCtx.relationshipToPatient ||
        'patient',
    );

    body = {
      ...body,
      joinToken: body?.joinToken || joinToken || undefined,
      authRole: role,
      role,
      participantRole,
      relationshipToPatient:
        body?.relationshipToPatient ||
        body?.relationship ||
        refererCtx.relationshipToPatient ||
        (participantRole === 'patient' ? undefined : participantRole),
      participantName:
        body?.participantName ||
        body?.displayName ||
        body?.name ||
        refererCtx.participantName ||
        undefined,
      displayName:
        body?.displayName ||
        body?.participantName ||
        body?.name ||
        refererCtx.participantName ||
        undefined,
      encounterId:
        body?.encounterId ||
        body?.encounter ||
        body?.enc ||
        refererCtx.encounterId ||
        undefined,
      appointmentId:
        body?.appointmentId ||
        body?.appointment ||
        body?.appt ||
        refererCtx.appointmentId ||
        undefined,
      visitId: body?.visitId || body?.visit || refererCtx.visitId || body?.roomId,
    };

    bodyText = JSON.stringify(body);
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-uid': uid,
      'x-role': role,
      'x-join-token': joinToken,
    },
    body: bodyText || '{}',
    cache: 'no-store',
  });

  const text = await upstream.text().catch(() => '');
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed. Use POST.' }, { status: 405 });
}
