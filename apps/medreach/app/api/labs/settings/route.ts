// apps/medreach/app/api/labs/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';

export type LabSettings = {
  labId: string;
  name: string;
  primaryPhone?: string;
  additionalPhones?: string[];
  primaryEmail?: string;
  additionalEmails?: string[];
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  logoUrl?: string;
};

const store: Record<string, LabSettings> = {};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const labId = searchParams.get('labId');
  if (!labId) {
    return NextResponse.json({ error: 'Missing labId' }, { status: 400 });
  }

  if (!store[labId]) {
    store[labId] = {
      labId,
      name: labId
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
    };
  }

  return NextResponse.json(store[labId]);
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as Partial<LabSettings> & { labId?: string };
  const labId = body.labId;
  if (!labId) {
    return NextResponse.json({ error: 'Missing labId in body' }, { status: 400 });
  }

  if (!store[labId]) {
    store[labId] = {
      labId,
      name: labId
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
    };
  }

  store[labId] = {
    ...store[labId],
    ...body,
    labId,
  };

  return NextResponse.json(store[labId]);
}
