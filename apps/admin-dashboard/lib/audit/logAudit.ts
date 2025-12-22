// lib/audit/logAudit.ts
import { PrismaClient, AuditActorType } from '@prisma/client';

const prisma = new PrismaClient();

type LogAuditInput = {
  actorUserId?: string | null;
  actorType: AuditActorType;
  actorRefId?: string | null;
  app: string;
  sessionId?: string | null;

  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;

  ip?: string | null;
  ipCountry?: string | null;
  ipCity?: string | null;
  userAgent?: string | null;
  meta?: unknown;
};

export async function logAudit(input: LogAuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        ...input,
        meta: input.meta as any,
      },
    });
  } catch (e) {
    // absolutely never throw from audit logging – just log & move on
    console.error('audit log insert failed', e);
  }
}
