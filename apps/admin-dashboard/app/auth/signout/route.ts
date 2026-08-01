import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureCookie() {
  return (
    process.env.NODE_ENV ===
      'production' ||
    process.env.VERCEL_ENV ===
      'production'
  );
}

function signOut(
  request: NextRequest,
) {
  const destination =
    request.nextUrl.clone();

  destination.pathname =
    '/auth/signin';

  destination.search =
    '';

  const response =
    NextResponse.redirect(
      destination,
      303,
    );

  response.cookies.set({
    name: 'adm.profile',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie(),
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });

  response.headers.set(
    'cache-control',
    'no-store',
  );

  return response;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'method_not_allowed',
    },
    {
      status: 405,
      headers: {
        allow: 'POST',
        'cache-control': 'no-store',
      },
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  return signOut(
    request,
  );
}