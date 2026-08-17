import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/src/lib/prisma';
import {
  TrainingAdmissionError,
  verifyTrainingAdmissionToken,
} from '@/src/clinicians/onboarding/training-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OBSERVER_MIC = 'training:media:microphone';
const OBSERVER_CAMERA = 'training:media:camera';
const OBSERVER_CHAT = 'training:chat:write';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function livekitHttpUrl() {
  const raw = envFirst([
    'LIVEKIT_API_URL',
    'LIVEKIT_URL',
    'LIVEKIT_WS_URL',
    'LK_URL',
    'LK_WS_URL',
  ]).replace(/\/+$/, '');

  if (raw.startsWith('wss://')) return `https://${raw.slice(6)}`;
  if (raw.startsWith('ws://')) return `http://${raw.slice(5)}`;
  return raw;
}

function stringPermissions(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : [];
}

function capabilityPermission(capability: string) {
  if (capability === 'microphone') return OBSERVER_MIC;
  if (capability === 'camera') return OBSERVER_CAMERA;
  if (capability === 'chat') return OBSERVER_CHAT;
  return '';
}

function observerCapabilities(permissions: string[]) {
  return {
    microphone: permissions.includes(OBSERVER_MIC),
    camera: permissions.includes(OBSERVER_CAMERA),
    chat: permissions.includes(OBSERVER_CHAT),
  };
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

async function writeAudit(
  request: NextRequest,
  input: {
    actor: Awaited<ReturnType<typeof verifyTrainingAdmissionToken>>;
    action: string;
    description: string;
    meta?: Record<string, unknown>;
  },
) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.subjectId || null,
      actorType: 'ADMIN',
      actorRefId: input.actor.subjectId || input.actor.uid || null,
      app: 'api-gateway',
      action: input.action,
      entityType: 'ClinicianTrainingSlot',
      entityId: input.actor.trainingSlotId,
      description: input.description,
      ip: clientIp(request),
      userAgent: request.headers.get('user-agent'),
      meta: {
        roomId: input.actor.roomId,
        actorRole: input.actor.role,
        actorIdentity: input.actor.uid,
        ...(input.meta || {}),
      },
    },
  }).catch((error) => {
    console.warn('[training-collaboration] audit write failed', error);
  });
}

async function roomService() {
  const host = livekitHttpUrl();
  const apiKey = envFirst(['LIVEKIT_API_KEY', 'LK_API_KEY']);
  const apiSecret = envFirst(['LIVEKIT_API_SECRET', 'LK_API_SECRET']);

  if (!host || !apiKey || !apiSecret) {
    throw new TrainingAdmissionError('server_misconfig', 500);
  }

  const { RoomServiceClient } = await import('livekit-server-sdk');
  return new RoomServiceClient(host, apiKey, apiSecret);
}

async function broadcast(
  service: any,
  roomId: string,
  topic: 'chat' | 'control',
  payload: Record<string, unknown>,
) {
  await service.sendData(
    roomId,
    new TextEncoder().encode(JSON.stringify(payload)),
    0 as any,
    { topic },
  );
}

function isModerator(role: string) {
  return role === 'admin' || role === 'trainer';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const token = clean(
      request.headers.get('x-join-token') ||
      body?.joinToken ||
      body?.moderatorToken,
      12000,
    );
    const roomId = clean(body?.roomId || body?.room, 400);
    const action = clean(body?.action, 80);

    if (!token) {
      return json({ ok: false, error: 'training_admission_required' }, 401);
    }

    if (!roomId) {
      return json({ ok: false, error: 'roomId_required' }, 400);
    }

    const actor = await verifyTrainingAdmissionToken(token, roomId);
    const service = await roomService();

    if (action === 'chat.send') {
      const text = clean(body?.text, 1200);
      if (!text) {
        return json({ ok: false, error: 'chat_text_required' }, 400);
      }

      const permissions = stringPermissions(actor.permissions);
      if (actor.role === 'observer' && !permissions.includes(OBSERVER_CHAT)) {
        return json({ ok: false, error: 'observer_chat_write_not_enabled' }, 403);
      }

      const message = {
        id: `training-chat-${randomUUID()}`,
        text,
        sentAt: new Date().toISOString(),
        participantIdentity: actor.uid,
        displayName: actor.displayName,
        participantRole: actor.role,
        serverAuthorised: true,
      };

      await broadcast(service, actor.roomId, 'chat', message);

      return json({ ok: true, message });
    }

    if (action === 'hand.set') {
      const raised = Boolean(body?.raised);
      const control = {
        type: 'raise_hand',
        value: raised,
        participantIdentity: actor.uid,
        targetIdentity: actor.uid,
        displayName: actor.displayName,
        participantRole: actor.role,
        ts: Date.now(),
        serverAuthorised: true,
      };

      await broadcast(service, actor.roomId, 'control', control);

      return json({ ok: true, raised });
    }

    if (action === 'hand.lower') {
      if (!isModerator(actor.role)) {
        return json({ ok: false, error: 'training_moderator_required' }, 403);
      }

      const targetIdentity = clean(body?.targetIdentity, 400);
      if (!targetIdentity) {
        return json({ ok: false, error: 'targetIdentity_required' }, 400);
      }

      const target = await service.getParticipant(actor.roomId, targetIdentity).catch(() => null);
      if (!target) {
        return json({ ok: false, error: 'training_participant_not_found' }, 404);
      }

      await broadcast(service, actor.roomId, 'control', {
        type: 'raise_hand',
        value: false,
        participantIdentity: targetIdentity,
        targetIdentity,
        displayName: target.name || targetIdentity,
        ts: Date.now(),
        moderatedBy: actor.uid,
        serverAuthorised: true,
      });

      await writeAudit(request, {
        actor,
        action: 'training.participant.hand_lowered',
        description: 'Lowered a training participant hand raise',
        meta: { targetIdentity },
      });

      return json({ ok: true, targetIdentity, raised: false });
    }

    if (action === 'capability.set') {
      if (!isModerator(actor.role)) {
        return json({ ok: false, error: 'training_moderator_required' }, 403);
      }

      const targetIdentity = clean(body?.targetIdentity, 400);
      const capability = clean(body?.capability, 80).toLowerCase();
      const enabled = Boolean(body?.enabled);
      const permissionName = capabilityPermission(capability);

      if (!targetIdentity || !permissionName) {
        return json({ ok: false, error: 'valid_target_and_capability_required' }, 400);
      }

      const participant = await service.getParticipant(actor.roomId, targetIdentity).catch(() => null);
      if (!participant) {
        return json({ ok: false, error: 'training_participant_not_found' }, 404);
      }

      let metadata: any = {};
      try {
        metadata = JSON.parse(String(participant.metadata || '{}'));
      } catch {
        metadata = {};
      }

      const admissionId = clean(metadata?.admissionId, 240);
      if (!admissionId) {
        return json({ ok: false, error: 'training_target_admission_missing' }, 409);
      }

      const db: any = prisma;
      const targetAdmission = await db.clinicianTrainingAdmission.findUnique({
        where: { id: admissionId },
      });

      if (
        !targetAdmission ||
        targetAdmission.revokedAt ||
        new Date(targetAdmission.expiresAt) <= new Date() ||
        String(targetAdmission.trainingSlotId) !== actor.trainingSlotId ||
        String(targetAdmission.uid) !== targetIdentity ||
        String(targetAdmission.role) !== 'observer'
      ) {
        return json({ ok: false, error: 'active_training_observer_required' }, 409);
      }

      const previousPermissions = stringPermissions(targetAdmission.permissions);
      const nextSet = new Set(previousPermissions);
      if (enabled) nextSet.add(permissionName);
      else nextSet.delete(permissionName);
      const nextPermissions = Array.from(nextSet);
      const capabilities = observerCapabilities(nextPermissions);
      const publishSources = [
        ...(capabilities.camera ? [1] : []),
        ...(capabilities.microphone ? [2] : []),
      ];

      await db.clinicianTrainingAdmission.update({
        where: { id: admissionId },
        data: { permissions: nextPermissions },
      });

      try {
        await service.updateParticipant(actor.roomId, targetIdentity, {
          permission: {
            canSubscribe: true,
            canPublish: publishSources.length > 0,
            canPublishData: false,
            canPublishSources: publishSources as any,
          },
          attributes: {
            trainingMediaMicrophone: capabilities.microphone ? '1' : '0',
            trainingMediaCamera: capabilities.camera ? '1' : '0',
            trainingChatWrite: capabilities.chat ? '1' : '0',
          },
        });
      } catch (error) {
        await db.clinicianTrainingAdmission.update({
          where: { id: admissionId },
          data: { permissions: previousPermissions },
        }).catch(() => undefined);
        throw error;
      }

      await broadcast(service, actor.roomId, 'control', {
        type: 'training_capability',
        targetIdentity,
        capability,
        enabled,
        capabilities,
        ts: Date.now(),
        moderatedBy: actor.uid,
        serverAuthorised: true,
      }).catch((error: unknown) => {
        console.warn('[training-collaboration] capability broadcast failed', error);
      });

      await writeAudit(request, {
        actor,
        action: enabled
          ? 'training.observer.capability_granted'
          : 'training.observer.capability_revoked',
        description: enabled
          ? `Granted observer ${capability} capability`
          : `Revoked observer ${capability} capability`,
        meta: {
          targetIdentity,
          targetAdmissionId: admissionId,
          capability,
          enabled,
        },
      });

      return json({
        ok: true,
        targetIdentity,
        capability,
        enabled,
        capabilities,
      });
    }

    return json({ ok: false, error: 'unsupported_training_collaboration_action' }, 400);
  } catch (error: any) {
    if (error instanceof TrainingAdmissionError) {
      return json(
        { ok: false, error: error.code, ...(error.details || {}) },
        error.status,
      );
    }

    console.error('[training-collaboration] failed', error);
    return json({ ok: false, error: 'training_collaboration_failed' }, 500);
  }
}
