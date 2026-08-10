import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { canPermanentlyDeleteOpportunity } from '@/src/lib/opportunities-policy';
import { canPermanentlyDeleteEnterpriseForm } from '@/src/lib/admin-forms-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

const suspiciousTokens = ['test', 'demo', 'probe', 'prove a point', 'tech tool session', 'new form', 'example'];
function suspiciousText(value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'nj' || suspiciousTokens.some((token) => text.includes(token));
}
function classification(value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  return text === 'nj' || /\b(test|demo|probe|example)\b/.test(text) || text.includes('prove a point') || text.includes('tech tool session')
    ? 'TEST_LIKELY'
    : 'REVIEW_REQUIRED';
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    if (!actor.isSuperAdmin) return json({ ok: false, error: 'super_admin_required' }, 403);

    const [opportunities, forms, meetings, staff] = await Promise.all([
      prisma.opportunity.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 500,
        include: { _count: { select: { applications: true } } },
      }),
      prisma.enterpriseForm.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 500,
        include: {
          _count: { select: { submissions: true, opportunities: true, recruitmentTemplates: true } },
          versions: {
            select: {
              state: true,
              publishedAt: true,
              _count: {
                select: {
                  applications: true,
                  applicationInterviewEvaluationCycles: true,
                  recruitmentEvaluationTemplates: true,
                },
              },
            },
          },
        },
      }),
      prisma.meeting.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 500,
        select: { id: true, title: true, kind: true, state: true, startsAt: true, createdAt: true },
      }),
      prisma.adminUserProfile.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 500,
        select: { id: true, name: true, email: true, lifecycleState: true, createdAt: true },
      }),
    ]);

    const candidates: any[] = [];
    for (const row of opportunities) {
      if (!suspiciousText(`${row.title} ${row.key} ${row.slug}`)) continue;
      const canDelete = canPermanentlyDeleteOpportunity({
        status: row.status,
        publishedAt: row.publishedAt,
        pausedAt: row.pausedAt,
        closedAt: row.closedAt,
        archivedAt: row.archivedAt,
        applicationCount: row._count.applications,
      });
      candidates.push({
        entityType: 'Opportunity', id: row.id, label: row.title, classification: classification(`${row.title} ${row.key} ${row.slug}`),
        safeAction: canDelete ? 'DELETE_ALLOWED' : 'ARCHIVE_ONLY',
        detail: `${row.status} · ${row._count.applications} application(s)`, href: `/admin/opportunities/${row.id}`,
      });
    }
    for (const row of forms) {
      if (!suspiciousText(`${row.name} ${row.key} ${row.slug}`)) continue;
      const canDelete = canPermanentlyDeleteEnterpriseForm({
        submissionCount: row._count.submissions,
        opportunityCount: row._count.opportunities,
        recruitmentTemplateCount: row._count.recruitmentTemplates,
        versions: row.versions.map((version) => ({
          state: version.state,
          publishedAt: version.publishedAt,
          applicationCount: version._count.applications,
          evaluationCycleCount: version._count.applicationInterviewEvaluationCycles,
          recruitmentEvaluationTemplateCount: version._count.recruitmentEvaluationTemplates,
        })),
      });
      candidates.push({
        entityType: 'Form', id: row.id, label: row.name, classification: classification(`${row.name} ${row.key} ${row.slug}`),
        safeAction: canDelete ? 'DELETE_ALLOWED' : 'ARCHIVE_ONLY',
        detail: `${row._count.submissions} submission(s) · ${row.versions.length} version(s)`, href: `/admin/forms/${row.id}`,
      });
    }
    for (const row of meetings) {
      if (!suspiciousText(row.title)) continue;
      candidates.push({
        entityType: 'Meeting', id: row.id, label: row.title, classification: classification(row.title),
        safeAction: 'REVIEW_ONLY', detail: `${row.kind} · ${row.state}`, href: `/admin/meetings/${row.id}`,
      });
    }
    for (const row of staff) {
      if (!suspiciousText(`${row.name || ''} ${row.email}`)) continue;
      candidates.push({
        entityType: 'Staff', id: row.id, label: row.name || row.email, classification: classification(`${row.name || ''} ${row.email}`),
        safeAction: 'REVIEW_ONLY', detail: `${row.lifecycleState} · ${row.email}`, href: `/admin/staff/${row.id}`,
      });
    }

    return json({ ok: true, generatedAt: new Date().toISOString(), candidates });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    console.error('[recruitment data hygiene] failed', error);
    return json({ ok: false, error: 'data_hygiene_audit_failed' }, 500);
  }
}
