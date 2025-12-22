// apps/patient-app/app/api/checkout/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getAppointment,
  updateAppointment,
  sendEmail,
  sendSMS,
} from '@/app/api/_store';

export const dynamic = 'force-dynamic';

const APIGW_BASE =
  process.env.APIGW_BASE ??
  process.env.NEXT_PUBLIC_APIGW_BASE ??
  'http://localhost:3010';

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
    // support { items: [...] } or { memberships: [...] } or raw array
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
  if (active.length > 0) return active[0];
  return list[0];
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const queryId = url.searchParams.get('a') || url.searchParams.get('id');

    const body = await req.json().catch(() => ({} as any));

    const appointmentId =
      body.appointmentId || body.id || queryId || null;

    if (!appointmentId) {
      return NextResponse.json(
        { error: 'Missing appointment id' },
        { status: 400 },
      );
    }

    const appt = getAppointment(appointmentId);
    if (!appt) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 },
      );
    }

    // Funding inputs from caller (can be wired from MedicalAidManager / voucher UI)
    const requestedMethod = body.paymentMethod as
      | PaymentMethod
      | undefined;
    const voucherCode =
      typeof body.voucherCode === 'string' ? body.voucherCode.trim() : '';

    const encounterId =
      appt.encounterId || 'enc-za-001';
    const caseId = appt.caseId || 'case-za-001';
    const patientId = appt.patientId || 'pt-za-001';
    const clinicianId = appt.clinicianId || 'clin-za-001';
    const amountZAR = Number(appt.priceZAR ?? 0);
    const amountCents = Math.max(0, Math.round(amountZAR * 100));

    // 1) Lookup active medical aid for this patient
    const origin = url.origin;
    const medicalAids = await fetchMedicalAids(origin, patientId);
    const membership = pickActiveMembership(medicalAids);

    // 2) Decide payment method
    let paymentMethod: PaymentMethod = 'self-pay-card';

    if (requestedMethod === 'medical-aid') {
      paymentMethod = 'medical-aid';
    } else if (requestedMethod === 'voucher-promo') {
      paymentMethod = 'voucher-promo';
    } else {
      // If not specified explicitly, prefer medical aid when an active membership exists.
      if (membership) {
        paymentMethod = 'medical-aid';
      } else {
        paymentMethod = 'self-pay-card';
      }
    }

    const membershipId = membership?.id ?? null;

    // 3) Perform the funding action
    let gatewayPayment: any = null;

    if (paymentMethod === 'self-pay-card') {
      // Card: capture directly via API gateway /api/payments
      const res = await fetch(`${APIGW_BASE}/api/payments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // identity headers may be added by the edge/gateway in real life;
          // this is a demo direct call.
        },
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
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return NextResponse.json(
          { error: `Gateway payment failed: HTTP ${res.status}`, details: text },
          { status: 502 },
        );
      }

      gatewayPayment = await res.json().catch(() => null);
    } else if (paymentMethod === 'voucher-promo') {
      // Voucher / promo: redeem via API gateway
      if (!voucherCode) {
        return NextResponse.json(
          {
            error:
              'voucher-promo selected but voucherCode missing in request body.',
          },
          { status: 400 },
        );
      }

      const res = await fetch(`${APIGW_BASE}/api/vouchers/redeem`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: voucherCode,
          encounterId,
          caseId,
          patientId,
        }),
      });

      if (!res.ok) {
        const js = await res.json().catch(() => null);
        return NextResponse.json(
          {
            error:
              js?.error ||
              `Voucher redeem failed: HTTP ${res.status}`,
          },
          { status: 400 },
        );
      }

      const vr = await res.json().catch(() => ({} as any));

      gatewayPayment = {
        id: vr.voucher?.id ?? `voucher-${Date.now().toString(16)}`,
        status: 'captured',
        amountCents:
          typeof vr.valueCents === 'number'
            ? vr.valueCents
            : amountCents,
        currency: 'ZAR',
        meta: {
          source: 'patient-app/checkout',
          appointmentId,
          paymentMethod,
          membershipId,
          voucherCode,
          voucher: vr.voucher,
        },
      };
    } else {
      // Medical aid: do NOT charge card; mark appointment as "to be claimed"
      gatewayPayment = {
        id: `claim-${Date.now().toString(16)}`,
        status: 'pending-claim',
        amountCents,
        currency: 'ZAR',
        meta: {
          source: 'patient-app/checkout',
          appointmentId,
          paymentMethod,
          membershipId,
          voucherCode: null,
        },
      };
    }

    // 4) Update local appointment store with funding metadata
    const updated = updateAppointment(appointmentId, {
      status: 'confirmed',
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
        gatewayPaymentId: gatewayPayment?.id ?? null,
      },
    });

    // 5) Fire notifications (same as before)
    const when = new Date(updated!.startISO).toLocaleString();
    const subject = `Appointment confirmed (${updated!.id})`;
    const text = `Your televisit is confirmed for ${when}.`;

    if (updated?.patient?.email)
      await sendEmail(updated.patient.email, subject, text);
    if (updated?.patient?.phone) await sendSMS(updated.patient.phone, text);

    return NextResponse.json({
      ok: true,
      appointment: updated,
      paymentMethod,
      membershipId,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to confirm' },
      { status: 500 },
    );
  }
}
