// apps/admin-dashboard/app/page.tsx
import { HOME_WIDGETS } from '@/src/lib/widgets';
import { hasAnyScope } from '@/src/lib/acl';
import { getSessionFromGateway } from '@/src/lib/session';
import { ArrowRight, Activity, BarChart2, Pill, FlaskConical, Truck, Settings2 } from 'lucide-react';

export const metadata = {
  title: 'Admin Dashboard',
  description: 'Operational command center for Ambulant+',
};

function Card({
  title,
  children,
  href,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
}) {
  const Wrapper: any = href ? 'a' : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="group block rounded-2xl border bg-white/90 p-5 hover:bg-white hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {href && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
            Open
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        )}
      </div>
      <div className="mt-3 text-sm text-gray-700">{children}</div>
    </Wrapper>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

export default async function AdminHome() {
  const session = await getSessionFromGateway(); // calls APIGW /api/auth/me with cookies
  const user = session?.user ?? null;
  const scopes: string[] = user?.scopes ?? [];
  const can = (need: string | string[]) => hasAnyScope(scopes, need as any);

  const visible = HOME_WIDGETS.filter((w) => can(w.requires));
  const totalWidgets = HOME_WIDGETS.length;

  return (
    <main className="min-h-[calc(100vh-64px)] px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-white space-y-6">
      {/* HERO */}
      <section className="rounded-3xl border bg-white/80 backdrop-blur-sm p-6 md:p-7 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Left: Greeting + meta */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Welcome back
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Admin Control Center
            </h1>
            <p className="text-sm text-gray-600">
              {user?.name ? (
                <>
                  Signed in as{' '}
                  <span className="font-medium text-gray-800">
                    {user.name}
                  </span>
                  .{' '}
                </>
              ) : null}
              Your home for CarePort, MedReach, orders, analytics and
              platform configuration.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
              <Badge>
                Widgets: {visible.length} / {totalWidgets} enabled
              </Badge>
              {user?.email && <Badge>{user.email}</Badge>}
              {session?.tenant && (
                <Badge>Tenant: {String(session.tenant)}</Badge>
              )}
            </div>
          </div>

          {/* Right: Quick nav */}
          <div className="flex flex-col gap-3 text-xs min-w-[260px]">
            {/* Analytics quick switch */}
            <div className="rounded-2xl border bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Analytics
                </span>
                <a
                  href="/analytics"
                  className="text-[11px] text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                >
                  Open
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
              <div className="inline-flex rounded-full border bg-white overflow-hidden">
                <a
                  href="/analytics"
                  className="px-3 py-1 border-r bg-gray-900 text-white"
                >
                  Overview
                </a>
                <a
                  href="/analytics/monthly"
                  className="px-3 py-1 border-r hover:bg-gray-50"
                >
                  Monthly
                </a>
                <a
                  href="/analytics/daily"
                  className="px-3 py-1 border-r hover:bg-gray-50"
                >
                  Daily
                </a>
                <a
                  href="/analytics/clinician-payouts"
                  className="px-3 py-1 hover:bg-gray-50"
                >
                  Payouts
                </a>
              </div>
            </div>

            {/* Product shortcuts */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/careport"
                className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
              >
                <Pill className="h-4 w-4 text-indigo-600" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-800">
                    CarePort
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Pharmacy & riders
                  </span>
                </div>
              </a>
              <a
                href="/medreach"
                className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
              >
                <FlaskConical className="h-4 w-4 text-teal-600" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-800">
                    MedReach
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Labs & phlebs
                  </span>
                </div>
              </a>
              <a
                href="/orders"
                className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
              >
                <Truck className="h-4 w-4 text-amber-600" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-800">
                    Orders
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Cross-product
                  </span>
                </div>
              </a>
              <a
                href="/settings"
                className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
              >
                <Settings2 className="h-4 w-4 text-gray-700" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-800">
                    Settings
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Platform config
                  </span>
                </div>
              </a>
            </div>

            {/* Health pulse */}
            <div className="rounded-2xl border bg-white p-3 flex items-center justify-between text-[11px] text-gray-600">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                <span>Platform status nominal</span>
              </div>
              <div className="inline-flex items-center gap-1 text-gray-500">
                <Activity className="h-3.5 w-3.5" />
                <span>Live ops</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WIDGETS GRID (scope-aware) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Personalised widgets based on your scopes.</span>
          {visible.length > 0 && (
            <span>
              Showing{' '}
              <span className="font-medium text-gray-800">
                {visible.length}
              </span>{' '}
              widgets
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((w) => (
            <Card key={w.id} title={w.title} href={w.href}>
              {/* Each widget component is already a small, self-contained UI (with its own data fetch if needed) */}
              {w.component}
            </Card>
          ))}
          {visible.length === 0 && (
            <div className="text-sm text-gray-600 rounded-2xl border bg-white p-6">
              No widgets available for your access level yet. Ask an
              administrator to review your scopes or tenant
              configuration.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
