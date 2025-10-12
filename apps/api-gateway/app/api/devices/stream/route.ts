import { NextRequest, NextResponse } from 'next/server';


export const dynamic = 'force-dynamic';


// Returns console URL based on modality.
// Body: { deviceId, catalogSlug, mode? }
export async function POST(req: NextRequest) {
const b = await req.json().catch(() => ({}));
if (!b?.catalogSlug) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });


const slug: string = b.catalogSlug;
let consoleMode = 'generic';
if (slug.includes('stethoscope')) consoleMode = 'stethoscope';
else if (slug.includes('otoscope')) consoleMode = 'otoscope';
else if (slug.includes('health-monitor')) consoleMode = 'health';
else if (slug.includes('nexring')) consoleMode = 'ring';


const url = `/myCare/devices/console?deviceId=${encodeURIComponent(b.deviceId ?? '')}&mode=${consoleMode}&catalog=${encodeURIComponent(slug)}`;
return NextResponse.json({ url });
}