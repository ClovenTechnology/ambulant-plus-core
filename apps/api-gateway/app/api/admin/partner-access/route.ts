import { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { administer, view } from '@/src/lib/partner-access/engine';
import { checkOrigin, errorResponse, jsonInput, requirePartnerAdmin, response } from '@/src/lib/partner-access/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    await requirePartnerAdmin(req);
    const accounts = await prisma.partnerAccessAccount.findMany({ take: 200, orderBy: { updatedAt: 'desc' } });
    return response({ ok: true, accounts: accounts.map(view) });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    const actor = await requirePartnerAdmin(req, true);
    return response({ ok: true, ...await administer(prisma, actor.userId, await jsonInput(req)) });
  } catch (e) { return errorResponse(e); }
}
