import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyLegacyAdminSessionToken } from '@/src/lib/admin-session-compat';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import { hasStaffCapability, staffPresenceTtlMs } from '@/src/lib/admin-staff-policy';

const MAX_PATH = 500;
const MAX_ACTIVE_DELTA_SECONDS = 30;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export class StaffActivityError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StaffActivityError';
    this.status = status;
  }
}

function cleanPath(value: unknown) {
  const raw = String(value || '').trim().slice(0, MAX_PATH);
  if (!raw || !raw.startsWith('/')) return '/';
  return raw.replace(/[?#].*$/, '').slice(0, MAX_PATH) || '/';
}

function activeSeconds(value: unknown) {
  const seconds = Math.floor(Number(value) || 0);
  return Math.min(MAX_ACTIVE_DELTA_SECONDS, Math.max(0, seconds));
}

function sessionIdFromRequest(request: NextRequest) {
  const token = request.cookies.get('adm.profile')?.value;
  const session = verifyLegacyAdminSessionToken(token);
  const sessionId = String(session?.sessionId || '').trim();
  if (!session || !sessionId) {
    throw new StaffActivityError('staff_activity_session_required', 401);
  }
  return sessionId;
}

export async function recordStaffActivity(input: {
  request: NextRequest;
  actor: AdminStaffActor;
  body: any;
}) {
  const sessionId = sessionIdFromRequest(input.request);
  const event = String(input.body?.event || 'heartbeat').trim().toLowerCase();
  if (!['page_view', 'heartbeat', 'leave'].includes(event)) {
    throw new StaffActivityError('staff_activity_event_invalid', 400);
  }

  const path = cleanPath(input.body?.path);
  const delta = activeSeconds(input.body?.activeSeconds);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + staffPresenceTtlMs());
  const [liveMeeting, ringingCall] = event === 'leave'
    ? [null, null]
    : await Promise.all([
        prisma.meeting.findFirst({
          where: {
            state: 'LIVE',
            participants: { some: { staffProfileId: input.actor.profileId, state: 'JOINED' } },
          },
          select: { id: true },
        }),
        prisma.meeting.findFirst({
          where: {
            kind: 'DIRECT_CALL',
            state: 'RINGING',
            participants: { some: { staffProfileId: input.actor.profileId, state: 'JOINED' } },
          },
          select: { id: true },
        }),
      ]);
  const activeDirectCall = await prisma.meeting.findFirst({
    where: {
      kind: 'DIRECT_CALL',
      OR: [
        { state: 'LIVE' },
        {
          state: 'RINGING',
          OR: [
            { ringExpiresAt: null },
            { ringExpiresAt: { gt: new Date() } },
          ],
        },
      ],
      participants: {
        some: {
          staffProfileId: input.actor.profileId,
          state: { in: ['INVITED', 'ACCEPTED', 'JOINED'] },
        },
      },
    },
    select: { id: true },
  });

  const presenceState =
    activeDirectCall || ringingCall
      ? 'BUSY'
      : liveMeeting
        ? 'IN_MEETING'
        : 'AVAILABLE';

  await prisma.$transaction(async (tx) => {
    await tx.adminStaffSession.upsert({
      where: { id: sessionId },
      update: {
        lastHeartbeatAt: now,
        lastPath: path,
        activeSeconds: { increment: delta },
        ...(event === 'leave' ? { endedAt: now } : { endedAt: null }),
      },
      create: {
        id: sessionId,
        staffProfileId: input.actor.profileId,
        userId: input.actor.userId,
        loginAt: now,
        lastHeartbeatAt: now,
        lastPath: path,
        activeSeconds: delta,
        userAgent: input.request.headers.get('user-agent') || null,
        endedAt: event === 'leave' ? now : null,
      },
    });

    await tx.adminStaffPageActivity.upsert({
      where: {
        sessionId_path: { sessionId, path },
      },
      update: {
        lastSeenAt: now,
        activeSeconds: { increment: delta },
        ...(event === 'page_view' ? { visitCount: { increment: 1 } } : {}),
      },
      create: {
        sessionId,
        staffProfileId: input.actor.profileId,
        path,
        firstSeenAt: now,
        lastSeenAt: now,
        visitCount: 1,
        activeSeconds: delta,
      },
    });

    await tx.adminUserProfile.update({
      where: { id: input.actor.profileId },
      data: { lastActivityAt: now },
    });

    if (event !== 'leave') {
      await tx.adminStaffPresence.upsert({
        where: { staffProfileId: input.actor.profileId },
        update: {
          state: presenceState,
          lastHeartbeatAt: now,
          expiresAt,
          updatedByUserId: input.actor.userId,
        },
        create: {
          staffProfileId: input.actor.profileId,
          state: presenceState,
          lastHeartbeatAt: now,
          expiresAt,
          updatedByUserId: input.actor.userId,
        },
      });
    }
  });

  return { ok: true, sessionId, recordedAt: now.toISOString() };
}

const ACTIVITY_TIMEZONE = 'Africa/Johannesburg';
const activityDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ACTIVITY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateKey(date: Date) {
  const parts = activityDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
}

function effectiveSessionEnd(row: { endedAt: Date | null; lastHeartbeatAt: Date }, now: Date) {
  if (row.endedAt) return row.endedAt;
  const staleBoundary = new Date(row.lastHeartbeatAt.getTime() + 90_000);
  return staleBoundary.getTime() < now.getTime() ? staleBoundary : now;
}

export async function staffActivityAnalytics(input: {
  actor: AdminStaffActor;
  staffProfileId: string;
  days?: unknown;
}) {
  const self = input.actor.profileId === input.staffProfileId;
  const canManage = hasStaffCapability(input.actor, 'staff.manage');
  const canReadAudit = input.actor.isSuperAdmin || canManage || input.actor.scopes.includes('compliance.audit.read');
  if (!self && !canReadAudit) {
    throw new StaffActivityError('staff_activity_access_denied', 403);
  }

  const days = Math.min(MAX_DAYS, Math.max(1, Math.floor(Number(input.days) || DEFAULT_DAYS)));
  const now = new Date();
  // Query one full extra day so the Johannesburg day boundary is never clipped by UTC.
  const since = new Date(now.getTime() - days * 86_400_000);

  const [profile, sessions, pages] = await Promise.all([
    prisma.adminUserProfile.findUnique({
      where: { id: input.staffProfileId },
      select: { id: true, name: true, email: true, lastActivityAt: true },
    }),
    prisma.adminStaffSession.findMany({
      where: { staffProfileId: input.staffProfileId, loginAt: { gte: since } },
      orderBy: { loginAt: 'desc' },
      select: {
        id: true,
        loginAt: true,
        lastHeartbeatAt: true,
        endedAt: true,
        activeSeconds: true,
        lastPath: true,
      },
    }),
    prisma.adminStaffPageActivity.findMany({
      where: { staffProfileId: input.staffProfileId, lastSeenAt: { gte: since } },
      orderBy: { activeSeconds: 'desc' },
      select: {
        path: true,
        visitCount: true,
        activeSeconds: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    }),
  ]);

  if (!profile) throw new StaffActivityError('staff_not_found', 404);

  const dailyMap = new Map<string, { date: string; logins: number; activeSeconds: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 86_400_000);
    const key = dateKey(day);
    dailyMap.set(key, { date: key, logins: 0, activeSeconds: 0 });
  }

  const serializedSessions = sessions.map((session) => {
    const end = effectiveSessionEnd(session, now);
    const wallSeconds = Math.max(0, Math.floor((end.getTime() - session.loginAt.getTime()) / 1000));
    const active = Math.min(Math.max(0, session.activeSeconds), wallSeconds || session.activeSeconds);
    const key = dateKey(session.loginAt);
    const day = dailyMap.get(key);
    if (day) {
      day.logins += 1;
      day.activeSeconds += active;
    }
    return {
      ...session,
      effectiveEndedAt: end,
      wallSeconds,
      activeSeconds: active,
      active: !session.endedAt && now.getTime() - session.lastHeartbeatAt.getTime() <= 90_000,
    };
  });

  const pageMap = new Map<string, { path: string; visits: number; activeSeconds: number; firstSeenAt: Date; lastSeenAt: Date }>();
  for (const page of pages) {
    const current = pageMap.get(page.path);
    if (current) {
      current.visits += page.visitCount;
      current.activeSeconds += page.activeSeconds;
      if (page.firstSeenAt < current.firstSeenAt) current.firstSeenAt = page.firstSeenAt;
      if (page.lastSeenAt > current.lastSeenAt) current.lastSeenAt = page.lastSeenAt;
    } else {
      pageMap.set(page.path, {
        path: page.path,
        visits: page.visitCount,
        activeSeconds: page.activeSeconds,
        firstSeenAt: page.firstSeenAt,
        lastSeenAt: page.lastSeenAt,
      });
    }
  }

  const topPages = Array.from(pageMap.values())
    .sort((a, b) => b.activeSeconds - a.activeSeconds || b.visits - a.visits)
    .slice(0, 10)
    .map((page) => ({
      ...page,
      averageSecondsPerVisit: page.visits ? Math.round(page.activeSeconds / page.visits) : 0,
    }));

  const totalActiveSeconds = serializedSessions.reduce((sum, row) => sum + row.activeSeconds, 0);
  const today = dailyMap.get(dateKey(now)) || { logins: 0, activeSeconds: 0 };

  return {
    ok: true,
    range: { days, since, through: now, timezone: ACTIVITY_TIMEZONE },
    profile,
    metrics: {
      loginsToday: today.logins,
      activeSecondsToday: today.activeSeconds,
      totalLogins: serializedSessions.length,
      totalActiveSeconds,
      averageActiveSecondsPerLogin: serializedSessions.length ? Math.round(totalActiveSeconds / serializedSessions.length) : 0,
      topPages,
    },
    daily: Array.from(dailyMap.values()),
    sessions: serializedSessions.slice(0, 100),
  };
}
