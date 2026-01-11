// apps/admin-dashboard/app/api/admin/clinicians/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

type ReasonKey =
  | 'incomplete_documents'
  | 'expired_id'
  | 'expired_license'
  | 'eligibility_country'
  | 'other';

const REASONS: Record<
  ReasonKey,
  { label: string; template: (countryName: string) => string }
> = {
  incomplete_documents: {
    label: 'Incomplete document',
    template: () =>
      'Your application is incomplete because one or more required documents were not provided. Please update your application and re-submit.',
  },
  expired_id: {
    label: 'Expired ID',
    template: () =>
      'Your application could not be approved because your identification document appears to be expired. Please renew your ID and re-apply, or contact support for help.',
  },
  expired_license: {
    label: 'Expired licence',
    template: () =>
      'Your application could not be approved because your professional licence/registration appears to be expired. Please renew it and re-apply or contact support@cloventechnology.com.',
  },
  eligibility_country: {
    label: 'Eligibility / country',
    template: (countryName) =>
      `You unfortunately do not meet the required eligibility for the application. Clinician practice on Ambulant+ is strictly for clinicians duly registered to practice in ${countryName}. If you believe this is an error, please contact support@cloventechnology.com.`,
  },
  other: {
    label: 'Other',
    template: () =>
      'Your application could not be approved at this time. Please contact support@cloventechnology.com if you need clarification.',
  },
};

async function readFormOrJson(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({} as any));
    return body ?? {};
  }
  const fd = await req.formData().catch(() => null);
  const out: Record<string, any> = {};
  if (fd) for (const [k, v] of fd.entries()) out[k] = v;
  return out;
}

function isBrowserForm(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  return ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data');
}

function redirectBack(req: NextRequest, fallback = '/admin/clinicians') {
  const ref = req.headers.get('referer');
  const origin = new URL(req.url).origin;
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.origin === origin) return NextResponse.redirect(u);
    } catch {}
  }
  return NextResponse.redirect(new URL(fallback, req.url));
}

export async function POST(req: NextRequest) {
  try {
    const body = await readFormOrJson(req);

    const id = body?.id ? String(body.id) : '';
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const reasonKey = (body?.reasonKey ? String(body.reasonKey) : 'other') as ReasonKey;
    const countryName = body?.countryName ? String(body.countryName) : 'South Africa';

    const preset = REASONS[reasonKey] ?? REASONS.other;

    const customMessage = body?.message ? String(body.message).trim() : '';
    const finalMessage = customMessage.length > 0 ? customMessage : preset.template(countryName);

    const gatewayBase =
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
      process.env.APIGW_BASE ??
      process.env.NEXT_PUBLIC_GATEWAY_BASE ??
      process.env.GATEWAY_URL ??
      'http://localhost:3010';

    const res = await fetch(`${gatewayBase}/api/clinicians`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': process.env.ADMIN_API_KEY ?? '',
      },
      body: JSON.stringify({
        id,
        status: 'rejected',
        // Gateway can store these in ClinicianProfile.meta or a future ClinicianVerification model.
        rejection: {
          reasonKey,
          reasonLabel: preset.label,
          message: finalMessage,
          countryName,
          at: new Date().toISOString(),
        },
        notifyApplicant: true, // if gateway supports sending email/SMS, it should use this
      }),
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: text || `HTTP ${res.status} reject failed` },
        { status: res.status },
      );
    }

    // If the action came from a <form>, bounce admin back to where they were
    if (isBrowserForm(req)) return redirectBack(req);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('admin/clinicians/reject error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
