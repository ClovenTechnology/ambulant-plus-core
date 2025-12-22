// apps/medreach/app/api/phleb-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';

export type PhlebProfile = {
  id: string;
  fullName: string;
  dob: string;
  gender: string;
  email: string;
  primaryQualification: string;
  additionalQualifications?: string;
  profileImageUrl?: string;
  phone: string;
  address: string;
  serviceAreas: string[];
  preferredLabs: string[];
  vehicle: {
    make: string;
    model?: string;
    regNumber: string;
    color?: string;
    type?: string;
  };
  payoutDetails: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    branchCode?: string;
    payoutMethod?: string; // e.g. EFT, wallet
  };
};

// Simple in-memory mock storage (persists for life of the dev server)
const mockProfiles: Record<string, PhlebProfile> = {
  'thabo-m': {
    id: 'thabo-m',
    fullName: 'Thabo Mokoena',
    dob: '1990-05-12',
    gender: 'male',
    email: 'thabo@example.com',
    primaryQualification: 'Enrolled Nurse',
    additionalQualifications: 'Advanced Phlebotomy Certificate',
    profileImageUrl: '',
    phone: '+27 82 000 0001',
    address: '12 Oak Street, Randburg',
    serviceAreas: ['Randburg', 'Rosebank'],
    preferredLabs: ['lancet-cresta'],
    vehicle: {
      make: 'Toyota',
      model: 'Yaris',
      regNumber: 'HX 12 AB GP',
      color: 'White',
      type: 'Hatchback',
    },
    payoutDetails: {
      accountName: 'T Mokoena',
      bankName: 'FNB',
      accountNumber: '123456789',
      branchCode: '250655',
      payoutMethod: 'EFT',
    },
  },
};

function getGatewayBase() {
  return process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL || null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phlebId = searchParams.get('phlebId');
  if (!phlebId) {
    return NextResponse.json(
      { error: 'Missing phlebId' },
      { status: 400 },
    );
  }

  const gatewayBase = getGatewayBase();
  if (gatewayBase) {
    try {
      const url = new URL(`/medreach/phlebs/${encodeURIComponent(phlebId)}/profile`, gatewayBase);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
      console.error('Gateway profile GET failed:', res.status);
    } catch (e) {
      console.error('Gateway profile GET error:', e);
    }
  }

  const profile =
    mockProfiles[phlebId] ||
    ({
      id: phlebId,
      fullName: 'Unknown Phleb',
      dob: '',
      gender: '',
      email: '',
      primaryQualification: '',
      additionalQualifications: '',
      profileImageUrl: '',
      phone: '',
      address: '',
      serviceAreas: [],
      preferredLabs: [],
      vehicle: {
        make: '',
        model: '',
        regNumber: '',
        color: '',
        type: '',
      },
      payoutDetails: {
        accountName: '',
        bankName: '',
        accountNumber: '',
        branchCode: '',
        payoutMethod: 'EFT',
      },
    } as PhlebProfile);

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phlebId = searchParams.get('phlebId');
  if (!phlebId) {
    return NextResponse.json(
      { error: 'Missing phlebId' },
      { status: 400 },
    );
  }

  let body: Partial<PhlebProfile>;
  try {
    body = (await req.json()) as Partial<PhlebProfile>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Merge into mock storage
  const existing = mockProfiles[phlebId] || (await (async () => {
    const res = await GET(req);
    const data = (await res.json()) as PhlebProfile;
    return data;
  })());

  const updated: PhlebProfile = {
    ...existing,
    // Read-only fields (from onboarding) are preserved intentionally
    profileImageUrl: body.profileImageUrl ?? existing.profileImageUrl,
    phone: body.phone ?? existing.phone,
    address: body.address ?? existing.address,
    serviceAreas: body.serviceAreas ?? existing.serviceAreas,
    preferredLabs: body.preferredLabs ?? existing.preferredLabs,
    vehicle: {
      ...existing.vehicle,
      ...(body.vehicle || {}),
    },
    payoutDetails: {
      ...existing.payoutDetails,
      ...(body.payoutDetails || {}),
    },
    additionalQualifications:
      body.additionalQualifications ?? existing.additionalQualifications,
  };

  mockProfiles[phlebId] = updated;

  const gatewayBase = getGatewayBase();
  if (gatewayBase) {
    try {
      const url = new URL(`/medreach/phlebs/${encodeURIComponent(phlebId)}/profile`, gatewayBase);
      await fetch(url.toString(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => {
        console.error('Gateway profile PUT error:', e);
      });
    } catch (e) {
      console.error('Gateway profile PUT exception:', e);
    }
  }

  return NextResponse.json(updated);
}
