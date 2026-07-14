// apps/api-gateway/src/payments/paystack-transfers.ts
// A5_G_B_PAYSTACK_TRANSFER_SERVICE_HELPER
//
// Server-side Paystack Transfers helper for partner settlement payouts.
// This module intentionally contains no route/UI side effects. Finance routes
// should call these helpers only after explicit accountant/admin approval.

export const PAYSTACK_TRANSFER_SERVICE_HELPER_VERSION =
  'A5_G_B_PAYSTACK_TRANSFER_SERVICE_HELPER_V1';

export type PaystackRecipientType =
  | 'basa'
  | 'nuban'
  | 'ghipss'
  | 'mobile_money'
  | 'kepss'
  | 'authorization';

export type PaystackTransferStatus =
  | 'pending'
  | 'otp'
  | 'success'
  | 'failed'
  | 'abandoned'
  | 'reversed'
  | 'received'
  | 'unknown';

export type PaystackTransferRecipientInput = {
  name: string;
  accountNumber?: string;
  bankCode?: string;
  currency?: string;
  country?: string;
  type?: PaystackRecipientType;
  description?: string;
  metadata?: Record<string, any>;
  authorizationCode?: string;
};

export type PaystackTransferRecipient = {
  recipientCode: string;
  type: PaystackRecipientType | string;
  name: string;
  accountNumber?: string | null;
  bankCode?: string | null;
  currency?: string | null;
  raw: any;
};

export type PaystackTransferInput = {
  amountCents: number;
  recipientCode: string;
  reason?: string;
  reference: string;
  currency?: string;
  metadata?: Record<string, any>;
};

export type PaystackTransferResult = {
  ok: boolean;
  status: PaystackTransferStatus;
  reference: string;
  transferCode?: string | null;
  recipientCode?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  message?: string | null;
  raw: any;
};

export type PaystackBalance = {
  currency: string;
  balanceCents: number;
  raw: any;
};

export type PartnerBankDetails = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  branchCode?: string | null;
  currency: string;
  country: string;
  paystackRecipientCode?: string | null;
  source?: string | null;
};

function text(value: unknown, max = 512) {
  const raw = value === undefined || value === null ? '' : String(value);
  return raw.trim().slice(0, max);
}

function object(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function int(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function compactRecord(input: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }

  return out;
}

function paystackBaseUrl() {
  return text(process.env.PAYSTACK_BASE_URL, 240) || 'https://api.paystack.co';
}

function paystackSecretKey() {
  return text(process.env.PAYSTACK_SECRET_KEY, 512);
}

export function paystackTransfersEnabled() {
  return ['1', 'true', 'yes', 'enabled'].includes(
    text(process.env.PAYSTACK_TRANSFERS_ENABLED, 32).toLowerCase(),
  );
}

export function assertPaystackTransfersEnabled() {
  if (!paystackTransfersEnabled()) {
    throw new Error('paystack_transfers_disabled');
  }
}

export function paystackTransferSource() {
  return text(process.env.PAYSTACK_TRANSFER_SOURCE, 80) || 'balance';
}

export function paystackRecipientTypeFor(currency = 'ZAR', country = 'ZA'): PaystackRecipientType {
  const cur = text(currency, 8).toUpperCase();
  const c = text(country, 32).toUpperCase();

  if (cur === 'ZAR' || c === 'ZA' || c === 'ZAF' || c.includes('SOUTH')) return 'basa';
  if (cur === 'NGN' || c === 'NG' || c === 'NGA') return 'nuban';
  if (cur === 'GHS' || c === 'GH' || c === 'GHA') return 'ghipss';
  if (cur === 'KES' || c === 'KE' || c === 'KEN') return 'kepss';

  return 'basa';
}

async function paystackRequest<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const secret = paystackSecretKey();

  if (!secret) {
    throw new Error('missing_paystack_secret_key');
  }

  const res = await fetch(paystackBaseUrl().replace(/\/+$/, '') + pathname, {
    ...init,
    headers: {
      Authorization: \`Bearer \${secret}\`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const rawText = await res.text();
  let payload: any = {};

  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { rawText };
  }

  if (!res.ok || payload?.status === false) {
    const error = new Error(payload?.message || \`paystack_transfer_http_\${res.status}\`);
    (error as any).status = res.status;
    (error as any).payload = payload;
    throw error;
  }

  return payload as T;
}

export function normalizePaystackTransferStatus(value: unknown): PaystackTransferStatus {
  const status = text(value, 80).toLowerCase();

  if (status === 'pending') return 'pending';
  if (status === 'otp') return 'otp';
  if (status === 'success' || status === 'successful') return 'success';
  if (status === 'failed' || status === 'failure') return 'failed';
  if (status === 'abandoned') return 'abandoned';
  if (status === 'reversed' || status === 'reverse') return 'reversed';
  if (status === 'received') return 'received';

  return 'unknown';
}

export function buildPaystackTransferReference(parts: Array<unknown>) {
  const body = parts
    .map((part) => text(part, 160))
    .filter(Boolean)
    .join('_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 96);

  return body || \`ambulant_transfer_\${Date.now()}\`;
}

export function shapePaystackTransferResult(payload: any): PaystackTransferResult {
  const data = object(payload?.data || payload);
  const recipient = object(data.recipient);

  const reference =
    text(data.reference, 160) ||
    text(payload?.reference, 160);

  return {
    ok: payload?.status !== false,
    status: normalizePaystackTransferStatus(data.status || payload?.status),
    reference,
    transferCode: text(data.transfer_code || data.transferCode, 160) || null,
    recipientCode:
      text(data.recipient_code || data.recipientCode || recipient.recipient_code || recipient.recipientCode, 160) ||
      null,
    amountCents: data.amount !== undefined ? int(data.amount) : null,
    currency: text(data.currency, 8) || null,
    message: text(payload?.message || data.reason, 512) || null,
    raw: payload,
  };
}

export function extractPartnerBankDetails(source: unknown): PartnerBankDetails | null {
  const root = object(source);

  const candidates = [
    { label: 'root', value: root },
    { label: 'bank', value: root.bank },
    { label: 'bankAccount', value: root.bankAccount },
    { label: 'payout', value: root.payout },
    { label: 'payoutDetails', value: root.payoutDetails },
    { label: 'settlement', value: root.settlement },
    { label: 'settlementDetails', value: root.settlementDetails },
    { label: 'kycPayload', value: root.kycPayload },
    { label: 'kyiPayload', value: root.kyiPayload },
    { label: 'profileMeta', value: root.profileMeta },
    { label: 'verifiedIdentityMeta', value: root.verifiedIdentityMeta },
    { label: 'metadata', value: root.metadata },
    { label: 'meta', value: root.meta },
  ];

  for (const candidate of candidates) {
    const item = object(candidate.value);

    const accountName =
      text(item.accountName || item.bankAccountName || item.beneficiaryName || item.name || root.name, 180);

    const accountNumber =
      text(item.accountNumber || item.bankAccountNumber || item.account_number || item.number, 80);

    const bankCode =
      text(item.bankCode || item.bank_code || item.paystackBankCode || item.routingNumber || item.branchCode, 80);

    const bankName =
      text(item.bankName || item.bank || item.bank_name || item.institutionName, 180);

    const currency = text(item.currency || root.currency || 'ZAR', 8).toUpperCase() || 'ZAR';
    const country = text(item.country || root.country || 'ZA', 32).toUpperCase() || 'ZA';

    const paystackRecipientCode =
      text(
        item.paystackRecipientCode ||
          item.recipientCode ||
          item.recipient_code ||
          item.transferRecipientCode ||
          root.paystackRecipientCode ||
          root.recipientCode,
        180,
      ) || null;

    if (accountName && accountNumber && bankCode) {
      return {
        accountName,
        accountNumber,
        bankName,
        bankCode,
        branchCode: text(item.branchCode || item.branch_code, 80) || null,
        currency,
        country,
        paystackRecipientCode,
        source: candidate.label,
      };
    }
  }

  return null;
}

export function paystackBankDetailsReady(details: PartnerBankDetails | null) {
  return Boolean(details?.accountName && details?.accountNumber && details?.bankCode);
}

export async function createPaystackTransferRecipient(
  input: PaystackTransferRecipientInput,
): Promise<PaystackTransferRecipient> {
  assertPaystackTransfersEnabled();

  const currency = text(input.currency || 'ZAR', 8).toUpperCase() || 'ZAR';
  const country = text(input.country || 'ZA', 32).toUpperCase() || 'ZA';
  const type = input.type || paystackRecipientTypeFor(currency, country);

  const name = text(input.name, 180);
  if (!name) throw new Error('paystack_recipient_name_required');

  const payload: Record<string, any> = compactRecord({
    type,
    name,
    currency,
    description: text(input.description, 240),
    metadata: input.metadata,
  });

  if (type === 'authorization') {
    const authorizationCode = text(input.authorizationCode, 180);
    if (!authorizationCode) throw new Error('paystack_authorization_code_required');
    payload.authorization_code = authorizationCode;
  } else {
    const accountNumber = text(input.accountNumber, 80);
    const bankCode = text(input.bankCode, 80);

    if (!accountNumber) throw new Error('paystack_recipient_account_number_required');
    if (!bankCode) throw new Error('paystack_recipient_bank_code_required');

    payload.account_number = accountNumber;
    payload.bank_code = bankCode;
  }

  const response = await paystackRequest<any>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const data = object(response?.data || response);
  const recipientCode = text(data.recipient_code || data.recipientCode, 180);

  if (!recipientCode) {
    const error = new Error('paystack_recipient_code_missing');
    (error as any).payload = response;
    throw error;
  }

  return {
    recipientCode,
    type: text(data.type || type, 80),
    name: text(data.name || name, 180),
    accountNumber: text(data.details?.account_number || data.account_number || payload.account_number, 80) || null,
    bankCode: text(data.details?.bank_code || data.bank_code || payload.bank_code, 80) || null,
    currency: text(data.currency || currency, 8) || null,
    raw: response,
  };
}

export async function initiatePaystackTransfer(input: PaystackTransferInput): Promise<PaystackTransferResult> {
  assertPaystackTransfersEnabled();

  const amount = int(input.amountCents);
  if (amount <= 0) throw new Error('paystack_transfer_amount_required');

  const recipient = text(input.recipientCode, 180);
  if (!recipient) throw new Error('paystack_transfer_recipient_required');

  const reference = text(input.reference, 160);
  if (!reference) throw new Error('paystack_transfer_reference_required');

  const payload = compactRecord({
    source: paystackTransferSource(),
    amount,
    recipient,
    reason: text(input.reason, 240) || 'Ambulant+ partner payout',
    reference,
    currency: text(input.currency || 'ZAR', 8).toUpperCase() || 'ZAR',
    metadata: input.metadata,
  });

  const response = await paystackRequest<any>('/transfer', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return shapePaystackTransferResult(response);
}

export async function finalizePaystackTransferOtp(transferCode: string, otp: string) {
  assertPaystackTransfersEnabled();

  const code = text(transferCode, 180);
  const otpText = text(otp, 32);

  if (!code) throw new Error('paystack_transfer_code_required');
  if (!otpText) throw new Error('paystack_transfer_otp_required');

  const response = await paystackRequest<any>('/transfer/finalize_transfer', {
    method: 'POST',
    body: JSON.stringify({
      transfer_code: code,
      otp: otpText,
    }),
  });

  return shapePaystackTransferResult(response);
}

export async function verifyPaystackTransfer(reference: string) {
  const ref = text(reference, 180);
  if (!ref) throw new Error('paystack_transfer_reference_required');

  const response = await paystackRequest<any>(\`/transfer/verify/\${encodeURIComponent(ref)}\`, {
    method: 'GET',
  });

  return shapePaystackTransferResult(response);
}

export async function fetchPaystackTransfer(transferCodeOrId: string) {
  const value = text(transferCodeOrId, 180);
  if (!value) throw new Error('paystack_transfer_identifier_required');

  const response = await paystackRequest<any>(\`/transfer/\${encodeURIComponent(value)}\`, {
    method: 'GET',
  });

  return shapePaystackTransferResult(response);
}

export async function checkPaystackTransferBalance(currency = 'ZAR') {
  const response = await paystackRequest<any>('/balance', { method: 'GET' });
  const rows = Array.isArray(response?.data) ? response.data : [];
  const wanted = text(currency, 8).toUpperCase();

  const matched =
    rows.find((row: any) => text(row?.currency, 8).toUpperCase() === wanted) ||
    rows[0] ||
    null;

  return {
    currency: text(matched?.currency || wanted || 'ZAR', 8).toUpperCase(),
    balanceCents: int(matched?.balance || matched?.available_balance || 0),
    raw: response,
  } satisfies PaystackBalance;
}

export function shapePaystackTransferWebhook(body: unknown) {
  const eventBody = object(body);
  const data = object(eventBody.data);

  return {
    event: text(eventBody.event, 120),
    reference: text(data.reference || eventBody.reference, 180),
    transferCode: text(data.transfer_code || data.transferCode, 180) || null,
    recipientCode:
      text(data.recipient_code || data.recipientCode || object(data.recipient).recipient_code, 180) ||
      null,
    status: normalizePaystackTransferStatus(data.status),
    amountCents: data.amount !== undefined ? int(data.amount) : null,
    currency: text(data.currency, 8) || null,
    raw: eventBody,
  };
}
