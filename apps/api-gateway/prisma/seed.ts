// apps/api-gateway/prisma/seed.ts
import { PrismaClient, ShopChannel } from '@prisma/client';
const prisma = new PrismaClient();

// ---------- EXISTING HELPERS (unchanged) ----------
async function upsertClinician(userId: string, displayName: string, feeCents = 60000) {
  await prisma.clinicianProfile.upsert({
    where: { userId },
    update: { displayName, feeCents, currency: 'ZAR' },
    create: { userId, displayName, feeCents, currency: 'ZAR' },
  });

  await prisma.clinicianSchedule.upsert({
    where: { userId },
    update: {
      country: 'ZA',
      timezone: 'Africa/Johannesburg',
      template: JSON.stringify({}),
      exceptions: JSON.stringify({}),
    },
    create: {
      userId,
      country: 'ZA',
      timezone: 'Africa/Johannesburg',
      template: JSON.stringify({}),
      exceptions: JSON.stringify({}),
    },
  });

  await prisma.clinicianConsultSettings.upsert({
    where: { userId },
    update: {
      defaultStandardMin: 45,
      defaultFollowupMin: 20,
      minAdvanceMinutes: 30,
      maxAdvanceDays: 30,
    },
    create: {
      userId,
      defaultStandardMin: 45,
      defaultFollowupMin: 20,
      minAdvanceMinutes: 30,
      maxAdvanceDays: 30,
    },
  });

  await prisma.clinicianRefundPolicy.upsert({
    where: { userId },
    update: {
      within24hPercent: 50,
      noShowPercent: 0,
      clinicianMissPercent: 100,
      networkProrate: true,
    },
    create: {
      userId,
      within24hPercent: 50,
      noShowPercent: 0,
      clinicianMissPercent: 100,
      networkProrate: true,
    },
  });
}

const FALLBACK_IMAGE = '/images/shop/_placeholder.png';

type SeedVariant = {
  sku: string;
  label: string;
  unitAmountZar: number;
  saleUnitAmountZar?: number;
  imageUrl?: string;
  inStock?: boolean;
  stockQty?: number | null;
  allowBackorder?: boolean | null;
  channels?: ShopChannel[];
};

type SeedProduct = {
  slug: string;
  name: string;
  description?: string;
  type?: string;
  tags?: string[];
  images?: string[];
  fallbackImage?: string;
  active?: boolean;
  unitAmountZar?: number | null;
  saleAmountZar?: number | null;
  allowBackorder?: boolean;
  maxQtyPerOrder?: number;
  channels?: ShopChannel[];
  variants?: SeedVariant[];
};

const CATALOG: SeedProduct[] = [
  // ... (UNCHANGED – keep your full catalog from the previous seed)
  // For brevity here, keep your catalog items as-is
];

async function setProductChannels(productId: string, channels: ShopChannel[]) {
  await prisma.shopProductChannel.deleteMany({ where: { productId } }).catch(() => {});
  if (channels.length) {
    await prisma.shopProductChannel.createMany({
      data: channels.map((c) => ({ productId, channel: c })),
      skipDuplicates: true,
    }).catch(() => {});
  }
}

async function setVariantChannels(variantId: string, channels: ShopChannel[]) {
  await prisma.shopVariantChannel.deleteMany({ where: { variantId } }).catch(() => {});
  if (channels.length) {
    await prisma.shopVariantChannel.createMany({
      data: channels.map((c) => ({ variantId, channel: c })),
      skipDuplicates: true,
    }).catch(() => {});
  }
}

async function seedInitMovementOnce(variantId: string, sku: string, qty: number) {
  const note = `seed_init:${sku}`;
  const exists = await prisma.shopInventoryMovement.findFirst({
    where: { variantId, reason: 'seed_init', note },
    select: { id: true },
  }).catch(() => null);
  if (exists) return;

  await prisma.shopInventoryMovement.create({
    data: { variantId, delta: qty, reason: 'seed_init', note },
  }).catch(() => {});
}

async function seedShop() {
  for (const p of CATALOG) {
    const images = (p.images || []).filter(Boolean);
    const fallbackImage = p.fallbackImage || images[0] || FALLBACK_IMAGE;

    const product = await prisma.shopProduct.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description || null,
        type: p.type || 'merch',
        tags: p.tags || [],
        images,
        fallbackImage,
        active: p.active ?? true,
        unitAmountZar: p.unitAmountZar ?? null,
        saleAmountZar: p.saleAmountZar ?? null,
        allowBackorder: p.allowBackorder ?? false,
        maxQtyPerOrder: p.maxQtyPerOrder ?? 99,
        meta: { seeded: true },
      },
      update: {
        name: p.name,
        description: p.description || null,
        type: p.type || 'merch',
        tags: p.tags || [],
        images,
        fallbackImage,
        active: p.active ?? true,
        unitAmountZar: p.unitAmountZar ?? null,
        saleAmountZar: p.saleAmountZar ?? null,
        allowBackorder: p.allowBackorder ?? false,
        maxQtyPerOrder: p.maxQtyPerOrder ?? 99,
        meta: { seeded: true },
      },
    });

    await setProductChannels(product.id, p.channels || []);

    for (const v of p.variants || []) {
      const variant = await prisma.shopVariant.upsert({
        where: { sku: v.sku },
        create: {
          productId: product.id,
          sku: v.sku,
          label: v.label,
          unitAmountZar: v.unitAmountZar,
          saleUnitAmountZar: v.saleUnitAmountZar ?? null,
          imageUrl: v.imageUrl || null,
          active: true,
          inStock: v.inStock ?? true,
          stockQty: v.stockQty ?? null,
          allowBackorder: v.allowBackorder ?? null,
          meta: { seeded: true },
        },
        update: {
          productId: product.id,
          label: v.label,
          unitAmountZar: v.unitAmountZar,
          saleUnitAmountZar: v.saleUnitAmountZar ?? null,
          imageUrl: v.imageUrl || null,
          active: true,
          inStock: v.inStock ?? true,
          stockQty: v.stockQty ?? null,
          allowBackorder: v.allowBackorder ?? null,
          meta: { seeded: true },
        },
      });

      await setVariantChannels(variant.id, v.channels || []);
      if (typeof v.stockQty === 'number') {
        await seedInitMovementOnce(variant.id, v.sku, v.stockQty);
      }
    }
  }
}

// ---------- NEW: RBAC seed ----------

const ROLE_PRESETS: Record<string, string[]> = {
  'Super Admin': [
    'admin:all', 'org:write', 'org:read', 'users:write', 'users:read',
    'hr', 'finance', 'medical', 'tech', 'compliance', 'reports', 'rnd',
    'settings:write', 'settings:read'
  ],
  'Admin': [
    'org:read', 'users:read', 'users:write', 'settings:read',
    'reports', 'compliance'
  ],
  'Medical': ['medical', 'reports'],
  'Tech & IT': ['tech', 'settings:read', 'reports'],
  'Finance': ['finance', 'reports'],
  'HR': ['hr', 'users:write', 'reports'],
  'Compliance': ['compliance', 'reports'],
  'Reports & Research': ['reports'],
  'R&D': ['rnd', 'reports'],
};

async function seedRoles() {
  const roleIdByName = new Map<string, string>();
  for (const name of Object.keys(ROLE_PRESETS)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
      select: { id: true, name: true },
    });
    roleIdByName.set(name, role.id);
  }
  for (const [name, scopes] of Object.entries(ROLE_PRESETS)) {
    const id = roleIdByName.get(name)!;
    await prisma.roleScope.deleteMany({ where: { roleId: id } });
    if (scopes.length) {
      await prisma.roleScope.createMany({
        data: scopes.map(scope => ({ roleId: id, scope })),
        skipDuplicates: true,
      });
    }
  }
  return roleIdByName;
}

async function seedDepartmentsAndDesignations(roleIdByName: Map<string,string>) {
  // Departments
  const exec = await prisma.department.upsert({
    where: { name: 'Executive' },
    create: { name: 'Executive', active: true },
    update: {},
  });
  const finance = await prisma.department.upsert({
    where: { name: 'Finance' },
    create: { name: 'Finance', active: true },
    update: {},
  });
  const tech = await prisma.department.upsert({
    where: { name: 'Tech & IT' },
    create: { name: 'Tech & IT', active: true },
    update: {},
  });

  const mkDesig = async (departmentId: string, name: string) =>
    prisma.designation.upsert({
      where: { departmentId_name: { departmentId, name } },
      update: {},
      create: { departmentId, name },
    });

  // Executive designations
  const CEO  = await mkDesig(exec.id, 'CEO');
  const CFO  = await mkDesig(exec.id, 'CFO');
  const COO  = await mkDesig(exec.id, 'COO');
  const CTO  = await mkDesig(exec.id, 'CTO');
  const CMO  = await mkDesig(exec.id, 'CMO');
  const CCO  = await mkDesig(exec.id, 'CCO');

  // Finance designations
  const Accountant      = await mkDesig(finance.id, 'Accountant');
  const ChiefAccountant = await mkDesig(finance.id, 'Chief Accountant');
  const Auditor         = await mkDesig(finance.id, 'Auditor');
  const BookKeeper      = await mkDesig(finance.id, 'Book Keeper');

  // Tech designations
  const SWE       = await mkDesig(tech.id, 'Software Engineer');
  const Developer = await mkDesig(tech.id, 'Developer');
  const UIUX      = await mkDesig(tech.id, 'UI/UX Designer');
  const Scrum     = await mkDesig(tech.id, 'Scrum Master');
  const SecSpec   = await mkDesig(tech.id, 'Cyber Security Specialist');
  const SrProg    = await mkDesig(tech.id, 'Senior Programmer');
  const JrProg    = await mkDesig(tech.id, 'Junior Programmer');

  // Map designations -> roles
  const link = async (designationId: string, roleNames: string[]) => {
    await prisma.designationRole.deleteMany({ where: { designationId } });
    if (roleNames.length) {
      await prisma.designationRole.createMany({
        data: roleNames.map(n => ({ designationId, roleId: roleIdByName.get(n)! })),
        skipDuplicates: true,
      });
    }
  };

  // Executive mappings
  await link(CEO.id, ['Super Admin']);
  await link(CFO.id, ['Finance', 'Admin']);
  await link(COO.id, ['Admin']);
  await link(CTO.id, ['Tech & IT', 'Admin']);
  await link(CMO.id, ['Reports & Research', 'Admin']);
  await link(CCO.id, ['Compliance', 'Admin']);

  // Finance mappings
  await link(Accountant.id, ['Finance']);
  await link(ChiefAccountant.id, ['Finance', 'Admin']);
  await link(Auditor.id, ['Finance', 'Compliance']);
  await link(BookKeeper.id, ['Finance']);

  // Tech mappings
  await link(SWE.id, ['Tech & IT', 'Reports & Research']);
  await link(Developer.id, ['Tech & IT']);
  await link(UIUX.id, ['Tech & IT']);
  await link(Scrum.id, ['Tech & IT', 'Admin']);
  await link(SecSpec.id, ['Tech & IT', 'Compliance']);
  await link(SrProg.id, ['Tech & IT']);
  await link(JrProg.id, ['Tech & IT']);
}

// ---------- MAIN ----------
async function main() {
  // clinicians & settings
  await upsertClinician('clin-za-001', 'Dr A', 60000);
  await upsertClinician('clin-za-002', 'Dr B', 70000);
  console.log('Seeded clinicians + settings.');

  // shop
  await seedShop();
  console.log('Seeded shop catalog.');

  // RBAC
  const roleIdByName = await seedRoles();
  await seedDepartmentsAndDesignations(roleIdByName);
  console.log('Seeded RBAC: roles, scopes, departments, designations, mappings.');

  // (Optional) a demo AdminUserProfile for testing /auth/me
  await prisma.adminUserProfile.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      userId: 'admin-user-1',
      email: 'admin@example.com',
      name: 'Admin Example',
      // Put them in Executive/CTO to inherit Tech & IT + Admin
      department: { connect: { name: 'Executive' } },
      designation: {
        connect: { departmentId_name: { departmentId: (await prisma.department.findUnique({ where: { name: 'Executive' } }))!.id, name: 'CTO' } }
      },
    },
  });

  // Give direct extra role too (e.g., Reports) for testing additive union
  const reports = await prisma.role.findUnique({ where: { name: 'Reports & Research' } });
  if (reports) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: 'admin-user-1', roleId: reports.id } },
      update: {},
      create: { userId: 'admin-user-1', roleId: reports.id },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed failed', e);
    await prisma.$disconnect();
    process.exit(1);
  });
