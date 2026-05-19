import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = searchParams.get("orgId") ?? "org-default";
    const clientId = searchParams.get("clientId") ?? undefined;
    const coveragePlanId = searchParams.get("coveragePlanId") ?? undefined;
    const memberStatus = searchParams.get("memberStatus") ?? undefined;
    const patientId = searchParams.get("patientId") ?? undefined;

    const items = await prisma.clientMember.findMany({
      where: {
        orgId,
        ...(clientId ? { clientId } : {}),
        ...(coveragePlanId ? { coveragePlanId } : {}),
        ...(memberStatus ? { memberStatus: memberStatus as never } : {}),
        ...(patientId ? { patientId } : {})
      },
      include: {
        coveragePlan: true,
        clientProgram: true
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch client members.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const item = await prisma.clientMember.create({
      data: {
        orgId: body.orgId ?? "org-default",
        clientId: body.clientId,
        clientProgramId: body.clientProgramId,
        coveragePlanId: body.coveragePlanId,
        userId: body.userId,
        patientId: body.patientId,
        memberKind: body.memberKind,
        memberStatus: body.memberStatus ?? "PENDING",
        memberNumber: body.memberNumber,
        employeeNumber: body.employeeNumber,
        dependentCode: body.dependentCode,
        principalMemberNumber: body.principalMemberNumber,
        joinedAt: body.joinedAt ? new Date(body.joinedAt) : undefined,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        metadata: body.metadata
      }
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create client member.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}