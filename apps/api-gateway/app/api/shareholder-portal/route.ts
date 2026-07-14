import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  json,
  requireShareholderReadAccess,
  routeError,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_SHAREHOLDER_PORTAL_READ_ONLY_ROUTE

export async function GET(req: NextRequest) {
  try {
    const access = await requireShareholderReadAccess(req, 'canViewAnnouncements');
    if (!access.ok) return access.response;

    const db: any = prisma;
    const envelope = access.envelope;
    const shareholderAccess = envelope.shareholderAccess;

    const capTable =
      shareholderAccess.canViewCapTable
        ? await db.capTableSnapshot.findMany({
            where: { publishedToShareholders: true },
            orderBy: [{ snapshotDate: 'desc' }],
            take: 10,
          })
        : [];

    const valuations =
      shareholderAccess.canViewValuations
        ? await db.companyValuationSnapshot.findMany({
            where: { publishedToShareholders: true },
            orderBy: [{ valuationDate: 'desc' }],
            take: 10,
          })
        : [];

    const annualReturns =
      shareholderAccess.canViewAnnualReturns
        ? await db.annualReturn.findMany({
            where: { visibleToShareholders: true },
            orderBy: [{ createdAt: 'desc' }],
            take: 20,
          })
        : [];

    const announcements =
      shareholderAccess.canViewAnnouncements
        ? await db.shareholderAnnouncement.findMany({
            where: { visibleToShareholders: true },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
            take: 50,
          })
        : [];

    const documents =
      shareholderAccess.canDownloadDocuments
        ? await db.shareholderDocument.findMany({
            where: { visibleToShareholders: true },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
            take: 50,
          })
        : [];

    const agmNotices =
      shareholderAccess.canViewAnnouncements
        ? await db.aGMNotice.findMany({
            where: { visibleToShareholders: true },
            orderBy: [{ meetingDate: 'desc' }],
            take: 20,
          })
        : [];

    const shareSaleNotices =
      shareholderAccess.canViewAnnouncements
        ? await db.shareSaleNotice.findMany({
            where: { visibleToShareholders: true },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
            take: 20,
          })
        : [];

    return json({
      ok: true,
      envelope,
      readOnly: true,
      capTable,
      valuations,
      annualReturns,
      announcements,
      documents,
      agmNotices,
      shareSaleNotices,
    });
  } catch (error: any) {
    return routeError(error, 'shareholder_portal_read_failed');
  }
}
