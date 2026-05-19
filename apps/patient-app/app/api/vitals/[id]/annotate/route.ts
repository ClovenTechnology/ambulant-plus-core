// apps/patient-app/app/api/vitals/[id]/annotate/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type VitalAnnotation = {
  id: string;
  vitalId: string;
  text: string;
  createdAt: string;
};

const globalForVitalAnnotations = globalThis as typeof globalThis & {
  __ambulantVitalAnnotations?: Map<string, VitalAnnotation[]>;
};

const vitalAnnotations =
  globalForVitalAnnotations.__ambulantVitalAnnotations ??
  (globalForVitalAnnotations.__ambulantVitalAnnotations = new Map<string, VitalAnnotation[]>());

function addAnnotation(vitalId: string, text: string): VitalAnnotation {
  const note: VitalAnnotation = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    vitalId,
    text,
    createdAt: new Date().toISOString(),
  };

  const existing = vitalAnnotations.get(vitalId) ?? [];
  vitalAnnotations.set(vitalId, [note, ...existing].slice(0, 50));

  return note;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const vitalId = String(params?.id || '').trim();

  if (!vitalId) {
    return NextResponse.json(
      { ok: false, error: 'vital id required' },
      { status: 400 },
    );
  }

  let body: unknown = null;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const rawText =
    typeof (body as { text?: unknown })?.text === 'string'
      ? (body as { text: string }).text
      : '';

  const text = rawText.trim();

  if (!text) {
    return NextResponse.json(
      { ok: false, error: 'text required' },
      { status: 400 },
    );
  }

  const safeText = text.slice(0, 500);

  try {
    const note = addAnnotation(vitalId, safeText);

    return NextResponse.json(
      { ok: true, note },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add annotation';

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
