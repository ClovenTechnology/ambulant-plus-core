// apps/patient-app/app/api/appointments/preflight/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY =
  'https://api-gateway.ambulantplus.co.za';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      CANONICAL_API_GATEWAY,
  );
}

function clean(value: unknown) {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

export async function POST(req: NextRequest) {
  try {
    const identity =
      await readPatientGatewayIdentity(req);

    if (!identity) {
      return NextResponse.json(
        {
          ok: false,
          error: 'patient_session_required',
        },
        {
          status: 401,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    const body =
      await req.json().catch(() => ({} as any));
    const clinicianId = clean(
      body?.clinicianId ||
        body?.clinician_id,
    );
    const startsAt = clean(
      body?.startsAt ||
        body?.starts_at,
    );
    const endsAt = clean(
      body?.endsAt ||
        body?.ends_at,
    );

    if (!clinicianId || !startsAt || !endsAt) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'clinicianId_startsAt_endsAt_required',
        },
        {
          status: 400,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    const isFamily =
      body?.person?.mode === 'FAMILY';
    const subjectPatientId = isFamily
      ? clean(
          body?.person?.subjectPatientId ||
            body?.subjectPatientId ||
            body?.subject_patient_id,
        )
      : identity.patientId;

    const gatewayPayload = {
      clinician_id: clinicianId,
      starts_at: startsAt,
      ends_at: endsAt,
      mode: body?.mode || 'book',
      kind: body?.kind || undefined,
      visit_mode:
        body?.visitMode ||
        body?.visit_mode ||
        'televisit',
      payment_method:
        body?.paymentMethod ||
        body?.payment_method ||
        undefined,

      patient_id: identity.patientId,
      host_user_id: identity.uid,
      subject_patient_id:
        subjectPatientId ||
        identity.patientId,

      country: body?.country || undefined,
      subject_country_same:
        body?.subjectCountrySame,
      subject_country:
        body?.subjectCountry || undefined,
      client_id:
        body?.clientId ||
        body?.client_id ||
        undefined,

      family_relationship_id:
        body?.familyRelationshipId ||
        body?.family_relationship_id ||
        body?.person?.relationshipId ||
        undefined,
      case_id:
        body?.caseId ||
        body?.case_id ||
        undefined,
      care_recipients:
        Array.isArray(body?.careRecipients)
          ? body.careRecipients
          : Array.isArray(body?.care_recipients)
            ? body.care_recipients
            : undefined,
    };

    const response = await fetch(
      `${gatewayBase()}/api/appointments/preflight`,
      {
        method: 'POST',
        headers: patientGatewayHeaders({
          req,
          identity,
          includeJson: true,
        }),
        body: JSON.stringify(gatewayPayload),
        cache: 'no-store',
      },
    );
    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'content-type':
          response.headers.get('content-type') ||
          'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'appointment_preflight_proxy_failed',
      },
      {
        status:
          error?.message ===
          'internal_identity_secret_unavailable'
            ? 503
            : 502,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  }
}
