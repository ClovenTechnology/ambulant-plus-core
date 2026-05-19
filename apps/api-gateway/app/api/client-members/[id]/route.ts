import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const item = await prisma.clientMember.findUnique({
      where: { id: params.id },
      include: {
        coveragePlan: {
          include: {
            serviceRules: true
          }
        },
        clientProgram: true
      }
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: "Client member not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch client member.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();

    const item = await prisma.clientMember.update({
      where: { id: params.id },
      data: {
        clientProgramId: body.clientProgramId,
        coveragePlanId: body.coveragePlanId,
        memberKind: body.memberKind,
        memberStatus: body.memberStatus,
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

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update client member.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}