// apps/api-gateway/app/api/admin/org/seed-operating-structure/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RoleSeed = {
  name: string;
  scopes: string[];
};

type DesignationSeed = {
  name: string;
  roles: string[];
};

type DepartmentSeed = {
  name: string;
  active?: boolean;
  designations: DesignationSeed[];
};

const ROLE_SEEDS: RoleSeed[] = [
  {
    name: 'Super Admin',
    scopes: [
      '*',
      'admin:all',
      'admin:read',
      'admin:write',
      'org:manage',
      'users:manage',
      'clinicians:manage',
      'patients:manage',
      'training:manage',
      'recordings:manage',
      'devices:manage',
      'careport:manage',
      'medreach:manage',
      'finance:manage',
      'compliance:manage',
      'reports:read',
      'insightcore:manage',
    ],
  },
  {
    name: 'Admin',
    scopes: [
      'admin:read',
      'admin:write',
      'org:read',
      'users:read',
      'clinicians:manage',
      'patients:read',
      'training:manage',
      'recordings:manage',
    ],
  },
  { name: 'Medical', scopes: ['clinical:read', 'clinical:write', 'patients:read'] },
  { name: 'Clinical Operations', scopes: ['clinicians:manage', 'training:read', 'patients:read'] },
  { name: 'Clinician Support', scopes: ['clinicians:read', 'clinicians:support', 'training:read'] },
  { name: 'Patient Support', scopes: ['patients:read', 'patients:support', 'careport:read'] },
  { name: 'Training', scopes: ['training:read', 'training:manage'] },
  { name: 'Certification', scopes: ['training:read', 'certification:manage'] },
  { name: 'Product Operations', scopes: ['products:read', 'products:manage', 'devices:read'] },
  { name: 'Device Operations', scopes: ['devices:read', 'devices:manage'] },
  { name: 'Tech & IT', scopes: ['tech:read', 'tech:manage', 'devices:manage'] },
  { name: 'CarePort', scopes: ['careport:read', 'careport:manage'] },
  { name: 'MedReach', scopes: ['medreach:read', 'medreach:manage'] },
  { name: 'Compliance', scopes: ['compliance:read', 'compliance:manage', 'audit:read'] },
  { name: 'Finance', scopes: ['finance:read', 'finance:manage', 'settlements:read'] },
  { name: 'Settlements', scopes: ['settlements:read', 'settlements:manage', 'finance:read'] },
  { name: 'HR', scopes: ['hr:read', 'hr:manage', 'users:read'] },
  { name: 'Dispatch', scopes: ['dispatch:read', 'dispatch:manage', 'devices:read'] },
  { name: 'Partnerships', scopes: ['partners:read', 'partners:manage'] },
  { name: 'InsightCore', scopes: ['insightcore:read', 'insightcore:manage'] },
  { name: 'AI Governance', scopes: ['ai:read', 'ai:governance', 'compliance:read'] },
  { name: 'ReportsResearch', scopes: ['reports:read', 'research:read'] },
  { name: 'RnD', scopes: ['research:read', 'research:manage', 'insightcore:read'] },
];

const DEPARTMENT_SEEDS: DepartmentSeed[] = [
  {
    name: 'Executive & Super Administration',
    designations: [
      { name: 'Super Admin', roles: ['Super Admin', 'Admin'] },
      { name: 'Platform Admin', roles: ['Super Admin', 'Admin', 'Compliance', 'Finance', 'HR'] },
      { name: 'Chief Executive Officer', roles: ['Super Admin'] },
      { name: 'Chief Clinical Officer', roles: ['Clinical Operations', 'Medical', 'Admin', 'Compliance'] },
      { name: 'Chief Technology Officer', roles: ['Tech & IT', 'Admin'] },
      { name: 'Chief Financial Officer', roles: ['Finance', 'Admin'] },
    ],
  },
  {
    name: 'Clinical Operations',
    designations: [
      { name: 'Clinical Operations Lead', roles: ['Clinical Operations', 'Medical', 'Admin'] },
      { name: 'Clinician Operations Admin', roles: ['Clinical Operations', 'Clinician Support', 'Admin'] },
      { name: 'Clinical Governance Officer', roles: ['Clinical Operations', 'Compliance', 'Medical'] },
    ],
  },
  {
    name: 'Clinician Support Services',
    designations: [
      { name: 'Clinician Support Lead', roles: ['Clinician Support', 'Training'] },
      { name: 'Clinician Support Specialist', roles: ['Clinician Support'] },
    ],
  },
  {
    name: 'Patient Support Services',
    designations: [
      { name: 'Patient Support Lead', roles: ['Patient Support', 'CarePort'] },
      { name: 'Patient Support Specialist', roles: ['Patient Support'] },
    ],
  },
  {
    name: 'Training & Certification',
    designations: [
      { name: 'Training Lead', roles: ['Training', 'Certification'] },
      { name: 'Certification Officer', roles: ['Certification', 'Compliance'] },
    ],
  },
  {
    name: 'Product & Device Operations',
    designations: [
      { name: 'Product Specialist — Wearable Technology', roles: ['Product Operations', 'Device Operations'] },
      { name: 'Product Specialist — NexRing', roles: ['Product Operations', 'Device Operations'] },
      { name: 'Product Specialist — 6-in-1 Health Monitor', roles: ['Product Operations', 'Device Operations'] },
      { name: 'Product Specialist — Digital Stethoscope', roles: ['Product Operations', 'Device Operations'] },
      { name: 'Product Specialist — HD Otoscope', roles: ['Product Operations', 'Device Operations'] },
      { name: 'Product Specialist — Ambulant+ Platform', roles: ['Product Operations', 'Tech & IT'] },
      { name: 'Product Support Specialist', roles: ['Product Operations'] },
    ],
  },
  {
    name: 'Technology & Engineering',
    designations: [
      { name: 'Software Engineer', roles: ['Tech & IT'] },
      { name: 'DevOps Engineer', roles: ['Tech & IT'] },
      { name: 'Cyber Security Specialist', roles: ['Tech & IT', 'Compliance'] },
    ],
  },
  {
    name: 'CarePort Operations',
    designations: [
      { name: 'CarePort Operations Lead', roles: ['CarePort', 'Admin'] },
      { name: 'Pharmacy Network Coordinator', roles: ['CarePort'] },
      { name: 'Rider Operations Coordinator', roles: ['CarePort', 'Dispatch'] },
    ],
  },
  {
    name: 'MedReach Operations',
    designations: [
      { name: 'MedReach Operations Lead', roles: ['MedReach', 'Admin'] },
      { name: 'Lab Network Coordinator', roles: ['MedReach'] },
      { name: 'Phlebotomy Operations Coordinator', roles: ['MedReach', 'Dispatch'] },
    ],
  },
  {
    name: 'Compliance & Governance',
    designations: [
      { name: 'Compliance Officer', roles: ['Compliance'] },
      { name: 'Data Protection Officer', roles: ['Compliance'] },
      { name: 'AI Safety & Workflow Governance Officer', roles: ['AI Governance', 'Compliance', 'InsightCore'] },
    ],
  },
  {
    name: 'Finance & Settlements',
    designations: [
      { name: 'Finance Officer', roles: ['Finance'] },
      { name: 'Settlements Officer', roles: ['Settlements', 'Finance'] },
      { name: 'Accountant', roles: ['Finance'] },
      { name: 'Auditor', roles: ['Finance', 'Compliance'] },
    ],
  },
  {
    name: 'HR & People Operations',
    designations: [
      { name: 'HR Manager', roles: ['HR'] },
      { name: 'Recruiter', roles: ['HR'] },
    ],
  },
  {
    name: 'Logistics & Dispatch',
    designations: [
      { name: 'Dispatch Coordinator', roles: ['Dispatch'] },
      { name: 'Starter Kit Dispatch Coordinator', roles: ['Dispatch', 'Product Operations'] },
    ],
  },
  {
    name: 'Commercial & Partnerships',
    designations: [
      { name: 'Partnerships Manager', roles: ['Partnerships'] },
      { name: 'Client Success Manager', roles: ['Partnerships', 'Patient Support'] },
    ],
  },
  {
    name: 'Research, InsightCore & AI Governance',
    designations: [
      { name: 'InsightCore Governance Officer', roles: ['InsightCore', 'AI Governance', 'Compliance'] },
      { name: 'Research & Reports Officer', roles: ['ReportsResearch', 'RnD', 'InsightCore'] },
      { name: 'AI Safety Lead', roles: ['AI Governance', 'Compliance'] },
    ],
  },
];

function allowedSeedKeys() {
  return [
    process.env.ORG_SEED_ADMIN_KEY,
    process.env.ADMIN_API_KEY,
    process.env.TRAINING_RECORDING_ADMIN_KEY,
    process.env.CLINICIAN_OPS_SEED_KEY,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

function assertSeedAccess(req: NextRequest) {
  const supplied =
    req.headers.get('x-admin-key') ||
    req.headers.get('x-seed-key') ||
    req.nextUrl.searchParams.get('key') ||
    '';

  const allowed = allowedSeedKeys();

  if (!allowed.length) {
    return { ok: false, status: 500, error: 'missing_seed_admin_key_env' };
  }

  if (!allowed.includes(String(supplied).trim())) {
    return { ok: false, status: 403, error: 'forbidden_seed_admin_key' };
  }

  return { ok: true, status: 200, error: null };
}

async function upsertRole(seed: RoleSeed) {
  const role = await prisma.role.upsert({
    where: { name: seed.name },
    update: {},
    create: { name: seed.name },
  });

  if (seed.scopes.length) {
    await prisma.roleScope.createMany({
      data: seed.scopes.map((scope) => ({
        roleId: role.id,
        scope,
      })),
      skipDuplicates: true,
    });
  }

  return role;
}

async function seedOperatingStructure() {
  const rolesByName = new Map<string, { id: string; name: string }>();

  for (const seed of ROLE_SEEDS) {
    const role = await upsertRole(seed);
    rolesByName.set(role.name, role);
  }

  const departments: Array<{ id: string; name: string }> = [];
  const designations: Array<{ id: string; name: string; departmentId: string }> = [];
  let linksCreatedOrConfirmed = 0;

  for (const deptSeed of DEPARTMENT_SEEDS) {
    const department = await prisma.department.upsert({
      where: { name: deptSeed.name },
      update: { active: deptSeed.active ?? true },
      create: {
        name: deptSeed.name,
        active: deptSeed.active ?? true,
      },
    });

    departments.push({ id: department.id, name: department.name });

    for (const desigSeed of deptSeed.designations) {
      const designation = await prisma.designation.upsert({
        where: {
          departmentId_name: {
            departmentId: department.id,
            name: desigSeed.name,
          },
        },
        update: {},
        create: {
          departmentId: department.id,
          name: desigSeed.name,
        },
      });

      designations.push({
        id: designation.id,
        name: designation.name,
        departmentId: designation.departmentId,
      });

      const links = desigSeed.roles
        .map((roleName) => rolesByName.get(roleName))
        .filter(Boolean)
        .map((role) => ({
          designationId: designation.id,
          roleId: role!.id,
        }));

      if (links.length) {
        await prisma.designationRole.createMany({
          data: links,
          skipDuplicates: true,
        });
        linksCreatedOrConfirmed += links.length;
      }
    }
  }

  return {
    roles: Array.from(rolesByName.values()).length,
    departments: departments.length,
    designations: designations.length,
    designationRoleLinks: linksCreatedOrConfirmed,
  };
}

export async function POST(req: NextRequest) {
  const access = assertSeedAccess(req);

  if (!access.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
      },
      { status: access.status },
    );
  }

  try {
    const summary = await seedOperatingStructure();

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (err: any) {
    console.error('seed operating structure error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'seed_operating_structure_failed',
      },
      { status: 500 },
    );
  }
}
