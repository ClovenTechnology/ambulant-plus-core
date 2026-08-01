import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  TrainingAdmissionError,
  verifyTrainingAdmissionToken,
} from '@/src/clinicians/onboarding/training-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return '';
}

function httpLiveKitUrl(value: string) {
  if (value.startsWith('wss://')) return `https://${value.slice('wss://'.length)}`;
  if (value.startsWith('ws://')) return `http://${value.slice('ws://'.length)}`;
  return value;
}

function isAudioTrack(track: any) {
  const type = String(track?.type ?? '').toLowerCase();
  const source = String(track?.source ?? '').toLowerCase();
  return track?.type === 0 || type === 'audio' || type === '0' || source.includes('microphone');
}

async function roomService() {
  const apiKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const apiSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);
  const url = httpLiveKitUrl(envFirst([
    'LIVEKIT_API_URL',
    'LIVEKIT_WS_URL',
    'LIVEKIT_URL',
    'LK_URL',
    'LK_WS_URL',
  ]));

  if (!apiKey || !apiSecret || !url) {
    throw new Error('livekit_server_misconfigured');
  }

  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(url, apiKey, apiSecret);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const token = clean(
      request.headers.get('x-join-token') ||
      body.moderatorToken ||
      body.joinToken,
      12000,
    );
    const roomId = clean(body.roomId, 400) || null;
    const actor = await verifyTrainingAdmissionToken(token, roomId);

    if (actor.role !== 'admin' && actor.role !== 'trainer') {
      return json({ ok: false, error: 'training_moderator_required' }, 403);
    }

    const targetIdentity = clean(body.targetIdentity || body.identity, 400);
    const muteAll = body.muteAll === true || clean(body.scope, 40).toLowerCase() === 'all';

    if (!muteAll && !targetIdentity) {
      return json({ ok: false, error: 'targetIdentity_or_muteAll_required' }, 400);
    }

    const service = await roomService();
    const listed: any = await service.listParticipants(actor.roomId);
    const participants: any[] = Array.isArray(listed)
      ? listed
      : Array.isArray(listed?.participants)
        ? listed.participants
        : [];
    const selected = participants.filter((participant) => {
      const identity = clean(participant?.identity, 400);
      if (!identity || identity === actor.uid) return false;
      return muteAll || identity === targetIdentity;
    });

    if (!muteAll && selected.length === 0) {
      return json({ ok: false, error: 'training_participant_not_found' }, 404);
    }

    const muted: Array<{ identity: string; trackSid: string }> = [];
    const failures: Array<{ identity: string; trackSid?: string; error: string }> = [];

    for (const participant of selected) {
      const identity = clean(participant?.identity, 400);
      const tracks = Array.isArray(participant?.tracks) ? participant.tracks : [];

      for (const track of tracks.filter(isAudioTrack)) {
        const trackSid = clean(track?.sid || track?.trackSid, 400);
        if (!trackSid || track?.muted === true) continue;

        try {
          await service.mutePublishedTrack(actor.roomId, identity, trackSid, true);
          muted.push({ identity, trackSid });
        } catch (error: any) {
          failures.push({
            identity,
            trackSid,
            error: clean(error?.message || 'mute_failed', 500),
          });
        }
      }
    }

    try {
      const db: any = prisma;
      await db.auditLog.create({
        data: {
          actorUserId: actor.uid,
          actorType: 'ADMIN',
          actorRefId: actor.subjectId,
          app: 'training-room',
          action: muteAll ? 'training.participants.mute_all' : 'training.participant.mute',
          entityType: 'ClinicianTrainingSlot',
          entityId: actor.trainingSlotId,
          description: muteAll ? 'Muted all training participant microphones' : 'Muted a training participant microphone',
          userAgent: request.headers.get('user-agent'),
          meta: {
            roomId: actor.roomId,
            targetIdentity: targetIdentity || null,
            muted,
            failures,
          },
        },
      });
    } catch (error) {
      console.warn('[training-moderation-mute] audit failed', error);
    }

    return json({
      ok: failures.length === 0,
      roomId: actor.roomId,
      muteAll,
      targetIdentity: targetIdentity || null,
      muted,
      failures,
      note: 'Remote unmute is intentionally not permitted; participants must unmute themselves.',
    }, failures.length > 0 && muted.length === 0 ? 502 : 200);
  } catch (error) {
    if (error instanceof TrainingAdmissionError) {
      return json({ ok: false, error: error.code, ...(error.details || {}) }, error.status);
    }

    console.error('[training-moderation-mute] failed', error);
    return json({ ok: false, error: 'training_mute_failed' }, 500);
  }
}