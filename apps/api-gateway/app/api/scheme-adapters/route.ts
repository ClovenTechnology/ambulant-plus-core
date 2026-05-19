import { NextRequest, NextResponse } from "next/server";
import { requireApiClientRole } from "@/src/lib/client-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdapterChannel =
  | "CSV"
  | "CANONICAL_API"
  | "PORTAL_PACK"
  | "SWITCH"
  | "PRIVATE_API";

type SchemeAdapter = {
  id: string;
  name: string;
  country: string;
  schemeCode: string;
  administratorCode: string;
  status: "DEMO_READY" | "PRIVATE_ONBOARDING_REQUIRED" | "CONFIG_REQUIRED";
  channels: AdapterChannel[];
  supportedExports: string[];
  notes: string[];
  providerPaymentPolicy: {
    cliniciansWithoutPracticeNumber: string;
    cliniciansWithPracticeNumber: string;
    ambulantPracticeNumberUse: string;
  };
};

const ADAPTERS: SchemeAdapter[] = [
  {
    id: "adapter-generic-za-medical-scheme",
    name: "Generic South African Medical Scheme Adapter",
    country: "ZA",
    schemeCode: "GENERIC_ZA",
    administratorCode: "GENERIC_ADMIN",
    status: "DEMO_READY",
    channels: ["CSV", "CANONICAL_API", "PORTAL_PACK"],
    supportedExports: [
      "members",
      "eligibility",
      "authorizations",
      "claims",
      "remittance",
      "health-context",
      "scheme-applications",
    ],
    notes: [
      "Canonical Ambulant+ export shape for Medical Aid, HMO and administrator onboarding.",
      "Suitable for CSV upload, portal pack handoff, and private API mapping.",
    ],
    providerPaymentPolicy: {
      cliniciansWithoutPracticeNumber:
        "Free/Solo clinicians may prescribe using Ambulant+ practice numbers where allowed; claim payment should route to Ambulant+.",
      cliniciansWithPracticeNumber:
        "Clinicians with approved practice numbers may be paid directly into their own bank accounts when contract and banking profile allow.",
      ambulantPracticeNumberUse:
        "Ambulant+ remains payee for platform-owned claims, free/solo clinician claims, and claims submitted under Ambulant+ practice credentials.",
    },
  },
  {
    id: "adapter-medscheme-style",
    name: "Medscheme-style Administrator Pack",
    country: "ZA",
    schemeCode: "MEDSCHEME_STYLE",
    administratorCode: "MEDSCHEME_STYLE_ADMIN",
    status: "PRIVATE_ONBOARDING_REQUIRED",
    channels: ["CSV", "PORTAL_PACK", "PRIVATE_API"],
    supportedExports: [
      "members",
      "eligibility",
      "authorizations",
      "claims",
      "remittance",
      "health-context",
      "scheme-applications",
    ],
    notes: [
      "Use for Medscheme-type enterprise discussions: onboarding pack, scheme-specific reason codes, remittance mapping, and private integration agreement still required.",
      "Do not claim production API readiness until their private B2B pack is received.",
    ],
    providerPaymentPolicy: {
      cliniciansWithoutPracticeNumber:
        "Route scheme payment to Ambulant+ when the clinician uses Ambulant+ practice credentials.",
      cliniciansWithPracticeNumber:
        "Support direct provider payment where the clinician has a valid practice number and verified settlement profile.",
      ambulantPracticeNumberUse:
        "Ambulant+ can act as contracted digital provider / platform payee for free/solo clinicians and bundled care lanes.",
    },
  },
  {
    id: "adapter-discovery-style",
    name: "Discovery-style Scheme Pack",
    country: "ZA",
    schemeCode: "DISCOVERY_STYLE",
    administratorCode: "DISCOVERY_STYLE_ADMIN",
    status: "PRIVATE_ONBOARDING_REQUIRED",
    channels: ["CSV", "PORTAL_PACK", "PRIVATE_API"],
    supportedExports: [
      "members",
      "eligibility",
      "authorizations",
      "claims",
      "remittance",
      "health-context",
      "scheme-applications",
    ],
    notes: [
      "Use as a discussion-ready adapter posture for Discovery-type workflows.",
      "Final API, switching, reason-code and wellness-device certification requirements must come from private onboarding material.",
    ],
    providerPaymentPolicy: {
      cliniciansWithoutPracticeNumber:
        "Ambulant+ should be payee where scripts or claims use Ambulant+ practice numbers.",
      cliniciansWithPracticeNumber:
        "Direct settlement can be supported when clinician practice number, contract and bank account are verified.",
      ambulantPracticeNumberUse:
        "Supports Ambulant+ as the digital provider payee for platform-owned care and solo-tier clinicians.",
    },
  },
  {
    id: "adapter-momentum-style",
    name: "Momentum-style Scheme Pack",
    country: "ZA",
    schemeCode: "MOMENTUM_STYLE",
    administratorCode: "MOMENTUM_STYLE_ADMIN",
    status: "PRIVATE_ONBOARDING_REQUIRED",
    channels: ["CSV", "PORTAL_PACK", "PRIVATE_API"],
    supportedExports: [
      "members",
      "eligibility",
      "authorizations",
      "claims",
      "remittance",
      "health-context",
      "scheme-applications",
    ],
    notes: [
      "Supports Momentum Multiply-type wellness and reward discussions at architecture level.",
      "Production exports need private scheme-specific technical pack.",
    ],
    providerPaymentPolicy: {
      cliniciansWithoutPracticeNumber:
        "Claim proceeds should route to Ambulant+ where Ambulant+ practice credentials are used.",
      cliniciansWithPracticeNumber:
        "Direct clinician payout is allowed only after practice and banking verification.",
      ambulantPracticeNumberUse:
        "Use Ambulant+ as payee for platform-owned and free/solo clinician claim lanes.",
    },
  },
];

export async function GET(req: NextRequest) {
  const auth = requireApiClientRole(
    req,
    ["ORG_OWNER", "ORG_ADMIN", "EXPORT_MANAGER"],
  );

  if (auth.ok === false) {
  return auth.response;
}

  const { searchParams } = new URL(req.url);
  const country = String(searchParams.get("country") || "").toUpperCase();
  const channel = String(searchParams.get("channel") || "").toUpperCase();

  let items = ADAPTERS;

  if (country) {
    items = items.filter((x) => x.country === country);
  }

  if (channel) {
    items = items.filter((x) => x.channels.includes(channel as AdapterChannel));
  }

  return NextResponse.json({
    ok: true,
    items,
    summary: {
      total: items.length,
      demoReady: items.filter((x) => x.status === "DEMO_READY").length,
      privateOnboardingRequired: items.filter(
        (x) => x.status === "PRIVATE_ONBOARDING_REQUIRED"
      ).length,
      channels: Array.from(new Set(items.flatMap((x) => x.channels))),
    },
    audit: {
      sourceVersion: "scheme-adapters.v1",
      generatedAt: new Date().toISOString(),
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = requireApiClientRole(
    req,
    ["ORG_OWNER", "ORG_ADMIN", "EXPORT_MANAGER"],
  );

  if (auth.ok === false) {
  return auth.response;
}

  try {
    const body = await req.json().catch(() => ({}));

    const adapterId = String(body.adapterId || "").trim();
    const exportType = String(body.exportType || "").trim();

    const adapter = ADAPTERS.find((x) => x.id === adapterId);

    if (!adapter) {
      return NextResponse.json(
        { ok: false, error: "adapter_not_found" },
        { status: 404 }
      );
    }

    if (!adapter.supportedExports.includes(exportType)) {
      return NextResponse.json(
        { ok: false, error: "export_type_not_supported_by_adapter" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      adapter,
      dryRun: {
        exportType,
        mode: body.mode || "DRY_RUN",
        accepted: true,
        nextSteps:
          adapter.status === "DEMO_READY"
            ? [
                "Generate CSV or canonical JSON export.",
                "Share portal pack with scheme administrator.",
                "Map fields to private API once onboarding pack is received.",
              ]
            : [
                "Request private B2B onboarding pack.",
                "Map reason codes, claim acknowledgements and remittance fields.",
                "Run scheme-specific UAT before production use.",
              ],
      },
      audit: {
        sourceVersion: "scheme-adapter-dry-run.v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run adapter dry-run.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}