// apps/medreach/app/api/phlebs/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';

export type PhlebPreferences = {
  phlebId: string;
  avatarUrl?: string;
  contactPhone?: string;
  serviceAreas: string[];
  preferredLabIds: string[];
  vehicle: {
    make: string;
    model: string;
    registration: string;
    color?: string;
    type?: string;
    changePending?: boolean;
  };
};

const prefs: Record<string, PhlebPreferences> = {
  'thabo-m': {
    phlebId: 'thabo-m',
    avatarUrl: '',
    contactPhone: '+27 82 000 0000',
    serviceAreas: ['Randburg', 'Rosebank'],
    preferredLabIds: ['lancet-cresta'],
    vehicle: {
      make: 'Toyota',
      model: 'Etios',
      registration: 'XYZ 123 GP',
      color: 'White',
      type: 'Car',
      changePending: false,
    },
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phlebId = searchParams.get('phlebId');
  if (!phlebId) {
    return NextResponse.json({ error: 'Missing phlebId' }, { status: 400 });
  }

  if (!prefs[phlebId]) {
    prefs[phlebId] = {
      phlebId,
      serviceAreas: [],
      preferredLabIds: [],
      vehicle: {
        make: '',
        model: '',
        registration: '',
        changePending: false,
      },
    };
  }

  return NextResponse.json(prefs[phlebId]);
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as Partial<PhlebPreferences> & { phlebId?: string };
  const phlebId = body.phlebId;
  if (!phlebId) {
    return NextResponse.json({ error: 'Missing phlebId in body' }, { status: 400 });
  }

  if (!prefs[phlebId]) {
    prefs[phlebId] = {
      phlebId,
      serviceAreas: [],
      preferredLabIds: [],
      vehicle: {
        make: '',
        model: '',
        registration: '',
        changePending: false,
      },
    };
  }

  const current = prefs[phlebId];

  let vehicle = current.vehicle;
  if (body.vehicle) {
    vehicle = {
      ...vehicle,
      ...body.vehicle,
    };
    if (
      body.vehicle.make ||
      body.vehicle.model ||
      body.vehicle.registration ||
      body.vehicle.color ||
      body.vehicle.type
    ) {
      vehicle.changePending = true;
    }
  }

  prefs[phlebId] = {
    ...current,
    ...body,
    phlebId,
    vehicle,
    serviceAreas: body.serviceAreas ?? current.serviceAreas,
    preferredLabIds: body.preferredLabIds ?? current.preferredLabIds,
  };

  return NextResponse.json(prefs[phlebId]);
}
