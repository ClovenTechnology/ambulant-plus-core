import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE_URL ||
      process.env.APIGW_BASE ||
      process.env.API_GATEWAY_URL ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_GATEWAY_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
      '',
  );
}

function starterMaterials() {
  const uploadedAt = new Date().toISOString();

  return [
    {
      id: 'cm-starter-01',
      trainingSlotId: null,
      title: '1. Contactless Medicine: definition, scope, and practice framework',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'Introduces Contactless Medicine as an Ambulant+ care model: remote-first, device-supported, clinically governed, and outcome-oriented care delivery.',
      uploadedAt,
    },
    {
      id: 'cm-starter-02',
      trainingSlotId: null,
      title: '2. Virtual consultation workflow and clinical equivalence principles',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'How to structure history, observation, device-assisted assessment, safety-netting, escalation, and follow-up to achieve safe remote clinical outcomes.',
      uploadedAt,
    },
    {
      id: 'cm-starter-03',
      trainingSlotId: null,
      title: '3. IoMT starter kit: DueCare, NexRing, digital stethoscope, and HD otoscope',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'Practical orientation to device-supported observations, remote examination workflow, limitations, artefacts, and clinical interpretation boundaries.',
      uploadedAt,
    },
    {
      id: 'cm-starter-04',
      trainingSlotId: null,
      title: '4. Remote patient monitoring and longitudinal outcome assessment',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'Using trends, adherence, symptoms, escalation thresholds, and follow-up loops to interpret recovery and ongoing risk.',
      uploadedAt,
    },
    {
      id: 'cm-starter-05',
      trainingSlotId: null,
      title: '5. Documentation, claims-aware care coordination, and audit trail',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'Clinical notes, structured summaries, device data, prescriptions, sick notes, care plans, claims context, and defensible documentation.',
      uploadedAt,
    },
    {
      id: 'cm-starter-06',
      trainingSlotId: null,
      title: '6. Patient rights, consent, privacy, and data protection',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'Patient autonomy, confidentiality, consent for remote assessment, data minimisation, and safe handling of IoMT-derived information.',
      uploadedAt,
    },
    {
      id: 'cm-starter-07',
      trainingSlotId: null,
      title: '7. InsightCore AI assist and voice-to-text dictation safety',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'Ethical use of AI assistance and dictation: clinician remains responsible for final decisions, verification, correction, and sign-off.',
      uploadedAt,
    },
    {
      id: 'cm-starter-08',
      trainingSlotId: null,
      title: '8. Escalation, red flags, emergency boundaries, and patient visibility readiness',
      kind: 'module',
      url: null,
      fileKey: null,
      notes:
        'When remote care is appropriate, when it is not, when to escalate, and what must be completed before clinician profile activation.',
      uploadedAt,
    },
  ];
}

function materialResponse(source: string, items: any[]) {
  return NextResponse.json(
    {
      ok: true,
      source,
      items,
      materials: items,
    },
    {
      status: 200,
      headers: { 'cache-control': 'no-store, max-age=0' },
    },
  );
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-ambulant-identity',
    'user-agent',
  ].forEach((k) => {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  });

  h.set('accept', 'application/json');
  return h;
}

export async function GET(req: NextRequest) {
  const fallback = starterMaterials();

  try {
    const gw = gatewayBase();

    if (!gw) {
      return materialResponse('starter_fallback_gateway_missing', fallback);
    }

    const upstream = await fetch(`${gw}/api/clinicians/me/training/materials`, {
      method: 'GET',
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await upstream.json().catch(() => null);

    const upstreamItems = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.materials)
        ? data.materials
        : [];

    if (upstream.ok && data?.ok && upstreamItems.length > 0) {
      return materialResponse('gateway', upstreamItems);
    }

    return materialResponse('starter_fallback_empty_or_unavailable', fallback);
  } catch (err: any) {
    console.error('[clinician-app][training/materials][GET] upstream error', err);

    return materialResponse('starter_fallback_error', fallback);
  }
}
