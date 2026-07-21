import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function expireAdminSession(response: NextResponse) {
  response.cookies.set(
    'adm.profile',
    '',
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
    },
  );
  response.headers.set(
    'cache-control',
    'no-store, max-age=0',
  );

  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(
    '/auth/signin',
    request.url,
  );
  url.searchParams.set('reason', 'signed_out');

  return expireAdminSession(
    NextResponse.redirect(url),
  );
}

export async function POST() {
  return expireAdminSession(
    NextResponse.json({
      ok: true,
      redirectTo: '/auth/signin?reason=signed_out',
    }),
  );
}
