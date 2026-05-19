// apps/api-gateway/app/api/member-reimbursement-claims/[id]/evidence/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";

import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { requireApiClientRole } from "@/src/lib/client-rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_DIR = path.resolve(
  process.cwd(),
  ".ambulant-uploads/member-reimbursement-evidence",
);

const PAYEROPS_ALLOWED_ROLES = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "CLAIMS_MANAGER",
  "FINANCE_MANAGER",
] as const;

function trim(v: unknown): string {
  return String(v ?? "").trim();
}

function upper(v: unknown): string {
  return trim(v).toUpperCase();
}

function asObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
}

function looksLikePayerOps(req: NextRequest): boolean {
  return Boolean(
    req.headers.get("x-ambulant-user-id") ||
      req.headers.get("x-ambulant-trusted") ||
      upper(req.headers.get("x-ambulant-role")).includes("ORG_") ||
      upper(req.headers.get("x-ambulant-role")).includes("CLAIMS") ||
      upper(req.headers.get("x-ambulant-role")).includes("FINANCE"),
  );
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

async function writeAudit(data: {
  orgId: string;
  clientId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityId?: string | null;
  status?: string | null;
  metadata?: Record<string, any>;
}) {
  const db: any = prisma;

  await db.clientAuditLog?.create?.({
    data: {
      orgId: data.orgId,
      clientId: data.clientId || null,
      actorUserId: data.actorUserId || null,
      actorRole: data.actorRole || null,
      action: data.action,
      entityType: "MemberReimbursementClaim",
      entityId: data.entityId || null,
      status: data.status || "SUCCESS",
      metadata: data.metadata || {},
    },
  }).catch(() => null);

  await db.auditLog?.create?.({
    data: {
      orgId: data.orgId,
      clientId: data.clientId || null,
      actorUserId: data.actorUserId || null,
      actorRole: data.actorRole || null,
      action: data.action,
      entityType: "MemberReimbursementClaim",
      entityId: data.entityId || null,
      status: data.status || "SUCCESS",
      metadata: data.metadata || {},
    },
  }).catch(() => null);
}

function patientActor(req: NextRequest): {
  uid: string;
  orgId: string;
  role: "patient";
} | null {
  try {
    const who = readIdentity(req.headers);
    const uid = trim((who as any)?.uid || req.headers.get("x-uid"));
    const orgId =
      trim((who as any)?.orgId || req.headers.get("x-org-id")) || "org-default";
    const role = trim((who as any)?.role || req.headers.get("x-role")).toLowerCase();

    if (!uid || role !== "patient") return null;

    return { uid, orgId, role: "patient" };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const claimId = trim(ctx.params.id);
  const db: any = prisma;

  if (!claimId) {
    return NextResponse.json(
      { ok: false, error: "claim_id_required" },
      { status: 400 },
    );
  }

  const claim = await db.memberReimbursementClaim.findUnique({
    where: { id: claimId },
  });

  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "claim_not_found" },
      { status: 404 },
    );
  }

  let actorUserId: string | null = null;
  let actorRole: string | null = null;
  let actorScope: "patient" | "payerops" = "patient";

  if (looksLikePayerOps(req)) {
    const auth = requireApiClientRole(req, [...PAYEROPS_ALLOWED_ROLES], {
      orgId: claim.orgId,
    });

    if (auth.ok === false) return auth.response;

    actorUserId = trim(auth.actor.uid) || null;
    actorRole = trim(auth.actor.role) || null;
    actorScope = "payerops";
  } else {
    const patient = patientActor(req);

    if (!patient || patient.orgId !== claim.orgId || patient.uid !== claim.userId) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }

    actorUserId = patient.uid;
    actorRole = "patient";
    actorScope = "patient";
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "file_required" },
      { status: 400 },
    );
  }

  const maxBytes = 8 * 1024 * 1024;

  if (file.size > maxBytes) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", maxBytes },
      { status: 413 },
    );
  }

  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ]);

  if (file.type && !allowedTypes.has(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported_file_type",
        allowedTypes: Array.from(allowedTypes),
      },
      { status: 415 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const originalName = safeName(file.name || "evidence");
  const ext = path.extname(originalName);
  const storedName = `${claim.id}-${Date.now()}-${sha256.slice(0, 12)}${ext}`;
  const storedPath = path.join(UPLOAD_DIR, storedName);

  await fs.writeFile(storedPath, buffer);

  const now = new Date();

  const descriptor = {
    originalName,
    storedName,
    storage: "local-file",
    relativePath: `.ambulant-uploads/member-reimbursement-evidence/${storedName}`,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    sha256,
    uploadedAt: now.toISOString(),
    uploadedByUserId: actorUserId,
    uploadedByRole: actorRole,
    uploadedByScope: actorScope,
  };

  const evidence = asObj(claim.evidenceJson);
  const files = Array.isArray(evidence.files)
    ? evidence.files
    : Array.isArray(evidence.evidenceFiles)
      ? evidence.evidenceFiles
      : [];

  const nextEvidence = {
    ...evidence,
    files: [...files, descriptor],
    evidenceFiles: [...files, descriptor],
    lastEvidenceAt: now.toISOString(),
    evidenceCount: files.length + 1,
  };

  const nextStatus =
    actorScope === "patient" && upper(claim.status) === "REQUEST_INFO"
      ? "UNDER_REVIEW"
      : claim.status;

  const updated = await db.memberReimbursementClaim.update({
    where: { id: claim.id },
    data: {
      evidenceJson: nextEvidence,
      status: nextStatus,
      updatedAt: now,
      reviewPayload: {
        ...asObj(claim.reviewPayload),
        lastEvidenceUpload: descriptor,
      },
    },
  });

  await writeAudit({
    orgId: claim.orgId,
    clientId: claim.clientId || null,
    actorUserId,
    actorRole,
    action: "member_reimbursement_claim.evidence_upload",
    entityId: claim.id,
    metadata: {
      claimNumber: claim.claimNumber,
      sha256,
      originalName,
      sizeBytes: file.size,
      previousStatus: claim.status,
      nextStatus,
    },
  });

  return NextResponse.json({
    ok: true,
    claim: updated,
    evidence: descriptor,
  });
}