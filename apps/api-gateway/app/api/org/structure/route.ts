// apps/api-gateway/app/api/org/structure/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function emptyStructure() {
  return {
    departments: [],
    roles: [],
  };
}

export async function GET() {
  try {
    /*
     * This route must remain dynamic because it reads live organisation
     * structure from Prisma. Without force-dynamic, Next may try to prerender
     * it during build, which fails locally/CI if DATABASE_URL is unavailable.
     */
    const [departments, roles] = await Promise.all([
      prisma.department.findMany({
        orderBy: { name: 'asc' },
        include: {
          designations: {
            orderBy: { name: 'asc' },
            include: {
              roles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      }),
      prisma.role.findMany({
        orderBy: { name: 'asc' },
        include: {
          scopes: true,
        },
      }),
    ]);

    return NextResponse.json({
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        active: d.active,
        designations: d.designations.map((z) => ({
          id: z.id,
          name: z.name,
          roles: z.roles.map((dr) => ({
            id: dr.role.id,
            name: dr.role.name,
          })),
        })),
      })),
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        scopes: r.scopes.map((s) => s.scope),
      })),
    });
  } catch (err: any) {
    console.error('GET /api/org/structure error', err);

    /*
     * Keep the API build/deployment resilient. At runtime, if DB is unavailable,
     * the admin UI receives an empty structure instead of a hard 500 during
     * static collection/build-like execution.
     */
    return NextResponse.json(
      {
        ...emptyStructure(),
        ok: false,
        error: err?.message || 'org_structure_unavailable',
      },
      { status: 200 },
    );
  }
}