import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  normalizeIdempotencyKey,
  orgIdFromHeaders,
} from '@/src/lib/careport';
import {
  hashLegalEvidenceIp,
  legalRouteErrorStatus,
  recordLegalAcknowledgement,
} from '@/src/legal/service';

export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
      },
    },
  );
}

function callerIp(
  request: NextRequest,
) {
  return String(
    request.headers.get(
      'x-forwarded-for',
    ) ||
    request.headers.get(
      'x-real-ip',
    ) ||
    '',
  )
    .split(
      ',',
    )[0]
    .trim();
}

export async function POST(
  request: NextRequest,
) {
  try {
    const who =
      readIdentity(
        request.headers,
      );

    requireTrustedIdentityInProduction(
      request.headers,
      who,
    );

    if (
      !who.uid &&
      !who.actorRefId
    ) {
      const error =
        new Error(
          'authenticated_subject_required',
        );

      (error as any).status =
        401;

      throw error;
    }

    const body =
      await request
        .json()
        .catch(
          () => ({}),
        );

    const ip =
      callerIp(
        request,
      );

    const acknowledgement =
      await recordLegalAcknowledgement({
        orgId:
          orgIdFromHeaders(
            request.headers,
          ),
        legalDocumentVersionId:
          String(
            body?.legalDocumentVersionId ||
            body?.versionId ||
            '',
          ) ||
          null,
        documentKey:
          String(
            body?.documentKey ||
            body?.key ||
            '',
          ) ||
          null,
        subjectType:
          String(
            body?.subjectType ||
            who.role ||
            'user',
          ),
        subjectUserId:
          who.uid ||
          null,
        subjectId:
          String(
            body?.subjectId ||
            who.actorRefId ||
            who.uid ||
            '',
          ) ||
          null,
        application:
          String(
            body?.application ||
            '',
          ),
        surface:
          String(
            body?.surface ||
            '',
          ) ||
          null,
        action:
          String(
            body?.action ||
            'ACCEPTED',
          ),
        locale:
          String(
            body?.locale ||
            request.headers.get(
              'accept-language',
            ) ||
            '',
          )
            .split(
              ',',
            )[0]
            .trim() ||
          null,
        ipHash:
          ip
            ? hashLegalEvidenceIp(
                ip,
              )
            : null,
        userAgent:
          request.headers.get(
            'user-agent',
          ),
        evidence:
          body?.evidence &&
          typeof body.evidence ===
            'object' &&
          !Array.isArray(
            body.evidence,
          )
            ? body.evidence
            : null,
        idempotencyKey:
          normalizeIdempotencyKey(
            request.headers,
            body?.idempotencyKey,
          ),
      });

    return json(
      {
        ok:
          true,
        acknowledgement,
      },
      201,
    );
  } catch (
    error: any
  ) {
    return json(
      {
        ok:
          false,
        error:
          error?.message ||
          'legal_acknowledgement_failed',
      },
      legalRouteErrorStatus(
        error,
      ),
    );
  }
}
