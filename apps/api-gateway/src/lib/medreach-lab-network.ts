import type { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/db';

export const NETWORK_TYPES = [
  'INDEPENDENT_GROUP',
  'CORPORATE_CHAIN',
  'FRANCHISE',
  'HOLDING_COMPANY',
] as const;

export const BRANCH_TYPES = [
  'OWNED_BRANCH',
  'FRANCHISE_BRANCH',
  'PARTNER_SITE',
] as const;

export const NETWORK_STAFF_ROLES = [
  'NETWORK_OWNER',
  'NETWORK_ADMIN',
  'OPERATIONS',
  'FINANCE',
  'QUALITY',
  'VIEWER',
] as const;

export const MANAGE_NETWORK_ROLES = ['NETWORK_OWNER', 'NETWORK_ADMIN'] as const;

export function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function cleanBoolean(value: unknown, fallback = false): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

export function roleOf(who: any): string {
  return String(who?.role || '').toLowerCase();
}

export function cleanNetworkType(value: unknown) {
  const networkType = cleanString(value).toUpperCase();

  return NETWORK_TYPES.includes(networkType as any)
    ? networkType
    : 'INDEPENDENT_GROUP';
}

export function cleanBranchType(value: unknown) {
  const branchType = cleanString(value).toUpperCase();

  return BRANCH_TYPES.includes(branchType as any)
    ? branchType
    : 'OWNED_BRANCH';
}

export function cleanNetworkStaffRole(value: unknown) {
  const role = cleanString(value).toUpperCase();

  return NETWORK_STAFF_ROLES.includes(role as any) ? role : 'VIEWER';
}

export function projectNetwork(row: any) {
  return {
    id: row.id,
    legalName: row.legalName,
    displayName: row.displayName ?? null,
    networkType: row.networkType,
    country: row.country,
    currency: row.currency,
    ownerUserId: row.ownerUserId ?? null,
    status: row.status,
    active: row.active,
    profileMeta: row.profileMeta ?? null,
    verifiedIdentityMeta: row.verifiedIdentityMeta ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
    counts: row._count
      ? {
          branches: row._count.branches ?? 0,
          staffMembers: row._count.staffMembers ?? 0,
        }
      : undefined,
  };
}

export function projectBranch(row: any) {
  return {
    id: row.id,
    networkId: row.networkId ?? null,
    branchCode: row.branchCode ?? null,
    branchType: row.branchType ?? null,
    hqVisible: row.hqVisible ?? true,
    name: row.name,
    displayName: row.displayName ?? null,
    logoUrl: row.logoUrl ?? null,
    contact: row.contact ?? null,
    city: row.city ?? null,
    province: row.province ?? null,
    country: row.country,
    currency: row.currency,
    status: row.status,
    active: row.active,
    onboardingStatus: row.onboardingStatus ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
    counts: row._count
      ? {
          staffMembers: row._count.staffMembers ?? 0,
          jobs: row._count.medReachJobs ?? 0,
          financialRecords: row._count.orderFinancials ?? 0,
          tests: row._count.offeredTests ?? 0,
          panels: row._count.panels ?? 0,
          specimenBundles: row._count.specimenBundles ?? 0,
        }
      : undefined,
  };
}

export async function canReadNetwork(req: NextRequest, networkId: string, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;
  if (!who?.uid) return false;

  const headerNetworkId = cleanString(req.headers.get('x-network-id'));

  if (headerNetworkId && headerNetworkId !== networkId) return false;

  const network = await prisma.medReachLabNetwork.findFirst({
    where: {
      id: networkId,
      active: true,
      OR: [
        { ownerUserId: who.uid },
        {
          staffMembers: {
            some: {
              userId: who.uid,
              active: true,
              status: 'ACTIVE',
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return network?.id === networkId;
}

export async function canManageNetwork(req: NextRequest, networkId: string, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;
  if (!who?.uid) return false;

  const headerNetworkId = cleanString(req.headers.get('x-network-id'));

  if (headerNetworkId && headerNetworkId !== networkId) return false;

  const network = await prisma.medReachLabNetwork.findFirst({
    where: {
      id: networkId,
      active: true,
      OR: [
        { ownerUserId: who.uid },
        {
          staffMembers: {
            some: {
              userId: who.uid,
              active: true,
              status: 'ACTIVE',
              role: { in: [...MANAGE_NETWORK_ROLES] as any },
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return network?.id === networkId;
}

export async function writeNetworkAudit(kind: string, who: any, subjectId: string, meta: Record<string, any>) {
  await prisma.auditEvent.create({
    data: {
      kind,
      actorId: who?.uid,
      actorRole: who?.role,
      subjectId,
      meta,
    },
  });
}