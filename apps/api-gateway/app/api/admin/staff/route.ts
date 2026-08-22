import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import { serializeStaffProfile, staffProfileInclude } from '@/src/lib/admin-staff-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function posInt(value: string | null, fallback: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function norm(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    requireStaffCapability(actor, 'staff.directory.read');

    const url = new URL(request.url);
    const q = norm(url.searchParams.get('q'));
    const department = norm(url.searchParams.get('department'));
    const designation = norm(url.searchParams.get('designation'));
    const role = norm(url.searchParams.get('role'));
    const presence = norm(url.searchParams.get('presence'));
    const state = norm(url.searchParams.get('state'));
    const sort = norm(url.searchParams.get('sort') || 'name');
    const dir = norm(url.searchParams.get('dir') || 'asc') === 'desc' ? -1 : 1;
    const page = posInt(url.searchParams.get('page'), 1, 100000);
    const pageSize = posInt(url.searchParams.get('pageSize'), 50, 100);
    const now = new Date();

    const meetingGraceBoundary = new Date(now.getTime() - 15 * 60_000);

    const [profiles, pendingRequests, activeMeetingParticipants] = await Promise.all([
      prisma.adminUserProfile.findMany({
        include: staffProfileInclude,
        take: 5000,
      }),
      prisma.roleRequest.findMany({
        where: { status: 'pending' },
        include: {
          department: { select: { id: true, name: true } },
          designation: { select: { id: true, name: true } },
          roles: {
            include: {
              role: {
                include: { scopes: true },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 5000,
      }),
      prisma.meetingParticipant.findMany({
        where: {
          state: 'JOINED',
          staffProfileId: { not: null },
          meeting: {
            state: 'LIVE',
            endsAt: { gt: meetingGraceBoundary },
          },
        },
        select: { staffProfileId: true },
        take: 5000,
      }),
    ]);

    const activeMeetingStaffIds = new Set(
      activeMeetingParticipants
        .map((row) => row.staffProfileId)
        .filter((value): value is string => Boolean(value)),
    );

    const activeRows = profiles.map((profile) => {
      const row = serializeStaffProfile(profile, now);
      if (row.presence !== 'IN_MEETING' || activeMeetingStaffIds.has(profile.id)) {
        return row;
      }

      const recentlyActive =
        profile.lastActivityAt &&
        now.getTime() - profile.lastActivityAt.getTime() <= 90_000;

      return {
        ...row,
        presence: recentlyActive ? ('AVAILABLE' as const) : ('OFFLINE' as const),
        presenceExpiresAt: recentlyActive
          ? new Date(now.getTime() + 90_000)
          : null,
      };
    });
    const pendingRows = pendingRequests.map((requestRow) => {
      const roles = requestRow.roles.map((entry) => ({
        id: entry.role.id,
        name: entry.role.name,
        scopes: entry.role.scopes.map((scope) => scope.scope),
      }));
      return {
        kind: 'pending' as const,
        id: requestRow.id,
        userId: requestRow.userId,
        name: requestRow.name || requestRow.email,
        email: requestRow.email,
        phone: null,
        staffIdentifier: null,
        photoUrl: null,
        department: requestRow.department,
        designation: requestRow.designation,
        manager: null,
        directReports: [],
        roles,
        scopes: Array.from(new Set(roles.flatMap((item) => item.scopes))),
        lifecycleState: 'PENDING' as const,
        timezone: null,
        workingHours: null,
        preferredContactMethod: null,
        presence: 'OFFLINE' as const,
        presenceExpiresAt: null,
        presenceNote: null,
        lastActivityAt: null,
        createdAt: requestRow.createdAt,
        updatedAt: requestRow.updatedAt,
      };
    });

    const allRows = [...activeRows, ...pendingRows];
    const counts = {
      active: activeRows.filter((row) => row.lifecycleState === 'ACTIVE').length,
      pending: pendingRows.length,
      leave: activeRows.filter((row) => row.lifecycleState === 'LEAVE').length,
      suspended: activeRows.filter((row) => row.lifecycleState === 'SUSPENDED').length,
      archived: activeRows.filter((row) => row.lifecycleState === 'ARCHIVED').length,
    };

    const filtered = allRows.filter((row) => {
      if (q) {
        const haystack = [
          row.name,
          row.email,
          row.phone,
          row.staffIdentifier,
          row.department?.name,
          row.designation?.name,
          ...row.roles.map((item) => item.name),
        ].map(norm).join(' ');
        if (!haystack.includes(q)) return false;
      }
      if (department && ![norm(row.department?.id), norm(row.department?.name)].includes(department)) return false;
      if (designation && ![norm(row.designation?.id), norm(row.designation?.name)].includes(designation)) return false;
      if (role && !row.roles.some((item) => [norm(item.id), norm(item.name)].includes(role))) return false;
      if (presence && norm(row.presence) !== presence) return false;
      if (state && norm(row.lifecycleState) !== state) return false;
      return true;
    });

    const value = (row: any) => {
      if (sort === 'email') return norm(row.email);
      if (sort === 'department') return norm(row.department?.name);
      if (sort === 'designation') return norm(row.designation?.name);
      if (sort === 'state') return norm(row.lifecycleState);
      if (sort === 'presence') return norm(row.presence);
      if (sort === 'created') return new Date(row.createdAt || 0).getTime();
      return norm(row.name);
    };

    filtered.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const primary = av < bv ? -1 : av > bv ? 1 : 0;
      if (primary) return primary * dir;
      return String(a.id).localeCompare(String(b.id));
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    const uniqueOptions = (key: 'department' | 'designation') => Array.from(
      new Map(
        allRows
          .map((row) => row[key])
          .filter(Boolean)
          .map((item: any) => [item.id, item]),
      ).values(),
    ).sort((a: any, b: any) => a.name.localeCompare(b.name));

    const roleOptions = Array.from(
      new Map(allRows.flatMap((row) => row.roles).map((item) => [item.id, { id: item.id, name: item.name }])).values(),
    ).sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      counts,
      filters: {
        departments: uniqueOptions('department'),
        designations: uniqueOptions('designation'),
        roles: roleOptions,
      },
      applied: { q, department, designation, role, presence, state, sort, dir: dir === 1 ? 'asc' : 'desc' },
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[admin staff] list failed', error);
    return NextResponse.json({ ok: false, error: 'staff_directory_failed' }, { status: 500 });
  }
}
