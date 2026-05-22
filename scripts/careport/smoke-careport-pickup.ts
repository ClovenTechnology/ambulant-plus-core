const APIGW = process.env.APIGW_BASE || "http://localhost:3010";
const ORG_ID = process.env.CAREPORT_DEMO_ORG_ID || "org-default";
const PATIENT_USER_ID = "user-careport-demo-patient";
const PHARMACY_1_ID = "pharmacy-careport-demo-001";
const PHARMACY_1_STAFF_USER_ID = "user-careport-demo-pharmacy-staff-001";
const ERX_ORDER_ID = "erx-careport-demo-001";

function headers(role: string, uid: string) {
  return { "content-type": "application/json", "x-ambulant-org-id": ORG_ID, "x-org-id": ORG_ID, "x-ambulant-role": role, "x-role": role, "x-ambulant-user-id": uid, "x-user-id": uid, "x-uid": uid, "x-correlation-id": `careport-smoke-${Date.now()}` };
}
async function request(path: string, init: RequestInit & { expect?: number[] } = {}) {
  const res = await fetch(`${APIGW}${path}`, { ...init, headers: { ...(init.headers || {}) } });
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  const okStatuses = init.expect || [200, 201];
  if (!okStatuses.includes(res.status)) {
    console.error(`\n[FAIL] ${init.method || "GET"} ${path}`);
    console.error("Status:", res.status);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log(`[OK] ${init.method || "GET"} ${path} -> ${res.status}`);
  return body;
}
function buildSelections(offer: any) {
  const selections: Record<string, { chosenSkuId: string }> = {};
  for (const line of offer.lines || []) {
    const first = Array.isArray(line.options) ? line.options[0] : null;
    const sku = first?.skuId || first?.id;
    if (line.orderItemId && sku) selections[line.orderItemId] = { chosenSkuId: sku };
  }
  return selections;
}
async function main() {
  console.log(`CarePort pickup smoke test against ${APIGW}`);
  const push = await request("/api/careport/orders/push", { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ erxOrderId: ERX_ORDER_ID, fulfillment: "PICKUP", initiatedByRole: "patient", initiatedByUserId: PATIENT_USER_ID, allowPartialFulfillment: true, allowGenericSubstitution: true, preferredPaymentMethod: "CARD", metadata: { smoke: true, lane: "pickup" } }) });
  const orderId = push.orderId || push.order?.id;
  if (!orderId) throw new Error("No orderId returned from push");
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/broadcast`, { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ searchMore: true }) });
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/pharmacies/${encodeURIComponent(PHARMACY_1_ID)}/accept`, { method: "POST", headers: headers("pharmacy_staff", PHARMACY_1_STAFF_USER_ID), body: JSON.stringify({ prepEtaMin: 25, stockFlags: {}, allowPartialFulfillment: true }) });
  const offerRes = await request(`/api/careport/orders/${encodeURIComponent(orderId)}/offers`, { method: "GET", headers: headers("patient", PATIENT_USER_ID) });
  const offers = Array.isArray(offerRes.offers) ? offerRes.offers : [];
  if (!offers.length) throw new Error("No offers returned after pharmacy accept");
  const offer = offers.find((o: any) => Array.isArray(o.lines) && o.lines.length > 0) || offers[0];
  const selections = buildSelections(offer);
  if (!Object.keys(selections).length) { console.error(JSON.stringify(offer, null, 2)); throw new Error("Could not build SKU selections"); }
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/select`, { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ offerId: offer.id, selections, allowPartialFulfillment: true, allowGenericSubstitution: true }) });
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/checkout`, { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ paymentMethod: "CARD", useSponsor: false }) });
  for (const status of ["PREPARING", "READY_FOR_PICKUP", "COMPLETED"]) {
    await request(`/api/careport/pharmacies/me/orders/${encodeURIComponent(orderId)}/status`, { method: "POST", headers: headers("pharmacy_staff", PHARMACY_1_STAFF_USER_ID), body: JSON.stringify({ status, note: `Smoke test: ${status}` }) });
  }
  console.log("\n[PASS] CarePort pickup flow completed end to end.");
  console.log(`Order ID: ${orderId}`);
}
main().catch((e) => { console.error("[FAIL] CarePort pickup smoke test failed"); console.error(e); process.exitCode = 1; });
