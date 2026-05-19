import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  ApiClientActor,
  readApiClientActor,
} from "@/src/lib/client-rbac";

const globalForAudit = globalThis as unknown as {
  ambulantAuditPrisma?: PrismaClient;
};

const auditPrisma =
  globalForAudit.ambulantAuditPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForAudit.ambulantAuditPrisma = auditPrisma;
}

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;

  return req.headers.get("x-real-ip") || null;
}

function safeActor(req: NextRequest, actor?: ApiClientActor | null) {
  return actor ?? readApiClientActor(req);
}

export async function writeClientAuditLog(
  req: NextRequest,
  actor: ApiClientActor | null | undefined,
  input: {
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    description?: string | null;
    status?: "success" | "failed" | "blocked" | "empty";
    orgId?: string | null;
    clientId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const resolvedActor = safeActor(req, actor);

    await auditPrisma.auditLog.create({
      data: {
        actorUserId: resolvedActor.uid,
        actorType: resolvedActor.uid ? "ADMIN" : "SYSTEM",
        actorRefId: resolvedActor.uid,
        app: "ambulant-payerops",
        sessionId: req.headers.get("x-ambulant-session-id") || null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        description: input.description ?? null,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent") || null,
        meta: {
          status: input.status ?? "success",
          orgId: input.orgId ?? resolvedActor.orgId ?? null,
          clientId: input.clientId ?? null,
          role: resolvedActor.role,
          workspace: resolvedActor.workspace,
          trusted: resolvedActor.trusted,
          method: req.method,
          path: req.nextUrl.pathname,
          ...input.metadata,
        },
      },
    });
  } catch (error) {
    console.warn("[audit-log] failed to write audit log", error);
  }
}