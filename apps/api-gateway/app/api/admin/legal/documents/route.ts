import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  verifyAdminRequest,
} from '../../utils/auth';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  orgIdFromHeaders,
  requireRole,
} from '@/src/lib/careport';
import {
  legalRouteErrorStatus,
  listLegalDocuments,
  runLegalAdminAction,
  supportedLegalVersionStates,
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

function actorFromIdentity(
  who: ReturnType<
    typeof readIdentity
  >,
) {
  return {
    userId:
      who.uid ||
      who.actorRefId ||
      null,
    role:
      who.role ||
      null,
  };
}

function actorFromVerifiedAdmin(
  verified: {
    uid: string;
    role: string;
    source?: string;
  },
  request: NextRequest,
) {
  const proxyActor =
    verified.source ===
      'admin-api-key'
      ? String(
          request.headers.get(
            'x-admin-actor-id',
          ) ||
            request.headers.get(
              'x-admin-actor-email',
            ) ||
            '',
        ).trim()
      : '';

  return {
    userId:
      proxyActor ||
      verified.uid ||
      null,
    role:
      verified.role ||
      null,
  };
}

async function requireLegalAdmin(
  request: NextRequest,
) {
  const verified =
    await verifyAdminRequest(
      request,
    );

  if (verified.ok) {
    return actorFromVerifiedAdmin(
      verified,
      request,
    );
  }

  const who =
    readIdentity(
      request.headers,
    );

  requireTrustedIdentityInProduction(
    request.headers,
    who,
  );

  requireRole(
    who,
    [
      'admin',
      'admin_staff',
    ],
  );

  return actorFromIdentity(
    who,
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    await requireLegalAdmin(
      request,
    );

    const url =
      new URL(
        request.url,
      );

    const orgId =
      orgIdFromHeaders(
        request.headers,
      );

    const documents =
      await listLegalDocuments(
        orgId,
        {
          key:
            url.searchParams.get(
              'key',
            ),
          status:
            url.searchParams.get(
              'status',
            ),
          includeEvents:
            url.searchParams.get(
              'includeEvents',
            ) ===
            'true',
          limit:
            Number(
              url.searchParams.get(
                'limit',
              ) ||
              100,
            ),
        },
      );

    return json({
      ok:
        true,
      documents,
      supportedVersionStates:
        supportedLegalVersionStates(),
    });
  } catch (
    error: any
  ) {
    return json(
      {
        ok:
          false,
        error:
          error?.message ||
          'legal_documents_fetch_failed',
      },
      legalRouteErrorStatus(
        error,
      ),
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const actor =
      await requireLegalAdmin(
        request,
      );

    const body =
      await request
        .json()
        .catch(
          () => ({}),
        );

    const result =
      await runLegalAdminAction({
        orgId:
          orgIdFromHeaders(
            request.headers,
          ),
        actor,
        action:
          String(
            body?.action ||
            '',
          ),
        body:
          body &&
          typeof body ===
            'object'
            ? body
            : {},
      });

    return json({
      ok:
        true,
      result,
    });
  } catch (
    error: any
  ) {
    return json(
      {
        ok:
          false,
        error:
          error?.message ||
          'legal_action_failed',
      },
      legalRouteErrorStatus(
        error,
      ),
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  return POST(
    request,
  );
}
