import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type StaffNotificationInput = {
  recipientProfileId: string;
  actorProfileId?: string | null;
  conversationId?: string | null;
  meetingId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  payload?: Prisma.InputJsonValue | null;
  dedupeKey?: string | null;
};

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function staffNotificationData(input: StaffNotificationInput) {
  return {
    recipientProfileId: clean(input.recipientProfileId, 160),
    actorProfileId: clean(input.actorProfileId, 160) || null,
    conversationId: clean(input.conversationId, 160) || null,
    meetingId: clean(input.meetingId, 160) || null,
    type: clean(input.type, 80),
    title: clean(input.title, 240),
    body: clean(input.body, 1000) || null,
    payload: input.payload ?? undefined,
    dedupeKey: clean(input.dedupeKey, 240) || null,
  };
}

export async function createStaffNotification(
  tx: Prisma.TransactionClient | typeof prisma,
  input: StaffNotificationInput,
) {
  const data = staffNotificationData(input);
  if (!data.recipientProfileId || !data.type || !data.title) return null;

  if (data.dedupeKey) {
    return (tx as any).staffNotification.upsert({
      where: { dedupeKey: data.dedupeKey },
      update: {
        title: data.title,
        body: data.body,
        payload: data.payload,
        dismissedAt: null,
      },
      create: data,
    });
  }

  return (tx as any).staffNotification.create({ data });
}

export async function listStaffNotifications(profileId: string, limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 50)));
  return prisma.staffNotification.findMany({
    where: {
      recipientProfileId: profileId,
      dismissedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
    include: {
      actorProfile: {
        select: { id: true, name: true, email: true, photoUrl: true },
      },
    },
  });
}

export async function markStaffNotifications(input: {
  profileId: string;
  ids?: string[];
  read?: boolean;
  dismissed?: boolean;
}) {
  const ids = Array.from(
    new Set((input.ids || []).map((value) => clean(value, 160)).filter(Boolean)),
  ).slice(0, 100);

  const where: any = {
    recipientProfileId: input.profileId,
    ...(ids.length ? { id: { in: ids } } : {}),
  };

  const now = new Date();
  const data: any = {};
  if (input.read !== undefined) data.readAt = input.read ? now : null;
  if (input.dismissed !== undefined) data.dismissedAt = input.dismissed ? now : null;
  if (!Object.keys(data).length) return { count: 0 };

  return prisma.staffNotification.updateMany({ where, data });
}
