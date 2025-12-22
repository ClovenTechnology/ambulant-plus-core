// apps/clinician-app/app/api/claims/auto-submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { store } from '@runtime/store';
import { readDb } from '../../erx/_lib_db_compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Shared medical aids JSON at repo root so all apps can read it
const MEDICAL_AIDS_STORE = path.join(process.cwd(), '../../medical-aids.json');
const CLAIMS_STORE = path.join(process.cwd(), 'data-claims.json');

// Optional: shared clinicians JSON (if you mirror profiles there)
const CLINICIANS_STORE = path.join(process.cwd(), '../../clinicians.json');

type AutoSubmitBody = {
  encounterId: string;
  clinicianId?: string;
  patientId?: string;
  patientName?: string;
  diagnosisText?: string;
  diagnosisCode?: string;
  mode?: 'end' | 'followup-confirm' | 'followup-recommend' | 'referral';
  followupId?: string;
  followupSlot?: { start: string; end: string };

  // optional: allow caller to send a friendly label if they know it
  paymentDisplayLabel?: string;
};

type PaymentMethod = 'self-pay-card' | 'medical-aid' | 'voucher-promo' | 'unknown';

type TelemedCover = 'none' | 'full' | 'partial';

type MedicalAidMembership = {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  payerName: string;
  planName?: string;
  membershipNumber: string;
  dependentCode?: string;
  principalName?: string;
  principalIdNumber?: string;
  telemedCover: TelemedCover;
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
  comFilePath?: string;
  comFileName?: string;
  notes?: string;
  active?: boolean;
  [key: string]: any;
};

type ProviderBlock = {
  facility: {
    name: string;
    address: string;
    email: string;
    phone: string;
  };
  clinician: {
    id?: string | null;
    name?: string | null;
    practiceName?: string | null;
    practiceNumber?: string | null;
    regulatorBody?: string | null;
    regulatorRegistration?: string | null;
    independentContractor: boolean;
  };
};

type ClaimRecord = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  encounterId: string;
  caseId?: string | null;
  clinicianId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  status?: string | null;
  diagnosis: {
    text?: string | null;
    code?: string | null;
  };
  payment: {
    method: PaymentMethod;
    /** Human friendly label like "Medical aid — Discovery Classic (Telemed: partial, 20% co-pay)" */
    displayLabel?: string | null;
    membership?: any | null;
    payments: any[];

    /** Explicit voucher usage when method === 'voucher-promo' */
    voucherCode?: string | null;
    voucherAmountCents?: number | null;
  };
  com: {
    /** Clinical motivation / cause-of-medical statement */
    summary: string;
    meta?: any;
  };
  preauth: {
    /** Pre-authorisation number / status, if known */
    number?: string | null;
    status?: string | null;
    meta?: any;
  };
  financials: {
    /** Co-payment and deductible info if we can infer it */
    copayment?: number | null;
    deductible?: number | null;
    telemedCover?: TelemedCover | null;
    telemedCopayType?: 'fixed' | 'percent' | null;
    telemedCopayValue?: number | null;

    /** Voucher contribution (if voucher-promo was used) */
    voucherAmountCents?: number | null;

    rawMembership?: any | null;
    rawPayments?: any[];
  };
  attachments: any[];
  mode: AutoSubmitBody['mode'];
  followupId?: string | null;
  followupSlot?: { start: string; end: string } | null;

  // provider + session orders + IoMT context
  provider?: ProviderBlock;
  erxOrders?: any[];
  labOrders?: any[];
  iomtUsed?: string[]; // e.g. ["Health Monitor", "Digital Stethoscope"]
};

async function readClaims(): Promise<ClaimRecord[]> {
  try {
    const txt = await fs.readFile(CLAIMS_STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeClaims(list: ClaimRecord[]) {
  await fs.writeFile(CLAIMS_STORE, JSON.stringify(list, null, 2), 'utf8');
}

async function readMedicalAids(): Promise<MedicalAidMembership[]> {
  try {
    const txt = await fs.readFile(MEDICAL_AIDS_STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readClinicians(): Promise<any[]> {
  try {
    const txt = await fs.readFile(CLINICIANS_STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lower(v: any) {
  return v == null ? '' : String(v).toLowerCase();
}

export async function POST(req: NextRequest) {
  let body: AutoSubmitBody;
  try {
    body = (await req.json()) as AutoSubmitBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { encounterId } = body;
  if (!encounterId) {
    return NextResponse.json({ error: 'encounterId is required' }, { status: 400 });
  }

  // Look up encounter + payments from the in-memory demo store
  const encounter = store.encounters.get(encounterId);
  const payments = Array.from(store.payments.values()).filter(
    (p: any) => p.caseId === encounter?.caseId,
  );

  const patientIdFromEncounter = body.patientId ?? encounter?.patientId;
  const clinicianIdFromEncounter = body.clinicianId ?? encounter?.clinicianId ?? null;

  // Attachments + legacy DB-backed memberships + session orders from "demo DB"
  let attachments: any[] = [];
  let dbMembershipFallback: any | null = null;
  let erxOrders: any[] = [];
  let labOrders: any[] = [];
  try {
    const db: any = await readDb();
    const memberships = Array.isArray(db?.memberships) ? db.memberships : [];
    const attachmentsAll = Array.isArray(db?.attachments) ? db.attachments : [];
    const erxAll = Array.isArray(db?.erxOrders) ? db.erxOrders : [];
    const labAll = Array.isArray(db?.labOrders) ? db.labOrders : [];

    dbMembershipFallback =
      memberships.find(
        (m: any) =>
          String(m.patientId ?? m.memberId ?? '') ===
          String(patientIdFromEncounter ?? ''),
      ) ?? null;

    attachments = attachmentsAll.filter(
      (a: any) =>
        a.encounterId === encounterId ||
        (encounter?.caseId && a.caseId === encounter.caseId),
    );

    erxOrders = erxAll.filter(
      (o: any) =>
        o.encounterId === encounterId ||
        o.caseId === encounter?.caseId,
    );
    labOrders = labAll.filter(
      (o: any) =>
        o.encounterId === encounterId ||
        o.caseId === encounter?.caseId,
    );
  } catch (err) {
    console.warn(
      '[claims/auto-submit] readDb failed, proceeding without DB memberships/eRx/labs',
      err,
    );
  }

  // Prefer shared medical-aids.json for membership + COM/telemed details
  let membership: MedicalAidMembership | any | null = null;
  try {
    const list = await readMedicalAids();
    const filtered = list.filter(
      (m) =>
        String(m.patientId) ===
        String(patientIdFromEncounter ?? 'pt-za-001'),
    );
    filtered.sort((a, b) => {
      const aTs = Date.parse(a.updatedAt || a.createdAt || '');
      const bTs = Date.parse(b.updatedAt || b.createdAt || '');
      return (isNaN(bTs) ? 0 : bTs) - (isNaN(aTs) ? 0 : aTs);
    });
    const preferred = filtered.find((m) => m.active) ?? filtered[0];
    if (preferred) {
      membership = preferred;
    }
  } catch (err) {
    console.warn('[claims/auto-submit] failed to read medical-aids.json', err);
  }

  if (!membership && dbMembershipFallback) {
    membership = dbMembershipFallback;
  }

  // Infer payment method
  let paymentMethod: PaymentMethod = 'unknown';

  if (membership && (membership.scheme || membership.planName || membership.payerName || membership.plan)) {
    paymentMethod = 'medical-aid';
  } else if (payments.length > 0) {
    const hasMedicalAid = payments.some((p: any) => {
      const method = lower(p.method || p.channel || p.source || p.meta?.paymentMethod);
      return (
        method.includes('medical-aid') ||
        method.includes('medical aid') ||
        method.includes('insurance') ||
        method.includes('scheme')
      );
    });

    const hasVoucher = payments.some((p: any) => {
      const method = lower(p.method || p.channel || p.source || p.meta?.paymentMethod);
      return (
        method.includes('voucher') ||
        method.includes('promo') ||
        method.includes('coupon') ||
        method.includes('gift card')
      );
    });

    const hasCard = payments.some((p: any) => {
      const method = lower(p.method || p.channel || p.source || p.meta?.paymentMethod);
      return (
        method.includes('card') ||
        method.includes('credit') ||
        method.includes('debit') ||
        method.includes('visa') ||
        method.includes('mastercard') ||
        method.includes('stripe') ||
        method.includes('checkout') ||
        method.includes('paystack')
      );
    });

    if (hasMedicalAid) {
      paymentMethod = 'medical-aid';
    } else if (hasVoucher) {
      paymentMethod = 'voucher-promo';
    } else if (hasCard) {
      paymentMethod = 'self-pay-card';
    } else {
      paymentMethod = 'self-pay-card';
    }
  } else {
    paymentMethod = 'self-pay-card';
  }

  // Extract telemed cover information from membership if present
  const telemedCover = (membership?.telemedCover ??
    membership?.telemedicineCover ??
    membership?.virtualConsultsCover) as TelemedCover | undefined;

  const telemedCopayType =
    (membership?.telemedCopayType as 'fixed' | 'percent' | undefined) ??
    undefined;
  const telemedCopayValue =
    typeof membership?.telemedCopayValue === 'number'
      ? membership.telemedCopayValue
      : undefined;

  // Build a human-readable display label for this payment
  let paymentDisplayLabel: string | undefined = body.paymentDisplayLabel ?? undefined;
  if (!paymentDisplayLabel) {
    if (paymentMethod === 'medical-aid') {
      const payer =
        membership?.payerName ||
        membership?.scheme ||
        membership?.plan ||
        membership?.planName ||
        'Medical aid';
      const memberNo =
        membership?.membershipNumber || membership?.memberNumber || '–';
      const dep = membership?.dependentCode ? `-${membership.dependentCode}` : '';
      const telemedPart =
        telemedCover && telemedCover !== 'none'
          ? telemedCover === 'full'
            ? 'Telemed: full cover'
            : telemedCopayType && telemedCopayValue != null
            ? `Telemed: partial, ${
                telemedCopayType === 'percent'
                  ? `${telemedCopayValue}% co-pay`
                  : `R${telemedCopayValue} co-pay`
              }`
            : 'Telemed: partial cover'
          : 'Telemed: not covered / unknown';
      paymentDisplayLabel = `${payer} — member ${memberNo}${dep} (${telemedPart})`;
    } else if (paymentMethod === 'self-pay-card') {
      paymentDisplayLabel = 'Self-pay — card (credit/debit)';
    } else if (paymentMethod === 'voucher-promo') {
      paymentDisplayLabel = 'Voucher / promo (pre-paid)';
    } else {
      paymentDisplayLabel = 'Payment method: unknown (demo)';
    }
  }

  const now = new Date().toISOString();
  const id = `clm-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const diagnosisText = body.diagnosisText ?? undefined;
  const diagnosisCode = body.diagnosisCode ?? undefined;

  // Try to infer IoMT usage (demo): if encounter meta lists any known devices
  const knownIomtDevices = [
    'Health Monitor',
    'Digital Stethoscope',
    'Digital Otoscope',
    'NexRing',
  ];
  const iomtUsed: string[] = [];
  const encDevices: any[] =
    (encounter?.devices as any[]) ??
    (encounter?.meta?.devices as any[]) ??
    [];
  for (const d of encDevices) {
    const label = String(d?.label ?? d?.name ?? '').trim();
    if (!label) continue;
    if (knownIomtDevices.includes(label) && !iomtUsed.includes(label)) {
      iomtUsed.push(label);
    }
  }

  const summaryParts: string[] = [];
  if (encounter?.reason)
    summaryParts.push(`Reason for visit: ${encounter.reason}`);
  if (diagnosisText) summaryParts.push(`Diagnosis: ${diagnosisText}`);
  if (diagnosisCode) summaryParts.push(`ICD-10: ${diagnosisCode}`);
  if (encounter?.summary)
    summaryParts.push(`Session summary: ${encounter.summary}`);

  // eRx + lab summary lines
  if (erxOrders.length > 0) {
    summaryParts.push(
      `Electronic prescriptions: ${erxOrders.length} order(s) captured during this encounter.`,
    );
  }
  if (labOrders.length > 0) {
    summaryParts.push(
      `Laboratory orders: ${labOrders.length} panel(s) / test order(s) requested.`,
    );
  }

  if (telemedCover) {
    const telemedLine =
      telemedCover === 'full'
        ? 'Policy indicates full cover for virtual consultations (telemedicine).'
        : telemedCover === 'partial'
        ? telemedCopayType && telemedCopayValue != null
          ? `Policy indicates partial cover for telemedicine with ${
              telemedCopayType === 'percent'
                ? `${telemedCopayValue}%`
                : `R${telemedCopayValue.toFixed(2)}`
            } co-payment.`
          : 'Policy indicates partial cover for telemedicine (co-payment / deductible may apply).'
        : 'Telemedicine cover is not indicated or unknown.';
    summaryParts.push(telemedLine);
  }

  if (iomtUsed.length > 0) {
    summaryParts.push(
      `IoMT devices used: ${iomtUsed.join(
        ', ',
      )}. Session vitals and device readings are available in the attached record where required.`,
    );
  }

  const comSummary =
    summaryParts.join('\n') ||
    'Clinical motivation / COM not available in demo store.';

  // Naive co-payment / deductible extraction for demo
  let copayment: number | null = null;
  let deductible: number | null = null;
  for (const p of payments) {
    const kind = lower(p.kind || p.type || p.meta?.kind);
    const amt = Number(p.amount ?? p.value ?? p.amountCents);
    if (Number.isNaN(amt)) continue;

    if (kind.includes('copay') || kind.includes('co-pay')) {
      copayment = (copayment ?? 0) + amt;
    } else if (kind.includes('deduct')) {
      deductible = (deductible ?? 0) + amt;
    }
  }

  // Extract voucher usage (if any) from payments
  let voucherCode: string | null = null;
  let voucherAmountCents: number | null = null;

  if (paymentMethod === 'voucher-promo') {
    const voucherPayment = payments.find((p: any) => {
      const method = lower(p.method || p.channel || p.source || p.meta?.paymentMethod);
      const kind = lower(p.kind || p.type || p.meta?.kind);
      return (
        method.includes('voucher') ||
        method.includes('promo') ||
        method.includes('coupon') ||
        kind.includes('voucher') ||
        kind.includes('promo')
      );
    });

    if (voucherPayment) {
      voucherCode =
        voucherPayment.voucherCode ||
        voucherPayment.code ||
        voucherPayment.promoCode ||
        voucherPayment.meta?.voucherCode ||
        voucherPayment.meta?.code ||
        null;

      const rawAmt =
        voucherPayment.amountCents ??
        voucherPayment.amount ??
        voucherPayment.value ??
        voucherPayment.meta?.voucherAmountCents ??
        voucherPayment.meta?.valueCents;

      if (typeof rawAmt === 'number' && !Number.isNaN(rawAmt)) {
        voucherAmountCents = rawAmt;
      } else if (typeof rawAmt === 'string') {
        const parsed = Number(rawAmt);
        if (!Number.isNaN(parsed)) voucherAmountCents = parsed;
      }
    }
  }

  // If COM was uploaded as a separate attachment from the medical-aids profile, link it
  if (membership && membership.comFilePath) {
    attachments.push({
      kind: 'com',
      path: membership.comFilePath,
      name: membership.comFileName || 'Certificate of Membership (COM)',
      source: 'medical-aids.json',
    });
  }

  // Provider block (facility + clinician)
  let provider: ProviderBlock | undefined;
  try {
    const clinicians = await readClinicians();
    const c =
      clinicians.find(
        (x: any) =>
          String(x.id ?? x.userId ?? x.clinicianId ?? '') ===
          String(clinicianIdFromEncounter ?? ''),
      ) ?? null;

    provider = {
      facility: {
        name: 'Ambulant+ Center',
        address: '0B Meadowbrook Lane, Brynston 2152',
        email: 'patient-claims@ambulantplus.co.za',
        phone: '079 427 7111',
      },
      clinician: {
        id: clinicianIdFromEncounter,
        name:
          c?.displayName ??
          c?.fullName ??
          c?.name ??
          null,
        practiceName: c?.practiceName ?? null,
        practiceNumber:
          c?.practiceNumber ??
          c?.hpcsaRegNo ??
          c?.registrationNumber ??
          null,
        regulatorBody:
          c?.regulatorBody ??
          c?.regBody ??
          c?.boardCertificateIssuer ??
          'HPCSA',
        regulatorRegistration:
          c?.regulatorRegistration ?? null,
        independentContractor: true,
      },
    };
  } catch (err) {
    console.warn(
      '[claims/auto-submit] failed to read clinicians.json; provider block will be basic',
      err,
    );
    provider = {
      facility: {
        name: 'Ambulant+ Center',
        address: '0B Meadowbrook Lane, Brynston 2152',
        email: 'patient-claims@ambulantplus.co.za',
        phone: '079 427 7111',
      },
      clinician: {
        id: clinicianIdFromEncounter,
        name: null,
        practiceName: null,
        practiceNumber: null,
        regulatorBody: 'HPCSA',
        regulatorRegistration: null,
        independentContractor: true,
      },
    };
  }

  const claim: ClaimRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    encounterId,
    caseId: encounter?.caseId ?? null,
    clinicianId: clinicianIdFromEncounter,
    patientId: patientIdFromEncounter ?? null,
    patientName: body.patientName ?? null,
    status: 'submitted',
    diagnosis: {
      text: diagnosisText ?? null,
      code: diagnosisCode ?? null,
    },
    payment: {
      method: paymentMethod,
      displayLabel: paymentDisplayLabel ?? null,
      membership,
      payments,
      voucherCode,
      voucherAmountCents,
    },
    com: {
      summary: comSummary,
      meta: {
        generatedFrom:
          'encounter + diagnosis + telemed cover + session orders (demo)',
      },
    },
    preauth: {
      number:
        membership?.preauthNumber ??
        membership?.preAuthNumber ??
        membership?.preauth?.number ??
        membership?.preAuth?.number ??
        null,
      status:
        membership?.preauthStatus ??
        membership?.preAuthStatus ??
        membership?.preauth?.status ??
        membership?.preAuth?.status ??
        null,
      meta:
        membership?.preauth ??
        membership?.preAuth ??
        null,
    },
    financials: {
      copayment,
      deductible,
      telemedCover: telemedCover ?? null,
      telemedCopayType: telemedCopayType ?? null,
      telemedCopayValue:
        typeof telemedCopayValue === 'number' ? telemedCopayValue : null,
      voucherAmountCents,
      rawMembership: membership,
      rawPayments: payments,
    },
    attachments,
    mode: body.mode ?? 'end',
    followupId: body.followupId ?? null,
    followupSlot: body.followupSlot ?? null,

    provider,
    erxOrders,
    labOrders,
    iomtUsed,
  };

  const list = await readClaims();
  list.unshift(claim);
  await writeClaims(list);

  return NextResponse.json({
    ok: true,
    id,
    claim,
  });
}
