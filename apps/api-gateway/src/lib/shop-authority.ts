export const SHOP_CHANNELS = [
  'PATIENT',
  'CLINICIAN',
  'CAREPORT',
  'MEDREACH',
] as const;

export const SHOP_BUYER_TYPES = [
  'PATIENT',
  'CLINICIAN',
  'PHARMACY',
  'DELIVERY_RIDER',
  'LABORATORY',
  'PHLEBOTOMIST',
] as const;

export type ShopAuthorityChannel = (typeof SHOP_CHANNELS)[number];
export type ShopAuthorityBuyerType = (typeof SHOP_BUYER_TYPES)[number];

const CHANNEL_SET = new Set<string>(SHOP_CHANNELS);
const BUYER_SET = new Set<string>(SHOP_BUYER_TYPES);

export function normalizeShopChannel(value: unknown): ShopAuthorityChannel | null {
  const normalized = String(value || 'PATIENT').trim().toUpperCase();
  return CHANNEL_SET.has(normalized)
    ? (normalized as ShopAuthorityChannel)
    : null;
}

export function normalizeShopBuyerTypes(value: unknown): ShopAuthorityBuyerType[] {
  const values = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      values
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => BUYER_SET.has(item)) as ShopAuthorityBuyerType[],
    ),
  );
}

export function buyerTypesForChannel(channel: ShopAuthorityChannel) {
  switch (channel) {
    case 'PATIENT':
      return ['PATIENT'] as ShopAuthorityBuyerType[];
    case 'CLINICIAN':
      return ['CLINICIAN'] as ShopAuthorityBuyerType[];
    case 'CAREPORT':
      return ['PHARMACY', 'DELIVERY_RIDER'] as ShopAuthorityBuyerType[];
    case 'MEDREACH':
      return ['LABORATORY', 'PHLEBOTOMIST'] as ShopAuthorityBuyerType[];
  }
}

export function validateShopPublication(input: {
  channels: ShopAuthorityChannel[];
  buyerTypes: ShopAuthorityBuyerType[];
}) {
  const errors: string[] = [];
  if (!input.channels.length) {
    errors.push('At least one publication channel is required.');
  }

  for (const channel of input.channels) {
    const eligibleForChannel = new Set(buyerTypesForChannel(channel));
    if (!input.buyerTypes.some((buyer) => eligibleForChannel.has(buyer))) {
      errors.push(`Channel ${channel} requires at least one matching eligible buyer type.`);
    }
  }

  for (const buyerType of input.buyerTypes) {
    const represented = input.channels.some((channel) =>
      buyerTypesForChannel(channel).includes(buyerType),
    );
    if (!represented) {
      errors.push(`Buyer type ${buyerType} has no selected publication channel.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function publicationAllows(
  rows: Array<{ channel: string }> | null | undefined,
  channel: ShopAuthorityChannel,
) {
  // Locked invariant: zero channel rows means unpublished, never "visible everywhere".
  return Boolean(rows?.some((row) => String(row.channel) === channel));
}

export function eligibilityAllows(
  rows: Array<{ buyerType: string }> | null | undefined,
  buyerTypes: ShopAuthorityBuyerType[],
) {
  // Locked invariant: buyer eligibility is explicit. Zero rows means ineligible.
  if (!rows?.length || !buyerTypes.length) return false;
  const eligible = new Set(rows.map((row) => String(row.buyerType)));
  return buyerTypes.some((buyerType) => eligible.has(buyerType));
}

export function buyerUidFromHeaders(headers: Headers) {
  return (
    headers.get('x-uid') ||
    headers.get('x-user-id') ||
    headers.get('x-ambulant-user-id') ||
    ''
  ).trim();
}

export async function resolveBuyerTypes(
  db: any,
  channel: ShopAuthorityChannel,
  buyerUid: string,
): Promise<ShopAuthorityBuyerType[]> {
  if (channel === 'PATIENT') return ['PATIENT'];
  if (!buyerUid) return [];

  if (channel === 'CLINICIAN') {
    const clinician = await db.clinicianProfile.findUnique({
      where: { userId: buyerUid },
      select: { id: true, status: true, disabled: true, archived: true },
    });
    if (!clinician || clinician.disabled || clinician.archived) return [];
    const status = String(clinician.status || '').trim().toLowerCase();
    if (!['active', 'approved', 'verified', 'live'].includes(status)) return [];
    return ['CLINICIAN'];
  }

  if (channel === 'CAREPORT') {
    const [rider, pharmacyStaff] = await Promise.all([
      db.carePortRiderProfile.findUnique({
        where: { userId: buyerUid },
        select: { id: true, isActive: true },
      }),
      db.carePortPharmacyStaff.findUnique({
        where: { userId: buyerUid },
        select: { id: true },
      }),
    ]);

    const result: ShopAuthorityBuyerType[] = [];
    if (rider?.isActive) result.push('DELIVERY_RIDER');
    if (pharmacyStaff) result.push('PHARMACY');
    return result;
  }

  const [phleb, ownedLab, labStaff, networkStaff] = await Promise.all([
    db.medReachPhlebProfile.findUnique({
      where: { userId: buyerUid },
      select: { id: true, active: true },
    }),
    db.labPartner.findFirst({
      where: { ownerUserId: buyerUid, active: true },
      select: { id: true },
    }),
    db.medReachLabStaff.findFirst({
      where: { userId: buyerUid, active: true },
      select: { id: true },
    }),
    db.medReachLabNetworkStaff.findFirst({
      where: { userId: buyerUid, active: true },
      select: { id: true },
    }),
  ]);

  const result: ShopAuthorityBuyerType[] = [];
  if (phleb?.active) result.push('PHLEBOTOMIST');
  if (ownedLab || labStaff || networkStaff) result.push('LABORATORY');
  return result;
}
