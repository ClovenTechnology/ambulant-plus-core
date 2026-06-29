// apps/api-gateway/app/api/clinicians/[id]/avatar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeParseJson(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

function pickDataUrl(...values: unknown[]) {
  for (const value of values) {
    const s = cleanStr(value);
    if (s && s.startsWith('data:image/')) return s;
  }

  return null;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;

  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');

  try {
    return {
      contentType,
      bytes: Buffer.from(base64, 'base64'),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestedId = decodeURIComponent(String(params.id || '')).trim();

    if (!requestedId) {
      return NextResponse.json({ ok: false, error: 'clinician_id_required' }, { status: 400 });
    }

    const clinician = await (prisma as any).clinicianProfile.findFirst({
      where: {
        OR: [{ id: requestedId }, { userId: requestedId }],
      },
      select: {
        id: true,
        photoUrl: true,
        meta: true,
      },
    });

    if (!clinician) {
      return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });
    }

    const direct = cleanStr(clinician.photoUrl);
    if (direct && !direct.startsWith('data:image/')) {
      const dest = direct.startsWith('http://') || direct.startsWith('https://')
        ? direct
        : new URL(direct, req.nextUrl.origin).toString();

      return NextResponse.redirect(dest, 307);
    }

    const meta = safeParseJson(clinician.meta);
    const rawProfileJson = safeParseJson(meta.rawProfileJson);
    const rawProfile = safeParseJson(meta.rawProfile);
    const submittedProfile = safeParseJson(meta.submittedProfile);

    const dataUrl =
      pickDataUrl(
        direct,
        meta.avatarDataUrl,
        meta.photoDataUrl,
        meta.avatar?.dataUrl,
        meta.photo?.dataUrl,
        submittedProfile.avatarDataUrl,
        submittedProfile.photoDataUrl,
        rawProfile.avatarDataUrl,
        rawProfile.photoDataUrl,
        rawProfileJson.avatarDataUrl,
        rawProfileJson.photoDataUrl,
      );

    if (!dataUrl) {
      return NextResponse.json({ ok: false, error: 'avatar_not_found' }, { status: 404 });
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed || !parsed.bytes.length) {
      return NextResponse.json({ ok: false, error: 'invalid_avatar' }, { status: 422 });
    }

    return new NextResponse(new Uint8Array(parsed.bytes), {
      status: 200,
      headers: {
        'content-type': parsed.contentType,
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    console.error('[api-gateway] clinician avatar failed', err);
    return NextResponse.json(
      { ok: false, error: 'clinician_avatar_failed', detail: String(err?.message || err) },
      { status: 500 },
    );
  }
}
