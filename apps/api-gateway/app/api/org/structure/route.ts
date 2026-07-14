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


function orgHierarchyText(value: unknown, max = 180) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, max);
}

function orgHierarchyRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function orgHierarchyBool(value: unknown, fallback?: boolean) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === false) return value;
  const text = orgHierarchyText(value, 16).toLowerCase();
  if (['true', '1', 'yes', 'active', 'enabled'].includes(text)) return true;
  if (['false', '0', 'no', 'inactive', 'disabled'].includes(text)) return false;
  return fallback;
}

function orgHierarchyArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => orgHierarchyText(item, 180)).filter(Boolean);
  }

  const text = orgHierarchyText(value, 2000);
  if (!text) return [];

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function orgHierarchyEntity(body: Record<string, any>) {
  return orgHierarchyText(body.entity || body.kind || body.type || body.resource || body.nodeType, 80).toLowerCase();
}

async function applyRoleScopes(roleId: string, scopes: string[], replaceScopes: boolean) {
  const prismaAny = prisma as any;

  if (!roleId || !scopes.length || !prismaAny.roleScope?.createMany) return;

  if (replaceScopes && prismaAny.roleScope?.deleteMany) {
    await prismaAny.roleScope.deleteMany({ where: { roleId } });
  }

  await prismaAny.roleScope.createMany({
    data: scopes.map((scope) => ({ roleId, scope })),
    skipDuplicates: true,
  });
}

async function assignRoleToDesignation(body: Record<string, any>, remove = false) {
  const prismaAny = prisma as any;
  const designationId = orgHierarchyText(body.designationId || body.parentId || body.designation?.id, 160);
  const roleId = orgHierarchyText(body.roleId || body.childId || body.role?.id, 160);
  const delegate = prismaAny.departmentDesignationRole || prismaAny.designationRole || prismaAny.designationRoleAssignment;

  if (!designationId || !roleId) {
    return NextResponse.json({ ok: false, error: 'designationId_and_roleId_required' }, { status: 400 });
  }

  if (!delegate) {
    return NextResponse.json({ ok: false, error: 'designation_role_delegate_not_configured' }, { status: 501 });
  }

  if (remove && delegate.deleteMany) {
    const result = await delegate.deleteMany({ where: { designationId, roleId } });
    return NextResponse.json({
      ok: true,
      hierarchyOperation: 'remove_child_role_from_parent_designation',
      parentId: designationId,
      childId: roleId,
      result,
    });
  }

  if (delegate.createMany) {
    await delegate.createMany({
      data: [{ designationId, roleId }],
      skipDuplicates: true,
    });

    return NextResponse.json({
      ok: true,
      hierarchyOperation: 'assign_child_role_to_parent_designation',
      parentId: designationId,
      childId: roleId,
    });
  }

  const item = await delegate.create({ data: { designationId, roleId } });

  return NextResponse.json({
    ok: true,
    hierarchyOperation: 'assign_child_role_to_parent_designation',
    parentId: designationId,
    childId: roleId,
    item,
  });
}

async function writeOrgStructure(req: Request, mode: 'create' | 'patch') {
  let body: Record<string, any>;

  try {
    body = orgHierarchyRecord(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const entity = orgHierarchyEntity(body);
  const action = orgHierarchyText(body.action || mode, 80).toLowerCase();
  const id = orgHierarchyText(body.id || body.nodeId, 160);
  const name = orgHierarchyText(body.name || body.label || body.title, 180);
  const active = orgHierarchyBool(body.active, true);
  const parentId = orgHierarchyText(body.parentId || body.departmentId || body.hqId || body.networkId, 160);
  const childId = orgHierarchyText(body.childId || body.roleId || body.branchId, 160);

  try {
    if (entity === 'department' || entity === 'org_department' || entity === 'department_node') {
      if (mode === 'patch' && id) {
        const data: any = {};
        if (name) data.name = name;
        if (active !== undefined) data.active = active;

        const item = await prisma.department.update({ where: { id }, data });

        return NextResponse.json({
          ok: true,
          hierarchyOperation: 'update_department_structure_node',
          entity: 'department',
          parentId: null,
          childId: item.id,
          item,
        });
      }

      if (!name) return NextResponse.json({ ok: false, error: 'department_name_required' }, { status: 400 });

      const item = await prisma.department.create({ data: { name, active: active ?? true } });

      return NextResponse.json(
        {
          ok: true,
          hierarchyOperation: 'create_department_structure_node',
          entity: 'department',
          parentId: null,
          childId: item.id,
          item,
        },
        { status: 201 },
      );
    }

    if (entity === 'designation' || entity === 'org_designation' || entity === 'designation_node') {
      const departmentId = orgHierarchyText(body.departmentId || body.parentId, 160);

      if (mode === 'patch' && id) {
        const data: any = {};
        if (name) data.name = name;
        if (departmentId) data.departmentId = departmentId;

        const item = await prisma.designation.update({ where: { id }, data });

        return NextResponse.json({
          ok: true,
          hierarchyOperation: 'update_designation_child_node',
          entity: 'designation',
          parentId: item.departmentId,
          childId: item.id,
          item,
        });
      }

      if (!name) return NextResponse.json({ ok: false, error: 'designation_name_required' }, { status: 400 });
      if (!departmentId) return NextResponse.json({ ok: false, error: 'designation_parent_departmentId_required' }, { status: 400 });

      const item = await prisma.designation.create({ data: { name, departmentId } });

      return NextResponse.json(
        {
          ok: true,
          hierarchyOperation: 'create_designation_child_node',
          entity: 'designation',
          parentId: departmentId,
          childId: item.id,
          item,
        },
        { status: 201 },
      );
    }

    if (entity === 'role' || entity === 'org_role' || entity === 'role_node') {
      const scopes = orgHierarchyArray(body.scopes);
      const replaceScopes = orgHierarchyBool(body.replaceScopes, false) === true;

      if (mode === 'patch' && id) {
        const data: any = {};
        if (name) data.name = name;

        const item = await prisma.role.update({ where: { id }, data });
        await applyRoleScopes(item.id, scopes, replaceScopes);

        const full = await prisma.role.findUnique({ where: { id: item.id }, include: { scopes: true } });

        return NextResponse.json({
          ok: true,
          hierarchyOperation: 'update_role_child_node',
          entity: 'role',
          parentId: parentId || null,
          childId: item.id,
          item: full || item,
        });
      }

      if (!name) return NextResponse.json({ ok: false, error: 'role_name_required' }, { status: 400 });

      const item = await prisma.role.create({ data: { name } });
      await applyRoleScopes(item.id, scopes, false);

      const full = await prisma.role.findUnique({ where: { id: item.id }, include: { scopes: true } });

      return NextResponse.json(
        {
          ok: true,
          hierarchyOperation: 'create_role_child_node',
          entity: 'role',
          parentId: parentId || null,
          childId: item.id,
          item: full || item,
        },
        { status: 201 },
      );
    }

    if (
      entity === 'designation_role' ||
      entity === 'department_designation_role' ||
      entity === 'role_assignment' ||
      action === 'assign_role_to_designation' ||
      action === 'remove_role_from_designation'
    ) {
      return assignRoleToDesignation(
        {
          ...body,
          parentId: parentId || body.designationId,
          childId: childId || body.roleId,
        },
        action === 'remove_role_from_designation' || action === 'remove',
      );
    }

    return NextResponse.json({
      ok: false,
      error: 'unsupported_structure_entity',
      supportedEntities: ['department', 'designation', 'role', 'designation_role'],
      hierarchyOperation: 'unsupported_parent_child_structure_operation',
    }, { status: 400 });
  } catch (err: any) {
    console.error('WRITE /api/org/structure error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'org_structure_write_failed',
        hierarchyOperation: 'org_structure_parent_child_write_failed',
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return writeOrgStructure(req, 'create');
}

export async function PATCH(req: Request) {
  return writeOrgStructure(req, 'patch');
}
