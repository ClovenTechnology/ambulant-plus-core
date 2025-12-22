import { NextRequest, NextResponse } from 'next/server';
import { LABS } from '../../jobs/data';

export async function GET(
  _req: NextRequest,
  { params }: { params: { labId: string } }
) {
  const lab = LABS.find((l) => l.id === params.labId);
  if (!lab) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ lab });
}
