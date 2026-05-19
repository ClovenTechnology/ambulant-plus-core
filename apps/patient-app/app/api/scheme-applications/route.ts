import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE = path.resolve(process.cwd(), "../../scheme-applications.json");

type SponsorType = "MEDICAL_AID" | "HMO" | "CORPORATE_SPONSOR";

type ConsentBundle = {
  version: string;
  accepted: boolean;
  acceptedAt: string | null;
  categories: {
    eligibilityAndEnrollment: boolean;
    clinicalHistory: boolean;
    medicationAdherence: boolean;
    clinicalGradeVitals: boolean;
    wearableWellness: boolean;
    reproductiveHealth: boolean;
    antenatalAndBirthRecord: boolean;
    rewardsAndWellness: boolean;
    claimsAndAuthorizations: boolean;
    communications: boolean;
  };
};

type SchemeApplication = {
  id: string;
  reference: string;
  status: "DRAFT" | "SUBMITTED" | "EXPORTED" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  updatedAt: string;

  patientId: string;
  userId?: string | null;

  sponsorType: SponsorType;
  sponsorId: string;
  sponsorName: string;
  planId: string;
  planName: string;

  applicant: {
    fullName: string;
    email: string;
    phone: string;
    dob?: string | null;
    idNumberHash: string;
    idNumberLast4: string;
    address?: string | null;
  };

  dependants: Array<{
    fullName: string;
    relationship: string;
    dob?: string | null;
    idNumberHash?: string | null;
    idNumberLast4?: string | null;
  }>;

  consent: ConsentBundle;

  profileContextSnapshot: {
    source: "patient_profile_prefill";
    patientId: string;
    generatedAt: string;
    declaredAllergies?: string[];
    declaredConditions?: string[];
  };

  exportPosture: {
    csvReady: boolean;
    apiReady: boolean;
    portalReady: boolean;
    switchReady: boolean;
    privateApiReady: boolean;
    lastExportedAt?: string | null;
  };

  metadata?: Record<string, any>;
};

function hashIdNumber(value: string) {
  const salt =
    process.env.SCHEME_APPLICATION_HASH_SALT ||
    process.env.NEXTAUTH_SECRET ||
    "ambulant-dev-scheme-application-salt";

  return crypto
    .createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex");
}

async function readList(): Promise<SchemeApplication[]> {
  try {
    const txt = await fs.readFile(STORE, "utf8");
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(list: SchemeApplication[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), "utf8");
}

function clean(value: unknown, max = 180) {
  const s = String(value ?? "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function isSponsorType(value: unknown): value is SponsorType {
  return ["MEDICAL_AID", "HMO", "CORPORATE_SPONSOR"].includes(String(value));
}

function defaultConsent(body: any): ConsentBundle {
  const now = new Date().toISOString();
  const categories = body?.consent?.categories || {};

  return {
    version: "POPIA-CONSENT-SCHEME-INTAKE-V1",
    accepted: Boolean(body?.consent?.accepted),
    acceptedAt: body?.consent?.accepted ? now : null,
    categories: {
      eligibilityAndEnrollment: Boolean(categories.eligibilityAndEnrollment),
      clinicalHistory: Boolean(categories.clinicalHistory),
      medicationAdherence: Boolean(categories.medicationAdherence),
      clinicalGradeVitals: Boolean(categories.clinicalGradeVitals),
      wearableWellness: Boolean(categories.wearableWellness),
      reproductiveHealth: Boolean(categories.reproductiveHealth),
      antenatalAndBirthRecord: Boolean(categories.antenatalAndBirthRecord),
      rewardsAndWellness: Boolean(categories.rewardsAndWellness),
      claimsAndAuthorizations: Boolean(categories.claimsAndAuthorizations),
      communications: Boolean(categories.communications),
    },
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const patientId = clean(url.searchParams.get("patientId"));
  const sponsorType = clean(url.searchParams.get("sponsorType"));

  let items = await readList();

  if (patientId) {
    items = items.filter((x) => x.patientId === patientId);
  }

  if (sponsorType) {
    items = items.filter((x) => x.sponsorType === sponsorType);
  }

  items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return NextResponse.json(
    { ok: true, items },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const patientId = clean(body.patientId);
    const sponsorType = body.sponsorType;
    const sponsorId = clean(body.sponsorId);
    const sponsorName = clean(body.sponsorName);
    const planId = clean(body.planId);
    const planName = clean(body.planName);

    const fullName = clean(body?.applicant?.fullName);
    const email = clean(body?.applicant?.email);
    const phone = clean(body?.applicant?.phone);
    const idNumber = clean(body?.applicant?.idNumber, 32);

    if (!patientId) {
      return NextResponse.json({ ok: false, error: "patientId_required" }, { status: 400 });
    }

    if (!isSponsorType(sponsorType)) {
      return NextResponse.json({ ok: false, error: "invalid_sponsorType" }, { status: 400 });
    }

    if (!sponsorId || !sponsorName || !planId || !planName) {
      return NextResponse.json({ ok: false, error: "sponsor_and_plan_required" }, { status: 400 });
    }

    if (!fullName || !email || !phone || !idNumber) {
      return NextResponse.json({ ok: false, error: "applicant_identity_required" }, { status: 400 });
    }

    const consent = defaultConsent(body);

    if (!consent.accepted) {
      return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
    }

    if (
      !consent.categories.eligibilityAndEnrollment ||
      !consent.categories.claimsAndAuthorizations ||
      !consent.categories.communications
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "minimum_consent_required: eligibility, claims/authorizations, and communications must be enabled",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const id = `scheme-app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const reference = `AMB-SCHEME-${new Date().getFullYear()}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`;

    const dependants = Array.isArray(body.dependants)
      ? body.dependants.slice(0, 12).map((d: any) => {
          const depId = clean(d.idNumber, 32);
          return {
            fullName: clean(d.fullName),
            relationship: clean(d.relationship),
            dob: clean(d.dob) || null,
            idNumberHash: depId ? hashIdNumber(depId) : null,
            idNumberLast4: depId ? depId.slice(-4) : null,
          };
        })
      : [];

    const item: SchemeApplication = {
      id,
      reference,
      status: "SUBMITTED",
      createdAt: now,
      updatedAt: now,

      patientId,
      userId: clean(body.userId) || null,

      sponsorType,
      sponsorId,
      sponsorName,
      planId,
      planName,

      applicant: {
        fullName,
        email,
        phone,
        dob: clean(body?.applicant?.dob) || null,
        idNumberHash: hashIdNumber(idNumber),
        idNumberLast4: idNumber.slice(-4),
        address: clean(body?.applicant?.address, 300) || null,
      },

      dependants,

      consent,

      profileContextSnapshot: {
        source: "patient_profile_prefill",
        patientId,
        generatedAt: now,
        declaredAllergies: Array.isArray(body?.profileContextSnapshot?.declaredAllergies)
          ? body.profileContextSnapshot.declaredAllergies.slice(0, 20).map((x: any) => clean(x))
          : [],
        declaredConditions: Array.isArray(body?.profileContextSnapshot?.declaredConditions)
          ? body.profileContextSnapshot.declaredConditions.slice(0, 20).map((x: any) => clean(x))
          : [],
      },

      exportPosture: {
        csvReady: true,
        apiReady: true,
        portalReady: true,
        switchReady: false,
        privateApiReady: false,
        lastExportedAt: null,
      },

      metadata: {
        source: "patient_join_scheme",
        channel: "patient_app",
        popia: true,
      },
    };

    const list = await readList();
    list.push(item);
    await writeList(list);

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "scheme_application_failed" },
      { status: 500 },
    );
  }
}