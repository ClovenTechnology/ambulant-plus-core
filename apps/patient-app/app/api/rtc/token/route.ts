import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

async function createToken(room: string, user: string) {
  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
  const now = Math.floor(Date.now() / 1000);
  const payload: any = {
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true },
    sub: user,
    iss: apiKey,
    nbf: now,
    exp: now + 3600,
  };
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(apiSecret));
}

export async function POST(req: NextRequest) {
  try {
    const { roomId, room, user, identity } = await req.json();
    const token = await createToken(roomId || room || 'room-1001', identity || user || 'guest');
    return Response.json({ token });
  } catch (e) {
    console.error('Token POST error', e);
    return new Response('Token generation failed', { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const room = searchParams.get('room') || 'room-1001';
    const user = searchParams.get('user') || 'guest';
    const token = await createToken(room, user);
    return Response.json({ token });
  } catch (e) {
    console.error('Token GET error', e);
    return new Response('Token generation failed', { status: 500 });
  }
}
