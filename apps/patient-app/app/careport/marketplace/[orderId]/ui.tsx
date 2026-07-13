// FILE: apps/patient-app/app/careport/marketplace/[orderId]/ui.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type OfferOption = {
  skuId: string;
  isGeneric: boolean;
  priceCents: number;
  currency: string;
};

type OfferLine = {
  orderItemId: string;
  stockFlag: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  options: OfferOption[];
};

type Pharmacy = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  country: string;
  currency: string;
  supportsPickup: boolean;
  supportsDelivery: boolean;
  acceptsMedicalAid: boolean;
  acceptedMedicalAids: string[];
  acceptsCard: boolean;
  acceptsRcs: boolean;
  acceptsStoreCard: boolean;
  acceptsCod: boolean;
};

type Offer = {
  offerId: string;
  pharmacy: Pharmacy;
  isPartial: boolean;
  prepEtaMin: number | null;
  distanceKm: number | null;
  deliveryEtaMin: number | null;
  pricing: {
    currency: string;
    subtotalRangeCents: { min: number; max: number };
    deliveryFeeCents: number;
    totalCheapestCents: number;
    codLimitCents: number;
  };
  lines: OfferLine[];
};

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  directions?: string | null;
};

type OrderShape = {
  id: string;
  status: string;
  fulfillment: "PICKUP" | "DELIVERY";
  destinationAddr?: string | null;
  patientId?: string | null;
  clientId?: string | null;
  clientMemberId?: string | null;
  coveragePlanId?: string | null;
  coverageAuthorizationId?: string | null;
  sponsorAmountMinor?: number | null;
  patientCopayMinor?: number | null;
};

type OffersResponse = {
  ok: boolean;
  acceptedCount: number;
  order: OrderShape;
  orderItems: OrderItem[];
  offers: Offer[];
};

type CoverageLine = {
  serviceType: "PHARMACY_ITEM" | "RIDER_DELIVERY";
  coveredAmountMinor: number;
  patientGapMinor: number;
  decision: string;
};

function money(cents: number, currency: string) {
  const v = (cents ?? 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency
  }).format(v);
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] px-2 py-0.5 rounded-full border bg-white">{children}</span>;
}


function orderStatusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED', 'COLLECTED', 'COMPLETED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (
    [
      'PAID',
      'PREPARING',
      'READY_FOR_PICKUP',
      'DISPATCHING',
      'RIDER_ASSIGNED',
      'EN_ROUTE_TO_PICKUP',
      'AT_PHARMACY',
      'PICKED_UP',
      'EN_ROUTE_TO_CUSTOMER',
      'DISPATCHED',
      'OUT_FOR_DELIVERY',
    ].includes(s)
  ) {
    return 'border-blue-200 bg-blue-50 text-blue-800';
  }

  if (['PAYMENT_PENDING', 'OFFERS_OPEN', 'CREATED', 'BROADCASTING', 'PHARMACY_SELECTED'].includes(s)) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (['FAILED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function partnerText(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text && text !== "[object Object]" ? text : "";
}

function partnerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function partnerInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return "Rx";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function pharmacyIdentityValue(pharmacy: Pharmacy, keys: string[]) {
  const record = pharmacy as Pharmacy & Record<string, unknown>;
  const kycPayload = partnerRecord(record.kycPayload);
  const profileMeta = partnerRecord(record.profileMeta);
  const visualIdentity = partnerRecord(
    kycPayload.visualIdentity || profileMeta.visualIdentity
  );

  for (const key of keys) {
    const direct = partnerText(record[key]);
    if (direct) return direct;

    const kyc = partnerText(kycPayload[key]);
    if (kyc) return kyc;

    const profile = partnerText(profileMeta[key]);
    if (profile) return profile;

    const visual = partnerText(visualIdentity[key]);
    if (visual) return visual;
  }

  return "";
}

function pharmacyDisplayName(pharmacy: Pharmacy) {
  return (
    pharmacyIdentityValue(pharmacy, ["tradingName", "displayName", "name"]) ||
    partnerText((pharmacy as Pharmacy & Record<string, unknown>).name) ||
    "Pharmacy"
  );
}

function pharmacyLegalName(pharmacy: Pharmacy) {
  return pharmacyIdentityValue(pharmacy, ["registeredName", "legalName", "registeredLegalName"]);
}

function pharmacyLogoUrl(pharmacy: Pharmacy) {
  return pharmacyIdentityValue(pharmacy, ["logoUrl", "logoDataUrl", "imageUrl"]);
}

function pharmacyCredentialLine(pharmacy: Pharmacy) {
  const sapc = pharmacyIdentityValue(pharmacy, [
    "sapcNumber",
    "sapc",
    "pharmacyCouncilNumber",
    "licenseNumber",
    "licenceNumber",
    "registrationNumber",
  ]);

  return sapc ? `SAPC/licence ${sapc}` : "";
}

function pharmacyLocationLine(pharmacy: Pharmacy) {
  const record = pharmacy as Pharmacy & Record<string, unknown>;
  return [
    partnerText(record.address),
    partnerText(record.city),
    partnerText(record.province),
  ]
    .filter(Boolean)
    .join(", ");
}

function PharmacyIdentityCard({ pharmacy }: { pharmacy: Pharmacy }) {
  const displayName = pharmacyDisplayName(pharmacy);
  const legalName = pharmacyLegalName(pharmacy);
  const logoUrl = pharmacyLogoUrl(pharmacy);
  const credential = pharmacyCredentialLine(pharmacy);

  return (
    <div data-a4p3="careport-pharmacy-identity" className="flex min-w-0 items-start gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${displayName} logo`}
          className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800">
          {partnerInitials(displayName)}
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-950">{displayName}</div>
        {legalName && legalName !== displayName ? (
          <div className="mt-0.5 truncate text-xs text-slate-500">{legalName}</div>
        ) : null}
        {credential ? (
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {credential}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function carePortReadinessMessage(payload: any, fallback: string) {
  const code = String(payload?.error || payload?.code || '').trim();

  if (code === 'pharmacy_not_kyc_approved') {
    return 'This pharmacy is no longer approved for CarePort fulfilment. Please choose another pharmacy offer.';
  }

  if (code === 'pharmacy_not_active') {
    return 'This pharmacy is not currently active for CarePort fulfilment. Please choose another pharmacy offer.';
  }

  if (code === 'pharmacy_not_found') {
    return 'This pharmacy offer is no longer available. Please refresh the pharmacy offers.';
  }

  if (code === 'rider_not_active' || code === 'rider_not_kyi_verified' || code === 'rider_profile_not_found') {
    return 'CarePort could not dispatch a verified rider for this order yet. Please try again shortly or choose pickup where available.';
  }

  return String(payload?.message || payload?.error || fallback);
}

export default function MarketplaceClient({ orderId }: { orderId: string }) {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchMoreBusy, setSearchMoreBusy] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  const [selectionsByOffer, setSelectionsByOffer] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOfferId, setCheckoutOfferId] = useState<string | null>(null);
  const [checkoutTotals, setCheckoutTotals] = useState<{
    currency: string;
    subtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
  } | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);

  const [useSponsor, setUseSponsor] = useState(true);
  const [patientGapPaymentMethod, setPatientGapPaymentMethod] = useState<"CARD" | "COD">("CARD");
  const [gapRequired, setGapRequired] = useState(false);
  const [coverageLines, setCoverageLines] = useState<CoverageLine[]>([]);
  const [coverageBusy, setCoverageBusy] = useState(false);

  const [allowPartialFulfillment, setAllowPartialFulfillment] = useState(false);
  const [allowGenericSubstitution, setAllowGenericSubstitution] = useState(true);

  const [sortBy, setSortBy] = useState<"soonest" | "lowest_total" | "lowest_delivery" | "nearest">("soonest");
  const [fullOnly, setFullOnly] = useState(false);
  const [medicalAidOnly, setMedicalAidOnly] = useState(false);
  const [codOnly, setCodOnly] = useState(false);

  const prepDefaultMin = 10;
  const arriveMin = (o: Offer) => {
    const prep = o.prepEtaMin ?? prepDefaultMin;
    const travel = o.deliveryEtaMin ?? 0;
    return prep + travel;
  };

  async function refreshOffers(showLoading = true) {
    if (showLoading) setLoading(true);
    setErr(null);

    try {
      const r = await fetch(`/api/careport/orders/${encodeURIComponent(orderId)}/offers`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        setErr(j?.error || `HTTP ${r.status}`);
        setData(null);
        return;
      }

      setData(j);
    } catch (e: any) {
      setErr(e?.message || "Failed to load offers");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refreshOffers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function searchMorePharmacies() {
    setSearchMoreBusy(true);
    setBroadcastMsg(null);
    setErr(null);

    try {
      const r = await fetch(`/api/careport/orders/${encodeURIComponent(orderId)}/broadcast`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ searchMore: true }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `broadcast_http_${r.status}`);
      }

      const policy = j?.policy;
      const radius = j?.radiusKm != null ? `${j.radiusKm} km` : "the next radius band";
      const source = policy?.source === "database" ? "admin settings" : "default policy";
      setBroadcastMsg(`Search expanded to ${radius}. Invited ${j.invitedCount ?? 0} eligible pharmacies using ${source}.`);
      await refreshOffers(false);
    } catch (e: any) {
      setErr(e?.message || "Could not search more pharmacies.");
    } finally {
      setSearchMoreBusy(false);
    }
  }

  useEffect(() => {
    const order = data?.order;
    if (!order) return;

    const hasSponsorContext =
      Boolean(order.clientId) || Boolean(order.clientMemberId) || Boolean(order.coveragePlanId);

    setUseSponsor(hasSponsorContext);
  }, [data]);

  const orderItems: OrderItem[] = useMemo(() => (data?.orderItems ?? []) as any, [data]);
  const offers: Offer[] = useMemo(() => (data?.offers ?? []) as any, [data]);

  useEffect(() => {
    if (!offers.length) return;
    setSelectionsByOffer((prev) => {
      const next = { ...prev };
      for (const o of offers) next[o.offerId] = next[o.offerId] || {};
      return next;
    });
  }, [offers]);

  const visibleOffers = useMemo(() => {
    let list = offers.slice();

    const fulfillment = data?.order?.fulfillment ?? "DELIVERY";
    if (fulfillment === "DELIVERY") list = list.filter((o) => o.pharmacy.supportsDelivery);
    if (fulfillment === "PICKUP") list = list.filter((o) => o.pharmacy.supportsPickup);

    if (fullOnly) list = list.filter((o) => !o.isPartial);
    if (medicalAidOnly) list = list.filter((o) => o.pharmacy.acceptsMedicalAid);
    if (codOnly) list = list.filter((o) => o.pharmacy.acceptsCod);

    const inf = Number.POSITIVE_INFINITY;

    list.sort((a, b) => {
      if (sortBy === "soonest") {
        const av = a.deliveryEtaMin == null ? inf : arriveMin(a);
        const bv = b.deliveryEtaMin == null ? inf : arriveMin(b);
        return av - bv;
      }
      if (sortBy === "lowest_total") return a.pricing.totalCheapestCents - b.pricing.totalCheapestCents;
      if (sortBy === "lowest_delivery") return a.pricing.deliveryFeeCents - b.pricing.deliveryFeeCents;
      const ad = a.distanceKm == null ? inf : a.distanceKm;
      const bd = b.distanceKm == null ? inf : b.distanceKm;
      return ad - bd;
    });

    return list;
  }, [offers, data?.order?.fulfillment, sortBy, fullOnly, medicalAidOnly, codOnly]);

  const canBuyOffer = useMemo(() => {
    const byOffer: Record<string, boolean> = {};
    for (const o of offers) {
      const sel = selectionsByOffer[o.offerId] || {};
      const ok = orderItems.every((it) => {
        const line = o.lines.find((l) => l.orderItemId === it.id);
        if (!line) return false;
        if (line.stockFlag === "UNAVAILABLE") return false;
        if (!line.options?.length) return false;
        return Boolean(sel[it.id]);
      });
      byOffer[o.offerId] = ok;
    }
    return byOffer;
  }, [offers, orderItems, selectionsByOffer]);

  const setChoice = (offerId: string, orderItemId: string, skuId: string) => {
    setSelectionsByOffer((prev) => ({
      ...prev,
      [offerId]: { ...(prev[offerId] || {}), [orderItemId]: skuId }
    }));
  };

  async function runCoveragePreview(order: OrderShape, totals: { subtotalCents: number; deliveryFeeCents: number; totalCents: number; currency: string }) {
    if (!order.patientId || !useSponsor || !order.clientId) {
      setCoverageLines([]);
      setGapRequired(false);
      return;
    }

    setCoverageBusy(true);
    try {
      const requests: Promise<Response>[] = [];

      requests.push(
        fetch("/api/coverage/preflight", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            patientId: order.patientId,
            clientId: order.clientId,
            clinicianId: undefined,
            serviceType: "PHARMACY_ITEM",
            requestedAmountMinor: totals.subtotalCents
          })
        })
      );

      if (order.fulfillment === "DELIVERY" && totals.deliveryFeeCents > 0) {
        requests.push(
          fetch("/api/coverage/preflight", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              patientId: order.patientId,
              clientId: order.clientId,
              clinicianId: undefined,
              serviceType: "RIDER_DELIVERY",
              requestedAmountMinor: totals.deliveryFeeCents
            })
          })
        );
      }

      const responses = await Promise.all(requests);
      const parsed = await Promise.all(responses.map((r) => r.json().catch(() => ({}))));

      const nextLines: CoverageLine[] = parsed.map((js, idx) => {
        const serviceType = idx === 0 ? "PHARMACY_ITEM" : "RIDER_DELIVERY";
        const sponsorAmount = Number(js?.sponsorAmountMinor ?? 0);
        const patientGap = Number(js?.patientCopayMinor ?? (idx === 0 ? totals.subtotalCents : totals.deliveryFeeCents));
        const decision = String(js?.decision ?? "FALLBACK_TO_SELF_PAY");

        return {
          serviceType,
          coveredAmountMinor: sponsorAmount,
          patientGapMinor: patientGap,
          decision
        };
      });

      setCoverageLines(nextLines);
      setGapRequired(nextLines.some((x) => x.patientGapMinor > 0));
    } finally {
      setCoverageBusy(false);
    }
  }

  const openCheckout = async (offerId: string) => {
    setCheckoutOpen(true);
    setCheckoutOfferId(offerId);
    setCheckoutTotals(null);
    setCheckoutMsg(null);
    setCoverageLines([]);
    setGapRequired(false);

    if (!canBuyOffer[offerId]) {
      setCheckoutMsg("Please select one option (Original or Generic) for every available item before continuing.");
      return;
    }

    const sel = selectionsByOffer[offerId] || {};
    const payload = {
      offerId,
      allowPartialFulfillment,
      allowGenericSubstitution,
      selections: Object.fromEntries(orderItems.map((it) => [it.id, { chosenSkuId: sel[it.id] }]))
    };

    setBusy(true);
    try {
      const r = await fetch(`/api/careport/orders/${encodeURIComponent(orderId)}/select`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || j?.ok === false) {
        setErr(carePortReadinessMessage(j, "Could not select pharmacy offer."));
        return;
      }      if (!r.ok || !j?.ok) {
        setCheckoutMsg(j?.error || `Select failed: HTTP ${r.status}`);
        return;
      }
      const o = j.order;
      const totals = {
        currency: o.currency,
        subtotalCents: Number(o.subtotalCents ?? 0),
        deliveryFeeCents: Number(o.deliveryFeeCents ?? 0),
        totalCents: Number(o.totalCents ?? 0)
      };
      setCheckoutTotals(totals);
      await runCoveragePreview(o, totals);
    } finally {
      setBusy(false);
    }
  };

  const computedPatientPayable = useMemo(() => {
    if (!checkoutTotals) return 0;
    if (!useSponsor) return checkoutTotals.totalCents;
    if (coverageLines.length === 0) return checkoutTotals.totalCents;
    return coverageLines.reduce((sum, x) => sum + x.patientGapMinor, 0);
  }, [checkoutTotals, useSponsor, coverageLines]);

  const doCheckout = async () => {
    if (!checkoutOfferId || !checkoutTotals) return;
    setBusy(true);
    setCheckoutMsg(null);

    try {
      const sponsorOnlyZeroGap = useSponsor && computedPatientPayable === 0;
      const body = {
        useSponsor,
        paymentMethod: sponsorOnlyZeroGap ? "MEDICAL_AID" : patientGapPaymentMethod,
        gapPaymentMethod: useSponsor && computedPatientPayable > 0 ? patientGapPaymentMethod : undefined,
        allowPartialFulfillment,
        allowGenericSubstitution
      };

      const r = await fetch(`/api/careport/orders/${encodeURIComponent(orderId)}/checkout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `patient-ui:${orderId}:${useSponsor ? "sponsor" : "self"}:${patientGapPaymentMethod}`
        },
        body: JSON.stringify(body)
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || j?.ok === false) {
        setErr(carePortReadinessMessage(j, "Could not checkout CarePort order."));
        return;
      }      if (!r.ok || !j?.ok) {
        setCheckoutMsg(j?.error || `Checkout failed: HTTP ${r.status}`);
        return;
      }
      setCheckoutMsg(
        computedPatientPayable > 0
          ? "Sponsor applied where available. Your gap payment has been captured and the pharmacy can now prepare the order."
          : "Sponsor coverage applied successfully. Pharmacy will start preparing your order."
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6">Loading pharmacy offers…</div>;
  if (err) return <div className="p-6 text-red-600">Failed to load offers: {err}</div>;
  if (!data) return <div className="p-6">No data.</div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xl font-semibold">CarePort Marketplace</div>
          <div className="text-sm text-gray-600">
            Accepted pharmacies: <b>{data.acceptedCount}</b>
            {data.order.destinationAddr ? (
              <>
                {" "}
                · Delivering to: <span className="font-medium">{data.order.destinationAddr}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
                    <div className="flex flex-wrap items-center justify-start gap-2 text-xs text-gray-600 md:justify-end">
            <span>
              Order: <span className="font-mono">{data.order.id}</span>
            </span>
            <span className={`rounded-full border px-2 py-0.5 font-semibold ${orderStatusTone(data.order.status)}`}>
              {String(data.order.status || "UNKNOWN").replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/careport/timeline?id=${encodeURIComponent(data.order.id)}`}
              className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Timeline
            </a>

            {data.order.fulfillment === "DELIVERY" ? (
              <a
                href={`/careport/track?orderId=${encodeURIComponent(data.order.id)}`}
                className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Track
              </a>
            ) : null}

            <a
              href="/careport/history"
              className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              History
            </a>
          </div>
          <button
            type="button"
            onClick={() => void searchMorePharmacies()}
            disabled={searchMoreBusy}
            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {searchMoreBusy ? "Searching…" : "Search more pharmacies"}
          </button>
        </div>
      </div>

      {broadcastMsg ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {broadcastMsg}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div className="font-medium text-sm">Patient payment preferences</div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useSponsor}
            onChange={(e) => setUseSponsor(e.target.checked)}
            disabled={!data.order.clientId}
          />
          Use sponsor / medical aid where available
        </label>

        {!data.order.clientId ? (
          <div className="text-xs text-amber-700">
            No sponsor context is attached to this order yet. This order will proceed as self-pay unless sponsor context is added upstream.
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowGenericSubstitution}
            onChange={(e) => setAllowGenericSubstitution(e.target.checked)}
          />
          Allow generic substitution
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowPartialFulfillment}
            onChange={(e) => setAllowPartialFulfillment(e.target.checked)}
          />
          Allow partial fulfilment if some items are unavailable
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-600">Sort:</label>
          <select className="border rounded px-2 py-1 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="soonest">Soonest arrival</option>
            <option value="lowest_total">Lowest total</option>
            <option value="lowest_delivery">Lowest delivery fee</option>
            <option value="nearest">Nearest pharmacy</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fullOnly} onChange={(e) => setFullOnly(e.target.checked)} />
            Full only
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={medicalAidOnly} onChange={(e) => setMedicalAidOnly(e.target.checked)} />
            Medical Aid
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={codOnly} onChange={(e) => setCodOnly(e.target.checked)} />
            COD
          </label>
        </div>
      </div>

      {visibleOffers.length === 0 ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-700">
          No offers match your filters. Try clearing filters.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOffers.map((offer) => {
          const currency = offer.pricing.currency;
          const buyEnabled = Boolean(canBuyOffer[offer.offerId]) && !busy;

          return (
            <div key={offer.offerId} className="rounded-2xl border bg-white shadow-sm p-4 space-y-3 cursor-default">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PharmacyIdentityCard pharmacy={offer.pharmacy} />
                  <div className="text-xs text-gray-600">
                    {pharmacyLocationLine(offer.pharmacy) || "Address pending"}
                  </div>
                  <div className="text-xs text-gray-600">
                    {offer.distanceKm != null ? <span>{offer.distanceKm} km</span> : null}
                    <span> · Prep ~{offer.prepEtaMin ?? 10} min</span>
                    {offer.deliveryEtaMin != null ? (
                      <span> · Arrives ~{(offer.prepEtaMin ?? 10) + offer.deliveryEtaMin} min</span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-600">{offer.isPartial ? "Partial fulfilment" : "Full fulfilment"}</div>
                  <div className="font-semibold">
                    {money(offer.pricing.subtotalRangeCents.min, currency)}
                    {offer.pricing.subtotalRangeCents.max !== offer.pricing.subtotalRangeCents.min ? (
                      <span className="text-xs text-gray-500"> – {money(offer.pricing.subtotalRangeCents.max, currency)}</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-gray-600">Rx subtotal range</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {offer.pharmacy.acceptsMedicalAid ? (
                  <Badge>
                    Medical Aid
                    {offer.pharmacy.acceptedMedicalAids?.length
                      ? ` (${offer.pharmacy.acceptedMedicalAids.slice(0, 2).join(", ")}${offer.pharmacy.acceptedMedicalAids.length > 2 ? "…" : ""})`
                      : ""}
                  </Badge>
                ) : null}
                {offer.pharmacy.acceptsCard ? <Badge>Card</Badge> : null}
                {offer.pharmacy.acceptsRcs ? <Badge>RCS</Badge> : null}
                {offer.pharmacy.acceptsStoreCard ? <Badge>Store Card</Badge> : null}
                {offer.pharmacy.acceptsCod ? <Badge>COD</Badge> : <Badge>COD (not available)</Badge>}
              </div>

              <div className="border-t pt-3 space-y-3">
                {orderItems.map((item) => {
                  const line = offer.lines.find((l) => l.orderItemId === item.id);
                  const options = line?.options ?? [];
                  const chosen = selectionsByOffer[offer.offerId]?.[item.id] || "";
                  const disabled = line?.stockFlag === "UNAVAILABLE" || options.length === 0;

                  const originals = options.filter((o) => !o.isGeneric);
                  const generics = options.filter((o) => o.isGeneric);

                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">
                            {item.name} <span className="text-xs text-gray-500">×{item.quantity}</span>
                          </div>
                          {item.directions ? <div className="text-xs text-gray-600">{item.directions}</div> : null}
                        </div>
                        <div className="text-xs text-gray-600">{line?.stockFlag || "—"}</div>
                      </div>

                      <div className={`rounded-lg border p-2 ${disabled ? "opacity-60" : ""}`}>
                        <div className="text-xs text-gray-600 mb-1">Choose one (Original OR Generic):</div>

                        <div className="grid gap-2">
                          {originals.map((o) => (
                            <label key={o.skuId} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={`${offer.offerId}:${item.id}`}
                                checked={chosen === o.skuId}
                                onChange={() => setChoice(offer.offerId, item.id, o.skuId)}
                                disabled={disabled}
                              />
                              <span className="font-medium">Original</span>
                              <span className="text-gray-600">({money(o.priceCents, o.currency)} each)</span>
                            </label>
                          ))}

                          {generics.length ? <div className="text-xs text-gray-600 mt-1">Generic options:</div> : null}

                          {generics.map((o) => (
                            <label key={o.skuId} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={`${offer.offerId}:${item.id}`}
                                checked={chosen === o.skuId}
                                onChange={() => setChoice(offer.offerId, item.id, o.skuId)}
                                disabled={disabled}
                              />
                              <span className="font-medium">Generic</span>
                              <span className="text-gray-600">({money(o.priceCents, o.currency)} each)</span>
                            </label>
                          ))}

                          {!options.length ? <div className="text-xs text-red-600">No options for this item at this pharmacy.</div> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="text-sm">
                  <div className="text-xs text-gray-600">Delivery fee to your address:</div>
                  <div className="font-semibold">{money(offer.pricing.deliveryFeeCents, currency)}</div>
                </div>

                <div className="text-sm">
                  <div className="text-xs text-gray-600">Final Price including Rx and Delivery:</div>
                  <div className="font-semibold">{money(offer.pricing.totalCheapestCents, currency)}</div>
                </div>

                <button
                  className="w-full rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50"
                  onClick={() => openCheckout(offer.offerId)}
                  disabled={!buyEnabled}
                  title={!canBuyOffer[offer.offerId] ? "Select one option per item first" : "Proceed"}
                >
                  Buy Here
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Checkout</div>
              <button className="text-sm underline" onClick={() => setCheckoutOpen(false)} disabled={busy}>
                Close
              </button>
            </div>

            {checkoutMsg ? <div className="text-sm text-gray-700">{checkoutMsg}</div> : null}

            {checkoutTotals ? (
              <div className="rounded-xl border p-3 space-y-2">
                <div className="text-xs text-gray-600">Rx subtotal</div>
                <div className="font-semibold">{money(checkoutTotals.subtotalCents, checkoutTotals.currency)}</div>

                <div className="text-xs text-gray-600">Delivery fee</div>
                <div className="font-semibold">{money(checkoutTotals.deliveryFeeCents, checkoutTotals.currency)}</div>

                <div className="text-xs text-gray-600">Order total</div>
                <div className="text-lg font-semibold">{money(checkoutTotals.totalCents, checkoutTotals.currency)}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">Preparing totals…</div>
            )}

            <div className="rounded-xl border p-3 space-y-2">
              <div className="font-medium text-sm">Sponsor and gap summary</div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useSponsor}
                  onChange={(e) => setUseSponsor(e.target.checked)}
                  disabled={!data.order.clientId || busy}
                />
                Apply sponsor / medical aid where available
              </label>

              {coverageBusy ? <div className="text-sm text-gray-500">Checking coverage…</div> : null}

              {!coverageBusy && useSponsor && coverageLines.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {coverageLines.map((line) => (
                    <div key={line.serviceType} className="rounded-lg border p-2">
                      <div className="font-medium">{line.serviceType === "PHARMACY_ITEM" ? "Medication items" : "Delivery"}</div>
                      <div className="text-xs text-gray-600">Decision: {line.decision}</div>
                      <div className="text-xs text-gray-600">
                        Sponsor covers: {money(line.coveredAmountMinor, checkoutTotals?.currency || "ZAR")}
                      </div>
                      <div className="text-xs text-gray-600">
                        Patient outstanding: {money(line.patientGapMinor, checkoutTotals?.currency || "ZAR")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="text-sm">
                <div className="text-xs text-gray-600">Total patient payable now</div>
                <div className="font-semibold">{money(computedPatientPayable, checkoutTotals?.currency || "ZAR")}</div>
              </div>

              {gapRequired || !useSponsor ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {useSponsor ? "Choose payment method for uncovered gap" : "Choose payment method"}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(["CARD", "COD"] as const).map((m) => (
                      <button
                        key={m}
                        className={`rounded-full border px-3 py-1 text-sm ${patientGapPaymentMethod === m ? "bg-black text-white" : "bg-white"}`}
                        onClick={() => setPatientGapPaymentMethod(m)}
                        disabled={busy}
                      >
                        {m === "CARD" ? "Card" : "Cash on Delivery"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              className="w-full rounded-xl bg-black text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
              onClick={doCheckout}
              disabled={!checkoutTotals || busy || (computedPatientPayable > 0 && !patientGapPaymentMethod)}
            >
              {busy ? "Processing…" : "Confirm and Pay"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}