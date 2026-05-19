// apps/patient-app/app/api/checkout/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppointment, updateAppointment } from '@/app/api/_store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymentMethod = 'self-pay-card' | 'medical-aid' | 'voucher-promo';

type MedicalAidMembership = {
  id: string;
  patientId: string;
  active?: boolean;
  payerName?: string;
  scheme?: string;
  plan?: string;
  planName?: string;
  membershipNumber?: string;
  dependentCode?: string;
  telemedCover?: 'none' | 'partial' | 'full';
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
  [key: string]: any;
};

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function apiGatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function forwardJsonHeaders(req: NextRequest) {
  const headers = new Headers();

  const passthrough = [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  return headers;
}

async function fetchMedicalAids(
  origin: string,
  patientId: string,
): Promise<MedicalAidMembership[]> {
  try {
    const res = await fetch(
      `${origin}/api/medical-aids?patientId=${encodeURIComponent(patientId)}`,
      { cache: 'no-store' },
    );

    if (!res.ok) return [];

    const js = await res.json().catch(() => ({} as any));

    if (Array.isArray(js)) return js as MedicalAidMembership[];
    if (Array.isArray(js.items)) return js.items as MedicalAidMembership[];
    if (Array.isArray(js.memberships)) return js.memberships as MedicalAidMembership[];

    return [];
  } catch {
    return [];
  }
}

function pickActiveMembership(
  list: MedicalAidMembership[],
): MedicalAidMembership | null {
  if (!Array.isArray(list) || list.length === 0) return null;

  const active = list.filter((m) => m.active !== false);

  return active[0] ?? list[0] ?? null;
}

function cleanId(value: unknown) {
  return String(value ?? '').trim();
}

function requireContextId(
  body: any,
  appt: any,
  keys: string[],
  error: string,
): string {
  for (const key of keys) {
    const value = cleanId(body?.[key] ?? appt?.[key]);
    if (value) return value;
  }

  throw new Error(error);
}

export async function POST(req: NextRequest) {
  try {
    const gatewayBase = apiGatewayBase();

    if (!gatewayBase) {
      return json(
        {
          ok: false,
          error: 'api_gateway_base_not_configured',
        },
        503,
      );
    }

    const url = new URL(req.url);
    const queryId = url.searchParams.get('a') || url.searchParams.get('id');

    const body = await req.json().catch(() => ({} as any));

    const appointmentId = cleanId(body.appointmentId || body.id || queryId);

    if (!appointmentId) {
      return json({ ok: false, error: 'appointment_id_required' }, 400);
    }

    const appt = getAppointment(appointmentId) as any;

    if (!appt) {
      return json({ ok: false, error: 'appointment_not_found' }, 404);
    }

    const requestedMethod = body.paymentMethod as PaymentMethod | undefined;
    const voucherCode =
      typeof body.voucherCode === 'string' ? body.voucherCode.trim() : '';

    const encounterId = requireContextId(
      body,
      appt,
      ['encounterId'],
      'encounterId_required',
    );

    const caseId = requireContextId(
      body,
      appt,
      ['caseId'],
      'caseId_required',
    );

    const patientId = requireContextId(
      body,
      appt,
      ['patientId', 'patientUserId'],
      'patientId_required',
    );

    const clinicianId = requireContextId(
      body,
      appt,
      ['clinicianId'],
      'clinicianId_required',
    );

    const amountZAR = Number(
      body.amountZAR ??
        body.amountZar ??
        appt.priceZAR ??
        appt.priceZar ??
        NaN,
    );

    if (!Number.isFinite(amountZAR) || amountZAR < 0) {
      return json({ ok: false, error: 'valid_amount_required' }, 400);
    }

    const amountCents = Math.max(0, Math.round(amountZAR * 100));

    const medicalAids = await fetchMedicalAids(url.origin, patientId);
    const membership = pickActiveMembership(medicalAids);

    let paymentMethod: PaymentMethod = 'self-pay-card';

    if (requestedMethod === 'medical-aid') {
      paymentMethod = 'medical-aid';
    } else if (requestedMethod === 'voucher-promo') {
      paymentMethod = 'voucher-promo';
    } else if (membership) {
      paymentMethod = 'medical-aid';
    }

    const membershipId = membership?.id ?? null;
    let gatewayPayment: any = null;

    if (paymentMethod === 'self-pay-card') {
      const res = await fetch(`${gatewayBase}/api/payments`, {
        method: 'POST',
        headers: forwardJsonHeaders(req),
        body: JSON.stringify({
          amountCents,
          currency: 'ZAR',
          encounterId,
          caseId,
          patientId,
          clinicianId,
          meta: {
            source: 'patient-app/checkout',
            appointmentId,
            paymentMethod,
            membershipId,
            voucherCode: null,
          },
        }),
        cache: 'no-store',
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return json(
          {
            ok: false,
            error: data?.error || `gateway_payment_failed_http_${res.status}`,
            details: data,
          },
          502,
        );
      }

      gatewayPayment = data;
    } else if (paymentMethod === 'voucher-promo') {
      if (!voucherCode) {
        return json(
          {
            ok: false,
            error: 'voucher_code_required',
          },
          400,
        );
      }

      const res = await fetch(`${gatewayBase}/api/vouchers/redeem`, {
        method: 'POST',
        headers: forwardJsonHeaders(req),
        body: JSON.stringify({
          code: voucherCode,
          encounterId,
          caseId,
          patientId,
          appointmentId,
        }),
        cache: 'no-store',
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return json(
          {
            ok: false,
            error: data?.error || `voucher_redeem_failed_http_${res.status}`,
            details: data,
          },
          400,
        );
      }

      gatewayPayment = data;
    } else {
      gatewayPayment = {
        status: 'pending-claim',
        amountCents,
        currency: 'ZAR',
        membershipId,
      };
    }

    const updated = updateAppointment(appointmentId, {
      status: 'confirmed',
      ...( {
        billingMode:
          paymentMethod === 'medical-aid'
            ? 'medical-aid'
            : paymentMethod === 'voucher-promo'
              ? 'voucher'
              : 'self-pay',
        funding: {
          paymentMethod,
          membershipId,
          voucherCode: paymentMethod === 'voucher-promo' ? voucherCode : undefined,
          amountZAR,
          gatewayPaymentId:
            gatewayPayment?.id ??
            gatewayPayment?.payment?.id ??
            gatewayPayment?.voucher?.id ??
            null,
        },
      } as any ),
    });

    if (!updated) {
      return json(
        {
          ok: false,
          error: 'appointment_update_failed',
        },
        500,
      );
    }

    return json({
      ok: true,
      appointment: updated,
      paymentMethod,
      membershipId,
      gatewayPayment,
    });
  } catch (e: any) {
    const message = e?.message || 'checkout_confirm_failed';

    const status =
      message.endsWith('_required') ||
      message === 'valid_amount_required'
        ? 400
        : 500;

    return json(
      {
        ok: false,
        error: message,
      },
      status,
    );
  }
}