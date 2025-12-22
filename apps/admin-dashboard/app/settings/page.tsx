// apps/admin-dashboard/app/settings/page.tsx
import Link from 'next/link';
import {
  Settings2,
  User,
  CreditCard,
  ShieldCheck,
  Wallet,
  Users,
  Beaker,
  Pill,
  ShoppingBag,
  BadgeCheck,
  Stethoscope,
  Wrench,
  BrainCircuit,
} from 'lucide-react';

// Import sub-pages as components
import GeneralSettingsPage from './general/page';
import ProfileSettingsPage from './profile/page';
import PlansSettingsPage from './plans/page';
import InsuranceSettingsPage from './insurance/page';
import PayoutSettingsPage from './payouts/page';
import PeopleDepartmentsPage from './people/departments/page';
import PeopleRoleRequestsPage from './people/role-requests/page';
import MedreachSettingsPage from './medreach/page';
import CareportSettingsPage from './careport/page';
import ShopSettingsPage from './shop/page';
import RolesSettingsPage from './roles/page';
import ConsultSettingsPage from './consult/page';
import DevToolsSettingsPage from './dev-tools/page';
import InsightCoreSettingsPage from './insightcore/page';

type TabId =
  | 'general'
  | 'profile'
  | 'plans'
  | 'insurance'
  | 'payouts'
  | 'people'
  | 'medreach'
  | 'careport'
  | 'shop'
  | 'roles'
  | 'consult'
  | 'devtools'
  | 'insightcore';

type PeopleSubTab = 'departments' | 'role-requests';

type SettingsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const TABS: {
  id: TabId;
  label: string;
  description: string;
}[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Tenant name, brand, time zone, and global configuration.',
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'Your operator profile, notifications and security.',
  },
  {
    id: 'plans',
    label: 'Plans',
    description: 'Commercial plans, billing curves and entitlements.',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    description:
      'Medical aid schemes, payer routing and insurance rules.',
  },
  {
    id: 'payouts',
    label: 'Payouts',
    description:
      'Clinician, rider and phleb payout rules across CarePort & MedReach.',
  },
  {
    id: 'people',
    label: 'People',
    description:
      'Departments, access levels and role requests across your organisation.',
  },
  {
    id: 'medreach',
    label: 'MedReach',
    description:
      'Lab partners, home draw rules and MedReach phleb operations.',
  },
  {
    id: 'careport',
    label: 'CarePort',
    description:
      'Pharmacy partners, delivery rules and CarePort fulfilment behaviour.',
  },
  {
    id: 'shop',
    label: 'Shop',
    description:
      'Marketplace catalogue, pricing and availability for telehealth extras.',
  },
  {
    id: 'roles',
    label: 'Roles',
    description:
      'RBAC roles, scopes and administrative capabilities for each persona.',
  },
  {
    id: 'consult',
    label: 'Consult',
    description:
      'Clinical pathways, templates and eRx defaults for consultations.',
  },
  {
    id: 'devtools',
    label: 'Dev-Tools',
    description:
      'API keys, webhooks, sandboxes and developer tooling.',
  },
  {
    id: 'insightcore',
    label: 'InsightCore',
    description:
      'Analytics kernel, data exports and downstream BI integrations.',
  },
];

function iconForTab(id: TabId) {
  const cls = 'h-3.5 w-3.5';
  switch (id) {
    case 'general':
      return <Settings2 className={cls} />;
    case 'profile':
      return <User className={cls} />;
    case 'plans':
      return <CreditCard className={cls} />;
    case 'insurance':
      return <ShieldCheck className={cls} />;
    case 'payouts':
      return <Wallet className={cls} />;
    case 'people':
      return <Users className={cls} />;
    case 'medreach':
      return <Beaker className={cls} />;
    case 'careport':
      return <Pill className={cls} />;
    case 'shop':
      return <ShoppingBag className={cls} />;
    case 'roles':
      return <BadgeCheck className={cls} />;
    case 'consult':
      return <Stethoscope className={cls} />;
    case 'devtools':
      return <Wrench className={cls} />;
    case 'insightcore':
      return <BrainCircuit className={cls} />;
    default:
      return <Settings2 className={cls} />;
  }
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  const tabParam = (Array.isArray(searchParams?.tab)
    ? searchParams?.tab[0]
    : searchParams?.tab) as TabId | undefined;
  const peopleSubParam = (Array.isArray(searchParams?.peopleSub)
    ? searchParams?.peopleSub[0]
    : searchParams?.peopleSub) as PeopleSubTab | undefined;

  const activeTab: TabId =
    TABS.find((t) => t.id === tabParam)?.id ?? 'general';
  const peopleSub: PeopleSubTab =
    peopleSubParam === 'role-requests' ? 'role-requests' : 'departments';

  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  let content: React.ReactNode;
  switch (activeTab) {
    case 'general':
      content = <GeneralSettingsPage />;
      break;
    case 'profile':
      content = <ProfileSettingsPage />;
      break;
    case 'plans':
      content = <PlansSettingsPage />;
      break;
    case 'insurance':
      content = <InsuranceSettingsPage />;
      break;
    case 'payouts':
      content = <PayoutSettingsPage />;
      break;
    case 'people':
      content =
        peopleSub === 'role-requests' ? (
          <PeopleRoleRequestsPage />
        ) : (
          <PeopleDepartmentsPage />
        );
      break;
    case 'medreach':
      content = <MedreachSettingsPage />;
      break;
    case 'careport':
      content = <CareportSettingsPage />;
      break;
    case 'shop':
      content = <ShopSettingsPage />;
      break;
    case 'roles':
      content = <RolesSettingsPage />;
      break;
    case 'consult':
      content = <ConsultSettingsPage />;
      break;
    case 'devtools':
      content = <DevToolsSettingsPage />;
      break;
    case 'insightcore':
      content = <InsightCoreSettingsPage />;
      break;
    default:
      content = <GeneralSettingsPage />;
  }

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how Ambulant+ behaves for your tenant — from plans
            and payouts to MedReach, CarePort and InsightCore.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <div className="inline-flex rounded-full border bg-white px-3 py-1.5 items-center gap-2">
            <span className="text-gray-500">You are editing</span>
            <span className="font-medium text-gray-900">
              {activeMeta.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <Badge>Settings are scoped to this tenant</Badge>
            <Badge>Changes apply in real-time</Badge>
          </div>
        </div>
      </header>

      {/* Tab strip */}
      <section className="rounded-2xl border bg-white p-3 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 overflow-x-auto">
            <nav className="flex gap-1 text-xs min-w-max">
              {TABS.map((t) => {
                const isActive = t.id === activeTab;
                const baseHref = `/settings?tab=${t.id}`;
                const href =
                  t.id === 'people'
                    ? `${baseHref}&peopleSub=${peopleSub}`
                    : baseHref;
                return (
                  <Link
                    key={t.id}
                    href={href}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 border ${
                      isActive
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {iconForTab(t.id)}
                    <span>{t.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Active tab description */}
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>{activeMeta.description}</span>
          {activeTab === 'people' && (
            <span className="hidden sm:inline">
              Manage org structure, then approve role requests to unlock
              access.
            </span>
          )}
        </div>

        {/* People sub-tabs (inline instead of a heavy dropdown) */}
        {activeTab === 'people' && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="inline-flex rounded-full border bg-gray-50 overflow-hidden">
              <Link
                href="/settings?tab=people&peopleSub=departments"
                className={`px-3 py-1.5 border-r last:border-r-0 ${
                  peopleSub === 'departments'
                    ? 'bg-white text-gray-900'
                    : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                Departments
              </Link>
              <Link
                href="/settings?tab=people&peopleSub=role-requests"
                className={`px-3 py-1.5 ${
                  peopleSub === 'role-requests'
                    ? 'bg-white text-gray-900'
                    : 'text-gray-600 hover:bg-white/70'
                }`}
              >
                Role requests
              </Link>
            </div>
            <span className="text-[11px] text-gray-500">
              Tip: map departments first, then approve new operators into
              the right roles.
            </span>
          </div>
        )}
      </section>

      {/* Active tab content */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        {content}
      </section>
    </main>
  );
}
