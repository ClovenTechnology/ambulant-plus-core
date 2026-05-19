import { NextRequest } from 'next/server';
import { jsonErr, jsonOk, mapLadyNote, resolveLadyPatientContext } from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const rows = await ctx.prisma.ladyCenterNote.findMany({
    where: { patientId: ctx.patientId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return jsonOk({ items: rows.map(mapLadyNote) });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const note = body?.note;

  if (!note?.text || !String(note.text).trim()) {
    return jsonErr('Note text is required.', 400, 'missing_text');
  }

  const row = await ctx.prisma.ladyCenterNote.create({
    data: {
      patientId: ctx.patientId,
      id: note.id || undefined,
      text: String(note.text).trim(),
      createdISO: note.createdISO ? new Date(note.createdISO) : new Date(),
    },
  });

  return jsonOk({ item: mapLadyNote(row) }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (!id) return jsonErr('Missing note id.', 400, 'missing_id');

  await ctx.prisma.ladyCenterNote.deleteMany({
    where: {
      id,
      patientId: ctx.patientId,
    },
  });

  return jsonOk({ id });
}