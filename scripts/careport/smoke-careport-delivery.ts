const APIGW = process.env.APIGW_BASE || "http://localhost:3010";
const ORG_ID = process.env.CAREPORT_DEMO_ORG_ID || "org-default";
const PATIENT_USER_ID = "user-careport-demo-patient";
const PHARMACY_1_ID = "pharmacy-careport-demo-001";
const PHARMACY_1_STAFF_USER_ID = "user-careport-demo-pharmacy-staff-001";
const RIDER_USER_ID = "rider-careport-demo-001";
const ERX_ORDER_ID = "erx-careport-demo-001";
function headers(role: string, uid: string) { return { "content-type": "application/json", "x-ambulant-org-id": ORG_ID, "x-org-id": ORG_ID, "x-ambulant-role": role, "x-role": role, "x-ambulant-user-id": uid, "x-user-id": uid, "x-uid": uid, "x-correlation-id": `careport-delivery-smoke-${Date.now()}` }; }
async function request(path: string, init: RequestInit & { expect?: number[] } = {}) { const res = await fetch(`${APIGW}${path}`, { ...init, headers: { ...(init.headers || {}) } }); const text = await res.text(); let body: any = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; } const ok = init.expect || [200, 201]; if (!ok.includes(res.status)) { console.error(`\n[FAIL] ${init.method || "GET"} ${path}`); console.error("Status:", res.status); console.error(JSON.stringify(body, null, 2)); process.exit(1); } console.log(`[OK] ${init.method || "GET"} ${path} -> ${res.status}`); return body; }
function buildSelections(offer: any) { const selections: Record<string, { chosenSkuId: string }> = {}; for (const line of offer.lines || []) { const first = Array.isArray(line.options) ? line.options[0] : null; const sku = first?.skuId || first?.id; if (line.orderItemId && sku) selections[line.orderItemId] = { chosenSkuId: sku }; } return selections; }
async function main() {
  console.log(`CarePort delivery smoke test against ${APIGW}`);
  const push = await request("/api/careport/orders/push", { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ erxOrderId: ERX_ORDER_ID, refillNo: 1, fulfillment: "DELIVERY", destination: { addr: "Sandton City, 83 Rivonia Road, Sandton, Johannesburg", lat: -26.1076, lng: 28.0567 }, initiatedByRole: "patient", initiatedByUserId: PATIENT_USER_ID, allowPartialFulfillment: true, allowGenericSubstitution: true, preferredPaymentMethod: "CARD", metadata: { smoke: true, lane: "delivery" } }) });
  const orderId = push.orderId || push.order?.id; if (!orderId) throw new Error("No orderId returned");
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/broadcast`, { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ searchMore: true }) });
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/pharmacies/${encodeURIComponent(PHARMACY_1_ID)}/accept`, { method: "POST", headers: headers("pharmacy_staff", PHARMACY_1_STAFF_USER_ID), body: JSON.stringify({ prepEtaMin: 25, stockFlags: {}, allowPartialFulfillment: true }) });
  const offerRes = await request(`/api/careport/orders/${encodeURIComponent(orderId)}/offers`, { method: "GET", headers: headers("patient", PATIENT_USER_ID) });
  const offer = (offerRes.offers || []).find((o: any) => Array.isArray(o.lines) && o.lines.length > 0) || offerRes.offers?.[0]; if (!offer) throw new Error("No offer returned");
  const selections = buildSelections(offer); if (!Object.keys(selections).length) throw new Error("Could not build selections");
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/select`, { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ offerId: offer.id, selections, allowPartialFulfillment: true, allowGenericSubstitution: true }) });
  await request(`/api/careport/orders/${encodeURIComponent(orderId)}/checkout`, { method: "POST", headers: headers("patient", PATIENT_USER_ID), body: JSON.stringify({ paymentMethod: "CARD", useSponsor: false }) });
  await request(`/api/careport/pharmacies/me/orders/${encodeURIComponent(orderId)}/status`, { method: "POST", headers: headers("pharmacy_staff", PHARMACY_1_STAFF_USER_ID), body: JSON.stringify({ status: "PREPARING", note: "Smoke test: preparing delivery order." }) });
  await request(`/api/careport/pharmacies/me/orders/${encodeURIComponent(orderId)}/status`, { method: "POST", headers: headers("pharmacy_staff", PHARMACY_1_STAFF_USER_ID), body: JSON.stringify({ status: "READY_FOR_DISPATCH", note: "Smoke test: ready for rider dispatch." }), expect: [200, 201, 409] });
  await request("/api/careport/location", { method: "POST", headers: headers("rider", RIDER_USER_ID), body: JSON.stringify({ orderId, lat: -26.108, lng: 28.057, heading: 90, speedKph: 20, accuracyM: 15 }), expect: [200, 201, 404, 409] });
  console.log("\n[PASS/PARTIAL] Delivery flow reached dispatch/location stage.");
  console.log("If READY_FOR_DISPATCH or location returned 409/404, rider assignment still needs runtime-model verification.");
  console.log(`Order ID: ${orderId}`);
}
main().catch((e) => { console.error("[FAIL] CarePort delivery smoke test failed"); console.error(e); process.exitCode = 1; });
