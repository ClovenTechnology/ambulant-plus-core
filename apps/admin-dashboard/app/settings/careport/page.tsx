// apps/admin-dashboard/app/settings/careport/page.tsx
'use client';

import Link from 'next/link';

type PrescriptionRow = {
  id: string;
  issuedTo: string;
  status: string;
};

type DeliveryTripRow = {
  id: string;
  pharmacy: string;
  rider?: string;
  deliveryFeeZAR: number;
  status: string;
};

type RiderRow = {
  id: string;
  name: string;
  tripsCompleted: number;
  earningsZAR: number;
};

type TripLogRow = {
  rider: string;
  tripId: string;
  amountZAR: number;
  paidAt: string;
};

type PayoutRow = {
  rider: string;
  tripId: string;
  amountZAR: number;
  override: 'Yes' | 'No';
};

export default function CarePortAdminSettingsPage() {
  // lightweight local state for payout config block on the right
  const [defaultRiderPayout, setDefaultRiderPayout] = useState(70);
  const [minDeliveryFee, setMinDeliveryFee] = useState('');
  const [monthlyPharmFee, setMonthlyPharmFee] = useState('');
  const [commissionPerRx, setCommissionPerRx] = useState('');
  const [waiverRulesEnabled, setWaiverRulesEnabled] = useState(true);

  const prescriptions: PrescriptionRow[] = [
    { id: 'RX-00023', issuedTo: 'Dr. Bayo', status: 'Fulfilled' },
  ];

  const deliveryTripsTop: DeliveryTripRow[] = [
    {
      id: 'TR-0302',
      pharmacy: 'MedExpress',
      deliveryFeeZAR: 65,
      status: 'Active',
    },
  ];

  const riders: RiderRow[] = [
    { id: 'RD-004', name: 'Isaac N.', tripsCompleted: 45, earningsZAR: 3220 },
  ];

  const deliveryTripsBottom: DeliveryTripRow[] = [
    {
      id: 'TR-0302',
      pharmacy: 'MedExpress',
      rider: 'Isaac N.',
      deliveryFeeZAR: 65,
      status: 'Completed',
    },
  ];

  const tripLogs: TripLogRow[] = [
    { rider: 'Isaac', tripId: 'TR-302', amountZAR: 45.5, paidAt: '07 Aug' },
  ];

  const payoutsTable: PayoutRow[] = [
    {
      rider: 'Isaac',
      tripId: 'TR-002',
      amountZAR: 45.5,
      override: 'No',
    },
  ];

  return (
    <main className="p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full max-w-xs rounded-xl border bg-white p-4 text-sm lg:h-full lg:w-64">
          <h1 className="px-1 text-base font-semibold">CarePort Admin Panel</h1>
          <nav className="mt-4 space-y-1">
            <NavItem href="/careport" icon="▢">
              Dashboard
            </NavItem>
            <NavItem
              href="/settings/careport"
              icon="▣"
              active
            >
              Prescriptions
            </NavItem>
            <NavItem href="/pharmacies" icon="▢">
              Pharmacies
            </NavItem>
            <NavItem href="/riders" icon="▢">
              Riders
            </NavItem>
            <NavItem href="/careport/orders" icon="▢">
              Delivery Trips
            </NavItem>
            <NavItem href="/careport/analytics" icon="▢">
              Trip Logs
            </NavItem>
            <NavItem href="/settings/payout" icon="▢">
              Payouts
            </NavItem>
            <NavItem href="/settings" icon="▢">
              Settings
            </NavItem>
          </nav>
        </aside>

        {/* Main content column */}
        <section className="flex-1 space-y-4">
          {/* Row 1: Prescriptions + Riders */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Prescriptions */}
            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Prescriptions</h2>
                <div className="flex items-center gap-2 text-xs">
                  <button className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 hover:bg-gray-50">
                    <span>Filter</span>
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 hover:bg-gray-50">
                    <span>Export</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Presc. Ctd
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Issued To
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono">{p.id}</td>
                        <td className="px-3 py-2">{p.issuedTo}</td>
                        <td className="px-3 py-2">{p.status}</td>
                        <td className="px-3 py-2">
                          <button className="text-xs font-medium text-indigo-600 hover:underline">
                            VIEW
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Riders summary */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Riders</h2>
                <button className="rounded-md border bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50">
                  VIEW
                </button>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Rider ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Trips Completed
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Earnings
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono">{r.id}</td>
                        <td className="px-3 py-2">{r.tripsCompleted}</td>
                        <td className="px-3 py-2">
                          R{r.earningsZAR.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Row 2: Delivery Trips + Payout settings */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Delivery Trips (top section) */}
            <Card className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Delivery Trips</h2>
                <button className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs hover:bg-gray-50">
                  Logs
                </button>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Trip ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Pharmacy
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Delivery Fee
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryTripsTop.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono">{t.id}</td>
                        <td className="px-3 py-2">{t.pharmacy}</td>
                        <td className="px-3 py-2">
                          R{t.deliveryFeeZAR.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Payout configuration quick panel */}
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Payouts</h2>
              <div className="space-y-3 text-xs">
                <LabelledField label="Default Rider Payout %">
                  <input
                    type="number"
                    className="w-20 rounded-md border px-2 py-1 text-xs"
                    value={defaultRiderPayout}
                    onChange={(e) =>
                      setDefaultRiderPayout(
                        Number(e.target.value || 0),
                      )
                    }
                  />
                </LabelledField>
                <LabelledField label="Min Delivery Fee">
                  <input
                    type="text"
                    className="w-32 rounded-md border px-2 py-1 text-xs"
                    placeholder="R0.00"
                    value={minDeliveryFee}
                    onChange={(e) =>
                      setMinDeliveryFee(e.target.value)
                    }
                  />
                </LabelledField>
                <LabelledField label="Monthly Pharmacy Access Fee">
                  <input
                    type="text"
                    className="w-32 rounded-md border px-2 py-1 text-xs"
                    placeholder="R0.00"
                    value={monthlyPharmFee}
                    onChange={(e) =>
                      setMonthlyPharmFee(e.target.value)
                    }
                  />
                </LabelledField>
                <LabelledField label="Commission per Fulfilled Rx">
                  <input
                    type="text"
                    className="w-32 rounded-md border px-2 py-1 text-xs"
                    placeholder="R0.00"
                    value={commissionPerRx}
                    onChange={(e) =>
                      setCommissionPerRx(e.target.value)
                    }
                  />
                </LabelledField>
                <LabelledField label="Enable Delivery Fee Waiver Rules">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={waiverRulesEnabled}
                    onChange={(e) =>
                      setWaiverRulesEnabled(e.target.checked)
                    }
                  />
                </LabelledField>
                <p className="mt-2 text-[11px] text-gray-500">
                  These are quick settings for CarePort only. For
                  advanced payout logic, open{' '}
                  <Link
                    href="/settings/payout"
                    className="text-indigo-600 underline"
                  >
                    payout configuration
                  </Link>
                  .
                </p>
              </div>
            </Card>
          </div>

          {/* Row 3: Delivery Trips table + Trip Logs + Payouts history */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Delivery Trips detailed */}
            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                Delivery Trips
              </h2>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Trip ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Rider
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Pharmacy
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Delivery Fee
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryTripsBottom.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono">{t.id}</td>
                        <td className="px-3 py-2">
                          {t.rider ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {t.pharmacy}
                        </td>
                        <td className="px-3 py-2">
                          R{t.deliveryFeeZAR.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Trip Logs */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Trip Logs
                </h2>
                <button className="rounded-md border bg-white px-3 py-1 text-xs hover:bg-gray-50">
                  Export
                </button>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Rider
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Trip ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Paid At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripLogs.map((t) => (
                      <tr key={t.tripId} className="border-b last:border-0">
                        <td className="px-3 py-2">{t.rider}</td>
                        <td className="px-3 py-2 font-mono">
                          {t.tripId}
                        </td>
                        <td className="px-3 py-2">
                          R{t.amountZAR.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">{t.paidAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Payouts history */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Payouts
                </h2>
                <button className="rounded-md border bg-white px-3 py-1 text-xs hover:bg-gray-50">
                  PS
                </button>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full">
                  <thead className="border-b bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Rider
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Trip ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Override
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutsTable.map((p) => (
                      <tr key={p.tripId} className="border-b last:border-0">
                        <td className="px-3 py-2">{p.rider}</td>
                        <td className="px-3 py-2 font-mono">
                          {p.tripId}
                        </td>
                        <td className="px-3 py-2">
                          R{p.amountZAR.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {p.override}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- Small helpers ---------- */

import { ReactNode, useState } from 'react';

function NavItem({
  href,
  children,
  icon,
  active,
}: {
  href: string;
  children: ReactNode;
  icon?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
        active
          ? 'bg-indigo-50 font-medium text-indigo-700'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="text-[10px]">{icon ?? '▢'}</span>
      <span>{children}</span>
    </Link>
  );
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function LabelledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="w-40 text-gray-600">{label}</span>
      <div>{children}</div>
    </label>
  );
}
