import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  orgIdFromHeaders,
} from '@/src/lib/careport';
import {
  getPublishedLegalDocuments,
  legalRouteErrorStatus,
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
        'Access-Control-Allow-Origin':
          '*',
      },
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const url =
      new URL(
        request.url,
      );

    const keys =
      Array.from(
        new Set([
          ...url.searchParams.getAll(
            'key',
          ),
          ...String(
            url.searchParams.get(
              'keys',
            ) ||
            '',
          )
            .split(
              ',',
            )
            .map(
              (value) =>
                value.trim(),
            )
            .filter(Boolean),
        ]),
      );

    const documents =
      await getPublishedLegalDocuments({
        orgId:
          orgIdFromHeaders(
            request.headers,
          ),
        keys,
        application:
          url.searchParams.get(
            'application',
          ),
        surface:
          url.searchParams.get(
            'surface',
          ),
        locale:
          url.searchParams.get(
            'locale',
          ),
      });

    return json({
      ok:
        true,
      documents,
      count:
        documents.length,
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
          'published_legal_documents_fetch_failed',
      },
      legalRouteErrorStatus(
        error,
      ),
    );
  }
}
