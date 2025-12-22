// apps/api-gateway/app/api/org/structure/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [departments, roles] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        designations: {
          orderBy: { name: 'asc' },
          include: {
            roles: { include: { role: true } },
          },
        },
      },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { scopes: true },
    }),
  ]);

  return NextResponse.json({
    departments: departments.map(d => ({
      id: d.id,
      name: d.name,
      active: d.active,
      designations: d.designations.map(z => ({
        id: z.id,
        name: z.name,
        roles: z.roles.map(dr => ({ id: dr.role.id, name: dr.role.name })),
      })),
    })),
    roles: roles.map(r => ({
      id: r.id,
      name: r.name,
      scopes: r.scopes.map(s => s.scope),
    })),
  });
}
