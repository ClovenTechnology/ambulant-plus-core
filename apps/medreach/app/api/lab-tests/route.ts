// apps/medreach/app/api/lab-tests/route.ts
import { NextRequest, NextResponse } from 'next/server';

export type LabTest = {
  labId: string;
  code: string;
  name: string;
  category?: string;
  sampleType?: string;
  priceZAR: number;
  etaDays: number;
  instructions?: string;
  referenceRange?: string;
};

const store: Record<string, LabTest[]> = {};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const labId = searchParams.get('labId');
  if (!labId) {
    return NextResponse.json({ error: 'Missing labId' }, { status: 400 });
  }
  const tests = store[labId] || [];
  return NextResponse.json({ labId, tests });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<LabTest>;
  const labId = body.labId;
  if (!labId) {
    return NextResponse.json({ error: 'Missing labId' }, { status: 400 });
  }
  if (!store[labId]) store[labId] = [];

  const code = (body.code || '').trim();
  const name = (body.name || '').trim();
  if (!code || !name) {
    return NextResponse.json(
      { error: 'Missing code or name' },
      { status: 400 },
    );
  }

  const priceZAR = Number.isFinite(body.priceZAR)
    ? Number(body.priceZAR)
    : 0;
  const etaDays = Number.isFinite(body.etaDays)
    ? Number(body.etaDays)
    : 1;

  const existingIndex = store[labId].findIndex((t) => t.code === code);
  const payload: LabTest = {
    labId,
    code,
    name,
    category: body.category || '',
    sampleType: body.sampleType || '',
    priceZAR,
    etaDays,
    instructions: body.instructions || '',
    referenceRange: body.referenceRange || '',
  };

  if (existingIndex >= 0) {
    store[labId][existingIndex] = payload;
  } else {
    store[labId].push(payload);
  }

  return NextResponse.json({ labId, tests: store[labId] });
}
