import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { favsStore } from '@/lib/favsStore';

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ ids: [] }, { status: 200 }); // guest gets empty (client will fall back)
  const ids = await favsStore.list(userId);
  return NextResponse.json({ ids });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await favsStore.add(userId, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await favsStore.remove(userId, id);
  return NextResponse.json({ ok: true });
}
