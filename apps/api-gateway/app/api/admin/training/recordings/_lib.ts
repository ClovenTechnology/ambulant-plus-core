import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function cors(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const allowed = (process.env.ADMIN_CORS_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const allowOrigin = allowed.length === 0 ? origin || '*' : allowed.includes(origin) ? origin : '';
  const h = new Headers();

  if (allowOrigin) h.set('access-control-allow-origin', allowOrigin);
  if (allowed.length > 0) h.set('vary', 'Origin');

  h.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  h.set('access-control-allow-headers', 'content-type, x-admin-key');
  h.set('cache-control', 'no-store');

  return h;
}

export function json(req: NextRequest, body: any, status = 200) {
  return NextResponse.json(body, { status, headers: cors(req) });
}

export function requireRecordingAdmin(req: NextRequest) {
  const expected =
    process.env.TRAINING_RECORDING_ADMIN_KEY ||
    process.env.ADMIN_API_KEY ||
    process.env.AUTH_API_KEY ||
    '';

  const got = req.headers.get('x-admin-key') || '';

  if (!expected || got !== expected) {
    throw new Error('forbidden_recording_admin_key');
  }
}

export function envFirst(names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

export function toHttpUrl(raw: string) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.startsWith('wss://')) return 'https://' + v.slice('wss://'.length);
  if (v.startsWith('ws://')) return 'http://' + v.slice('ws://'.length);
  return v;
}

export function requiredEnv(name: string, fallbackNames: string[] = []) {
  const v = envFirst([name, ...fallbackNames]);
  if (!v) throw new Error('missing_env_' + name);
  return v;
}

export async function egressClient() {
  const { EgressClient } = await import('livekit-server-sdk');

  const url = toHttpUrl(
    requiredEnv('LIVEKIT_API_URL', ['LIVEKIT_URL', 'LIVEKIT_WS_URL', 'LK_URL', 'LK_WS_URL']),
  );

  const key = requiredEnv('LIVEKIT_API_KEY', ['LK_API_KEY']);
  const secret = requiredEnv('LIVEKIT_API_SECRET', ['LK_API_SECRET']);

  return new EgressClient(url, key, secret);
}

export function safeRoomId(v: unknown) {
  const roomId = String(v || '').trim();
  if (!roomId) throw new Error('missing_room_id');
  if (!/^[A-Za-z0-9._:@%+\-=]{3,160}$/.test(roomId)) {
    throw new Error('invalid_room_id');
  }
  return roomId;
}

export function s3UploadConfig() {
  return {
    accessKey: requiredEnv('AWS_ACCESS_KEY_ID'),
    secret: requiredEnv('AWS_SECRET_ACCESS_KEY'),
    bucket: requiredEnv('TRAINING_RECORDINGS_S3_BUCKET'),
    region: requiredEnv('TRAINING_RECORDINGS_S3_REGION', ['AWS_REGION', 'AWS_DEFAULT_REGION']),
    forcePathStyle: false,
  };
}

export function recordingPrefix(roomId: string) {
  const prefix = envFirst(['TRAINING_RECORDINGS_S3_PREFIX']) || 'training-recordings';
  const cleanRoom = roomId.replace(/[^A-Za-z0-9._-]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  return prefix.replace(/\/+$/, '') + '/' + cleanRoom + '/' + stamp;
}

export function errorStatus(message: string) {
  if (message.includes('forbidden')) return 403;
  if (message.includes('missing_') || message.includes('invalid_')) return 400;
  return 500;
}
