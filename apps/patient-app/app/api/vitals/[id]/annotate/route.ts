// apps/patient-app/app/api/vitals/[id]/annotate/route.ts
import { NextResponse } from 'next/server';
import { addAnnotation } from '../../_lib/broadcaster';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ ok: false, error: 'text required' }, { status: 400 });
    const note = addAnnotation(params.id, text);
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
