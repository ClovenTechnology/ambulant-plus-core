import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function pickBase() {
  return (
    process.env.APIGW_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).trim();
}

function safeJson(status: number, body: any) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  h.set('content-type', 'application/json');

  const uid =
    req.headers.get('x-uid') ||
    req.nextUrl.searchParams.get('uid') ||
    req.nextUrl.searchParams.get('identity') ||
    '';

  const role =
    req.headers.get('x-role') ||
    req.nextUrl.searchParams.get('role') ||
    'clinician';

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

  const joinToken =
    req.headers.get('x-join-token') ||
    req.nextUrl.searchParams.get('joinToken') ||
    req.nextUrl.searchParams.get('jt') ||

    refererJoinToken ||
    '';

  if (uid) h.set('x-uid', uid);
  if (role) h.set('x-role', role);
  if (joinToken) h.set('x-join-token', joinToken);

  const cookie = req.headers.get('cookie');
  if (cookie) h.set('cookie', cookie);

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (auth) h.set('authorization', auth);

  return h;
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
      participantName: get('participantName', 'displayName', 'name', 'clinicianName'),
      encounterId: get('encounterId', 'encounter', 'enc'),
      appointmentId: get('appointmentId', 'appointment', 'appt'),
      visitId: get('visitId', 'visit'),
    };
  } catch {
    return {} as Record<string, string>;
  }
}

function buildRtcParticipantMetadata(req: NextRequest, body: any, fallbackRole: string) {
  const ref = readRefererContext(req);
  const participantRole = String(
    body?.participantRole ||
      body?.speakerRole ||
      ref.participantRole ||
      fallbackRole ||
      'clinician',
  ).trim();

  const displayName = String(
    body?.displayName ||
      body?.participantName ||
      body?.name ||
      ref.participantName ||
      body?.identity ||
      body?.uid ||
      '',
  ).trim();

  const encounterId = String(body?.encounterId || body?.encounter || body?.enc || ref.encounterId || '').trim();
  const appointmentId = String(body?.appointmentId || body?.appointment || body?.appt || ref.appointmentId || '').trim();
  const visitId = String(body?.visitId || body?.visit || ref.visitId || body?.roomId || body?.room || '').trim();

  return {
    participantRole,
    speakerRole: participantRole,
    displayName,
    participantName: displayName,
    speakerName: displayName,
    relationshipToPatient: String(body?.relationshipToPatient || body?.relationship || ref.relationshipToPatient || '').trim() || undefined,
    encounterId: encounterId || undefined,
    appointmentId: appointmentId || undefined,
    visitId: visitId || undefined,
    authRole: fallbackRole,
  };
}

function attachRtcParticipantMetadata(req: NextRequest, body: any, fallbackRole: string) {
  const metadata = buildRtcParticipantMetadata(req, body, fallbackRole);
  return {
    ...body,
    participantRole: metadata.participantRole,
    speakerRole: metadata.speakerRole,
    displayName: metadata.displayName || body?.displayName,
    participantName: metadata.participantName || body?.participantName,
    relationshipToPatient: metadata.relationshipToPatient || body?.relationshipToPatient,
    encounterId: metadata.encounterId || body?.encounterId,
    appointmentId: metadata.appointmentId || body?.appointmentId,
    visitId: metadata.visitId || body?.visitId,
    metadata,
  };
}

function bodyFromQuery(req: NextRequest) {
  const roomId =
    req.nextUrl.searchParams.get('roomId') ||
    req.nextUrl.searchParams.get('room') ||
    '';

  const uid =
    req.nextUrl.searchParams.get('uid') ||
    req.nextUrl.searchParams.get('identity') ||
    req.nextUrl.searchParams.get('user') ||
    '';

  const role = req.nextUrl.searchParams.get('role') || 'clinician';

  return {
    roomId,
    room: roomId,
    uid,
    identity: uid,
    user: uid,
    role,
    visitId: req.nextUrl.searchParams.get('visitId') || undefined,
    trainingSlotId: req.nextUrl.searchParams.get('trainingSlotId') || undefined,
  };
}

function normaliseWsUrl(value: string) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (v.startsWith('wss://') || v.startsWith('ws://')) return v;
  if (v.startsWith('https://')) return `wss://${v.slice('https://'.length)}`;
  if (v.startsWith('http://')) return `ws://${v.slice('http://'.length)}`;
  return v;
}

function isTrainingRoom(body: any) {
  const roomId = String(body?.roomId || body?.room || '').trim();
  const uid = String(body?.uid || body?.identity || body?.user || '').trim();

  return (
    roomId.startsWith('training-') &&
    (uid.startsWith('training-clinician-') || uid.startsWith('training-room-'))
  );
}

async function mintTrainingToken(body: any) {
  const roomId = String(body?.roomId || body?.room || '').trim();
  const uid = String(body?.uid || body?.identity || body?.user || '').trim();
  const role = String(body?.role || 'clinician').trim() || 'clinician';

  if (!roomId || !uid) {
    return safeJson(400, {
      ok: false,
      error: 'training_room_or_uid_missing',
    });
  }

  const livekitKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const livekitSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const livekitUrl = normaliseWsUrl(
    envFirst([
      'LIVEKIT_WS_URL',
      'LIVEKIT_URL',
      'NEXT_PUBLIC_LIVEKIT_WS_URL',
      'NEXT_PUBLIC_LIVEKIT_URL',
      'LK_WS_URL',
      'LK_URL',
    ]),
  );

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    return safeJson(500, {
      ok: false,
      error: 'server_misconfig_missing_livekit_credentials',
      message: 'Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL/LIVEKIT_WS_URL on clinician-app.',
    });
  }

  const { AccessToken } = await import('livekit-server-sdk');

  const at = new AccessToken(livekitKey, livekitSecret, {
    identity: uid,
    name: uid,
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: role !== 'observer',
    canPublishData: role !== 'observer',
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return safeJson(200, {
    ok: true,
    provider: 'livekit',
    mode: 'training_room_direct',
    wsUrl: livekitUrl,
    token,
    roomId,
    identity: uid,
    role,
  });
}


function rtcIsCompactJws(value: unknown) {
  const s = String(value ?? '').trim();
  if (!s) return false;
  const parts = s.split('.');
  return parts.length === 3 && parts.every(Boolean);
}

function rtcEnvFirst(keys: string[]) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function rtcNormaliseWsUrl(raw: string) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.startsWith('wss://') || v.startsWith('ws://')) return v;
  if (v.startsWith('https://')) return 'wss://' + v.slice('https://'.length);
  if (v.startsWith('http://')) return 'ws://' + v.slice('http://'.length);
  return v;
}

function readClinicianSessionFromCookie(req: NextRequest) {
  try {
    const raw = req.cookies.get('ambulant_clinician_session')?.value || '';
    if (!raw) return null;

    const json = Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json);

    const clinicianId = String(parsed?.clinicianId || parsed?.sub || '').trim();
    const role = String(parsed?.role || '').trim().toLowerCase();

    if (!clinicianId || role !== 'clinician') return null;

    return {
      clinicianId,
      email: String(parsed?.email || '').trim(),
      name: String(parsed?.name || '').trim(),
      canPractice: parsed?.canPractice === true,
      visibleToPatients: parsed?.visibleToPatients === true,
    };
  } catch {
    return null;
  }
}

function getRtcRoomId(body: any) {
  return String(body?.roomId || body?.room || body?.roomName || '').trim();
}

function getRtcUid(body: any, fallbackClinicianId: string) {
  return String(
    body?.uid ||
    body?.identity ||
    body?.participantId ||
    `clin-${fallbackClinicianId}`
  ).trim();
}

async function mintAuthenticatedClinicianRtcToken(req: NextRequest, body: any) {
  const session = readClinicianSessionFromCookie(req);
  const roomId = getRtcRoomId(body);
  const role = String(body?.role || req.headers.get('x-role') || 'clinician').trim().toLowerCase();

  if (!session || role !== 'clinician' || !roomId) return null;

  // Production safety gate:
  // real appointment room IDs are clinician-scoped: room-<clinicianId>-...
  if (!roomId.includes(session.clinicianId)) {
    return safeJson(403, {
      ok: false,
      error: 'room_not_owned_by_authenticated_clinician',
    });
  }

  if (!session.canPractice) {
    return safeJson(403, {
      ok: false,
      error: 'clinician_not_authorised_for_live_consults',
    });
  }

  const livekitKey = rtcEnvFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const livekitSecret = rtcEnvFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const livekitUrl = rtcNormaliseWsUrl(
    rtcEnvFirst([
      'LIVEKIT_WS_URL',
      'LIVEKIT_URL',
      'NEXT_PUBLIC_LIVEKIT_WS_URL',
      'NEXT_PUBLIC_LIVEKIT_URL',
      'LK_WS_URL',
      'LK_URL',
    ]),
  );

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    return safeJson(500, {
      ok: false,
      error: 'server_misconfig_missing_livekit_credentials',
      message: 'Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL/LIVEKIT_WS_URL on clinician-app.',
    });
  }

  const uid = getRtcUid(body, session.clinicianId);
  const { AccessToken } = await import('livekit-server-sdk');

  const at = new AccessToken(livekitKey, livekitSecret, {
    identity: uid,
    name: session.name || uid,
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return safeJson(200, {
    ok: true,
    provider: 'livekit',
    mode: 'authenticated_clinician_direct',
    wsUrl: livekitUrl,
    token,
    roomId,
    identity: uid,
    role: 'clinician',
  });
}


async function proxyToGateway(req: NextRequest, bodyText: string, body: any) {
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

  const rawJoinToken =
    req.headers.get('x-join-token') ||
    req.nextUrl.searchParams.get('joinToken') ||
    req.nextUrl.searchParams.get('jt') ||
    String(body?.joinToken || body?.jt || body?.ticket?.token || '').trim() ||
    refererJoinToken ||
    '';

  const joinToken = rtcIsCompactJws(rawJoinToken) ? String(rawJoinToken).trim() : '';

  /*
    Important production ordering:
    - If a signed joinToken exists, send it to the gateway for verification.
    - Do not apply the local clinician-owned-room heuristic first.
    - Simulation/training/admin-created rooms may not include the clinicianId in the room name.
    - Without a joinToken, training rooms can still use the local training token path.
    - Without a joinToken and outside training, real clinician-owned rooms can use direct authenticated minting.
  */
  if (!joinToken && isTrainingRoom(body)) {
    return safeJson(401, {
      ok: false,
      error: 'training_admission_required',
      message: 'A signed training admission is required to join this room.',
    });
  }

  if (!joinToken) {
    const clinicianDirect = await mintAuthenticatedClinicianRtcToken(req, body);
    if (clinicianDirect) {
      return clinicianDirect;
    }
  }

  const base = pickBase();

  if (!base) {
    return safeJson(503, {
      ok: false,
      error: 'Video room service is not configured yet. Please contact Ambulant+ support.',
    });
  }

  const upstreamHeaders = new Headers(forwardHeaders(req) as HeadersInit);
  if (joinToken) upstreamHeaders.set('x-join-token', joinToken);

  const upstream = await fetch(`${trimSlash(base)}/api/rtc/token`, {
    method: 'POST',
    headers: upstreamHeaders,
    body: bodyText || '{}',
    cache: 'no-store',
  });

  const text = await upstream.text().catch(() => '');

  return new NextResponse(text || JSON.stringify({ ok: upstream.ok }), {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text().catch(() => '{}');
    const body = JSON.parse(bodyText || '{}');
    return proxyToGateway(req, bodyText || '{}', body);
  } catch (err) {
    console.error('[clinician-app][rtc/token][POST] failed', err);
    return safeJson(502, {
      ok: false,
      error: 'Unable to prepare the video room right now. Please try again shortly.',
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const body = bodyFromQuery(req);
    return proxyToGateway(req, JSON.stringify(body), body);
  } catch (err) {
    console.error('[clinician-app][rtc/token][GET] failed', err);
    return safeJson(502, {
      ok: false,
      error: 'Unable to prepare the video room right now. Please try again shortly.',
    });
  }
}

