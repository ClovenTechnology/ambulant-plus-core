import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectToCanonicalSignout(
  request: NextRequest,
) {
  const destination =
    request.nextUrl.clone();

  destination.pathname =
    '/auth/signout';

  destination.search =
    '';

  const response =
    NextResponse.redirect(
      destination,
      303,
    );

  response.headers.set(
    'cache-control',
    'no-store',
  );

  return response;
}

export async function GET(
  request: NextRequest,
) {
  return redirectToCanonicalSignout(
    request,
  );
}

export async function POST(
  request: NextRequest,
) {
  return redirectToCanonicalSignout(
    request,
  );
}