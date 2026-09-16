import { deny, roleOf } from './engine';

const PUBLIC = new Set([
  'POST /api/careport/partners/pharmacy/apply', 'POST /api/careport/partners/rider/apply',
  'GET /api/careport/kyc/schemas', 'GET /api/careport/catalog/taxonomy',
  'GET /api/careport/catalogue/taxonomy', 'GET /api/careport/marketplace/products',
]);
export const publicRoute = (method: string, path: string) => method === 'OPTIONS' || PUBLIC.has(method + ' ' + path);
const RULES: Record<string, RegExp[]> = {
  pharmacy: [/^\/api\/careport\/pharmacies\/me(?:\/|$)/, /^\/api\/careport\/pharmacies\/\[pharmacyId\](?:\/kyc)?$/, /^\/api\/careport\/orders\/\[orderId\]\/pharmacies\/\[pharmacyId\]\/accept$/],
  rider: [/^\/api\/careport\/riders\/me(?:\/|$)/, /^\/api\/careport\/(location|stream)$/],
  lab: [/^\/api\/medreach\/labs(?:\/|$)/, /^\/api\/medreach\/phlebs(?:\/\[phlebId\]\/profile)?$/, /^\/api\/medreach\/(metrics|test-catalog|bundles|location|stream)$/, /^\/api\/medreach\/bundles\/\[bundleId\]\/custody$/, /^\/api\/medreach\/specimens\/\[specimenId\]\/(evidence|temperature)$/, /^\/api\/medreach\/lab-reviews(?:\/\[reviewId\])?$/],
  phleb: [/^\/api\/medreach\/phlebs\/\[phlebId\](?:\/|$)/, /^\/api\/medreach\/(metrics|bundles|location|stream)$/, /^\/api\/medreach\/bundles\/\[bundleId\]\/custody$/, /^\/api\/medreach\/specimens\/\[specimenId\]\/(evidence|temperature)$/, /^\/api\/medreach\/labs\/orders\/\[orderId\]$/],
};
export function assertRoute(account: any, method: string, template: string) {
  const role = roleOf(account.actorType);
  if (!RULES[role].some(rule => rule.test(template))) deny();
  if (template === '/api/medreach/labs' && method !== 'GET') deny();
  if (template === '/api/medreach/phlebs' && method !== 'GET') deny();
  if (template === '/api/medreach/test-catalog' && method !== 'GET') deny();
  if (role === 'lab' && template.includes('/phlebs/') && method !== 'GET') deny();
}
export function assertSelectors(account: any, values: Record<string, any>) {
  const role = roleOf(account.actorType);
  const own = [account.userId, account.actorRefId];
  const rules: Record<string, string[]> = { orgId: [account.orgId], actorRefId: [account.actorRefId], actorId: [account.userId], actorRole: [role] };
  if (role === 'pharmacy') rules.pharmacyId = [account.actorRefId];
  if (role === 'rider') { rules.riderId = own; rules.riderUserId = [account.userId]; }
  if (role === 'lab') { rules.labId = [account.actorRefId]; rules.labPartnerId = [account.actorRefId]; rules.partnerId = [account.actorRefId]; rules.defaultLabId = [account.actorRefId]; }
  if (role === 'phleb') rules.phlebId = own;
  for (const [key, allowed] of Object.entries(rules)) {
    if (values[key] != null && values[key] !== '' && !allowed.includes(String(values[key]))) deny('partner_scope_mismatch');
  }
}
export async function assertResources(db: any, account: any, template: string, params: any, query: URLSearchParams, body: any) {
  const role = roleOf(account.actorType); const ref = account.actorRefId;
  const values = [params, Object.fromEntries(query), body];
  for (const value of values) assertSelectors(account, value);
  const keys = (key: string): string[] => [...new Set(values.map(v => v[key]).filter(v => v != null && v !== '').map(String))];
  const own = [ref, account.userId];
  const drawOwned = (draw: any) => !!draw && (role === 'lab' ? draw.partnerId === ref : own.includes(draw.phlebId));
  const draws: any[] = [];
  for (const id of keys('orderId').concat(keys('jobId'))) {
    if (role === 'pharmacy') {
      const order = await db.carePortOrder.findUnique({ where: { id } });
      if (!order || order.orgId !== account.orgId) deny();
      if (template.endsWith('/accept')) {
        const offer = await db.carePortOffer.findFirst({ where: { orderId: id, pharmacyId: ref, orgId: account.orgId } });
        if (!offer || ['DECLINED', 'EXPIRED'].includes(offer.status)) deny();
      } else if (order.chosenPharmacyId !== ref) deny();
    } else if (role === 'rider') {
      const assigned = await db.carePortRiderAssignment.findFirst({ where: { orderId: id, riderUserId: account.userId, orgId: account.orgId } });
      if (!assigned) deny();
    } else {
      const draw = await db.draw.findFirst({ where: { OR: [{ orderId: id }, { id }] } });
      // Offers can be inspected/accepted only by a specifically eligible lab.
      if (!drawOwned(draw)) {
        const offer = role === 'lab' && template === '/api/medreach/labs/orders/[orderId]' && (!draw?.partnerId || draw.partnerId === ref)
          ? await db.medReachOrderEligibleLab.findFirst({ where: { orderId: id, labId: ref } }) : null;
        if (!offer || ['DECLINED', 'EXPIRED'].includes(offer.status)) deny();
      }
      if (draw) draws.push(draw);
    }
  }
  for (const id of keys('drawId')) {
    const draw = await db.draw.findUnique({ where: { id } });
    if (!drawOwned(draw)) deny(); draws.push(draw);
  }
  if (draws.length && draws.some(d => d.id !== draws[0].id)) deny('resource_scope_mismatch');
  const bundles: any[] = [];
  for (const id of keys('bundleId')) {
    const bundle = await db.medReachSpecimenBundle.findUnique({ where: { id }, include: { draw: true } });
    if (!bundle || bundle.orgId !== account.orgId || !(role === 'lab' ? bundle.labPartnerId === ref : drawOwned(bundle.draw))) deny();
    if (draws.length && bundle.drawId !== draws[0].id) deny('resource_scope_mismatch');
    bundles.push(bundle);
  }
  for (const id of keys('specimenId')) {
    const specimen = await db.medReachSpecimen.findUnique({ where: { id }, include: { bundle: { include: { draw: true } } } });
    const bundle = specimen?.bundle;
    if (!bundle || bundle.orgId !== account.orgId || !(role === 'lab' ? bundle.labPartnerId === ref : drawOwned(bundle.draw))) deny();
    if (bundles.some(b => b.id !== bundle.id) || (draws.length && bundle.drawId !== draws[0].id)) deny('resource_scope_mismatch');
  }
  if (role === 'lab') {
    for (const id of keys('phlebId')) {
      const phleb = await db.medReachPhlebProfile.findFirst({ where: { OR: [{ id }, { userId: id }] } });
      if (!phleb || phleb.defaultLabId !== ref) deny();
    }
  }
  // Global bundle listing and global lab billing are never partner operations.
  if (template === '/api/medreach/bundles' && !keys('bundleId').length && !keys('orderId').length && !keys('drawId').length) deny('resource_required', 400);
  if (template.endsWith('/location') && !keys('orderId').length) deny('resource_required', 400);
  if (/\/profile$|\/ky[ci]$|\/labs\/\[labId\]$/.test(template)) {
    for (const key of ['active', 'isActive', 'status', 'approvalStatus', 'approvedAt', 'approvedByUserId', 'ownerUserId', 'userId', 'kycStatus', 'kyiStatus', 'kycVerifiedAt', 'kyiVerifiedAt', 'verifiedIdentityMeta', 'commercialStatus', 'accountStatus', 'defaultLabId']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) deny('admin_review_required');
    }
  }
}
