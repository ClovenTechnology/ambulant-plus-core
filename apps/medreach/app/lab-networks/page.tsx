'use client';

import { useEffect, useMemo, useState } from 'react';

type NetworkType =
  | 'INDEPENDENT_GROUP'
  | 'CORPORATE_CHAIN'
  | 'FRANCHISE'
  | 'HOLDING_COMPANY';

type BranchType = 'OWNED_BRANCH' | 'FRANCHISE_BRANCH' | 'PARTNER_SITE';

type NetworkStaffRole =
  | 'NETWORK_OWNER'
  | 'NETWORK_ADMIN'
  | 'OPERATIONS'
  | 'FINANCE'
  | 'QUALITY'
  | 'VIEWER';

type StaffStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'REVOKED';

type LabNetwork = {
  id: string;
  legalName: string;
  displayName?: string | null;
  networkType: NetworkType;
  country: string;
  currency: string;
  ownerUserId?: string | null;
  status: string;
  active: boolean;
  counts?: {
    branches?: number;
    staffMembers?: number;
  };
};

type NetworkBranch = {
  id: string;
  networkId?: string | null;
  branchCode?: string | null;
  branchType?: BranchType | null;
  hqVisible: boolean;
  name: string;
  displayName?: string | null;
  city?: string | null;
  province?: string | null;
  country: string;
  currency: string;
  status: string;
  active: boolean;
  counts?: {
    staffMembers?: number;
    jobs?: number;
    financialRecords?: number;
    tests?: number;
    panels?: number;
    specimenBundles?: number;
  };
};

type NetworkStaff = {
  id: string;
  userId: string;
  networkId: string;
  role: NetworkStaffRole;
  active: boolean;
  status: StaffStatus;
  invitedAt?: string | null;
  approvedAt?: string | null;
};

type MoneyTotals = {
  currency: string;
  records: number;
  subtotalCents: number;
  logisticsFeeCents: number;
  urgentSurchargeCents: number;
  coldChainSurchargeCents: number;
  platformFeeCents: number;
  labGrossCents: number;
  phlebGrossCents: number;
  labNetCents: number;
  phlebNetCents: number;
  sponsorAmountMinor: number;
  patientCopayMinor: number;
};

type NetworkSummary = {
  network: LabNetwork;
  totals: {
    branches: number;
    activeBranches: number;
    staffMembers: number;
    jobs: number;
    financialRecords: number;
    tests: number;
    panels: number;
    specimenBundles: number;
  };
  branches: NetworkBranch[];
  revenue?: {
    available: boolean;
    reason?: string | null;
    byCurrency?: MoneyTotals[];
    notes?: string[];
  };
  reviews?: {
    available: boolean;
    reason?: string;
  };
};

const NETWORK_TYPES: NetworkType[] = [
  'INDEPENDENT_GROUP',
  'CORPORATE_CHAIN',
  'FRANCHISE',
  'HOLDING_COMPANY',
];

const BRANCH_TYPES: BranchType[] = [
  'OWNED_BRANCH',
  'FRANCHISE_BRANCH',
  'PARTNER_SITE',
];

const NETWORK_STAFF_ROLES: NetworkStaffRole[] = [
  'NETWORK_OWNER',
  'NETWORK_ADMIN',
  'OPERATIONS',
  'FINANCE',
  'QUALITY',
  'VIEWER',
];

const STAFF_STATUSES: StaffStatus[] = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REJECTED',
  'REVOKED',
];

const ROLE_HELP: Record<NetworkStaffRole, string> = {
  NETWORK_OWNER: 'Owns the network and branch governance layer.',
  NETWORK_ADMIN: 'Can manage network staff, branches and HQ settings.',
  OPERATIONS: 'Can review branch operations and service performance.',
  FINANCE: 'Can review finance-facing branch data when mapped.',
  QUALITY: 'Can review quality, branch visibility and operational safety.',
  VIEWER: 'Read-only network visibility.',
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '-';
  }
}

function formatMoneyMinor(currency: string, amountCents?: number | null) {
  const value = Number(amountCents || 0) / 100;

  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function badgeClass(status: string) {
  if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'PENDING') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'SUSPENDED') return 'border-gray-200 bg-gray-50 text-gray-700';
  if (status === 'REVOKED' || status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';

  return 'border-gray-200 bg-gray-50 text-gray-700';
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
    </div>
  );
}

export default function LabNetworksPage() {
  const [networks, setNetworks] = useState<LabNetwork[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [staff, setStaff] = useState<NetworkStaff[]>([]);

  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [networkDraft, setNetworkDraft] = useState<{
    legalName: string;
    displayName: string;
    networkType: NetworkType;
    country: string;
    currency: string;
  }>({
    legalName: '',
    displayName: '',
    networkType: 'INDEPENDENT_GROUP',
    country: 'ZA',
    currency: 'ZAR',
  });

  const [branchDraft, setBranchDraft] = useState<{
    labId: string;
    branchCode: string;
    branchType: BranchType;
    hqVisible: boolean;
  }>({
    labId: '',
    branchCode: '',
    branchType: 'OWNED_BRANCH',
    hqVisible: true,
  });

  const [staffDraft, setStaffDraft] = useState<{
    userId: string;
    role: NetworkStaffRole;
    status: StaffStatus;
  }>({
    userId: '',
    role: 'VIEWER',
    status: 'PENDING',
  });

  const selectedNetwork = useMemo(
    () => networks.find((network) => network.id === selectedNetworkId) || summary?.network || null,
    [networks, selectedNetworkId, summary],
  );

  async function loadNetworks() {
    setLoadingNetworks(true);
    setErr(null);

    try {
      const res = await fetch('/api/lab-networks?active=true', { cache: 'no-store' });
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Networks HTTP ${res.status}`);
      }

      const rows = Array.isArray(json?.data) ? json.data : [];
      setNetworks(rows);

      if (!selectedNetworkId && rows[0]?.id) {
        setSelectedNetworkId(rows[0].id);
      }
    } catch (e: any) {
      setErr(e?.message || 'Unable to load lab networks');
      setNetworks([]);
    } finally {
      setLoadingNetworks(false);
    }
  }

  async function loadNetworkDetail(networkId = selectedNetworkId) {
    if (!networkId) {
      setSummary(null);
      setStaff([]);
      return;
    }

    setLoadingDetail(true);
    setErr(null);

    try {
      const [summaryRes, staffRes] = await Promise.all([
        fetch(`/api/lab-networks/${encodeURIComponent(networkId)}/summary`, {
          cache: 'no-store',
        }),
        fetch(`/api/lab-networks/${encodeURIComponent(networkId)}/staff`, {
          cache: 'no-store',
        }),
      ]);

      const summaryJson = await summaryRes.json().catch(() => null);
      const staffJson = await staffRes.json().catch(() => null);

      if (!summaryRes.ok || summaryJson?.ok === false) {
        throw new Error(summaryJson?.error || `Summary HTTP ${summaryRes.status}`);
      }

      if (!staffRes.ok || staffJson?.ok === false) {
        throw new Error(staffJson?.error || `Staff HTTP ${staffRes.status}`);
      }

      setSummary(summaryJson?.data || null);
      setStaff(Array.isArray(staffJson?.data) ? staffJson.data : []);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load network detail');
      setSummary(null);
      setStaff([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function createNetwork() {
    const legalName = networkDraft.legalName.trim();

    if (!legalName) {
      setErr('Enter the legal name for the network or HQ group.');
      return;
    }

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch('/api/lab-networks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(networkDraft),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Create network HTTP ${res.status}`);
      }

      const created = json?.data as LabNetwork;

      setNetworkDraft({
        legalName: '',
        displayName: '',
        networkType: 'INDEPENDENT_GROUP',
        country: 'ZA',
        currency: 'ZAR',
      });
      setSelectedNetworkId(created.id);
      setNotice('Lab network created.');
      await loadNetworks();
      await loadNetworkDetail(created.id);
    } catch (e: any) {
      setErr(e?.message || 'Unable to create lab network');
    } finally {
      setSaving(false);
    }
  }

  async function attachBranch() {
    if (!selectedNetworkId) {
      setErr('Select a network before attaching a branch.');
      return;
    }

    const labId = branchDraft.labId.trim();

    if (!labId) {
      setErr('Enter the LabPartner branch ID.');
      return;
    }

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/lab-networks/${encodeURIComponent(selectedNetworkId)}/branches`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(branchDraft),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Attach branch HTTP ${res.status}`);
      }

      setBranchDraft({
        labId: '',
        branchCode: '',
        branchType: 'OWNED_BRANCH',
        hqVisible: true,
      });
      setNotice('Branch attached to network.');
      await loadNetworkDetail();
      await loadNetworks();
    } catch (e: any) {
      setErr(e?.message || 'Unable to attach branch');
    } finally {
      setSaving(false);
    }
  }

  async function updateBranch(
    labId: string,
    body: Partial<Pick<NetworkBranch, 'branchCode' | 'branchType' | 'hqVisible'>>,
  ) {
    if (!selectedNetworkId) return;

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/lab-networks/${encodeURIComponent(selectedNetworkId)}/branches/${encodeURIComponent(labId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Update branch HTTP ${res.status}`);
      }

      setNotice('Branch updated.');
      await loadNetworkDetail();
    } catch (e: any) {
      setErr(e?.message || 'Unable to update branch');
    } finally {
      setSaving(false);
    }
  }

  async function detachBranch(labId: string) {
    if (!selectedNetworkId) return;

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/lab-networks/${encodeURIComponent(selectedNetworkId)}/branches/${encodeURIComponent(labId)}`,
        {
          method: 'DELETE',
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Detach branch HTTP ${res.status}`);
      }

      setNotice('Branch detached from network.');
      await loadNetworkDetail();
      await loadNetworks();
    } catch (e: any) {
      setErr(e?.message || 'Unable to detach branch');
    } finally {
      setSaving(false);
    }
  }

  async function saveStaff() {
    if (!selectedNetworkId) {
      setErr('Select a network before saving staff.');
      return;
    }

    const userId = staffDraft.userId.trim();

    if (!userId) {
      setErr('Enter the network staff user ID.');
      return;
    }

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/lab-networks/${encodeURIComponent(selectedNetworkId)}/staff`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(staffDraft),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Save staff HTTP ${res.status}`);
      }

      setStaffDraft({
        userId: '',
        role: 'VIEWER',
        status: 'PENDING',
      });
      setNotice('Network staff saved.');
      await loadNetworkDetail();
      await loadNetworks();
    } catch (e: any) {
      setErr(e?.message || 'Unable to save network staff');
    } finally {
      setSaving(false);
    }
  }

  async function updateStaff(staffId: string, body: Record<string, unknown>) {
    if (!selectedNetworkId) return;

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/lab-networks/${encodeURIComponent(selectedNetworkId)}/staff/${encodeURIComponent(staffId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Update staff HTTP ${res.status}`);
      }

      setNotice('Network staff updated.');
      await loadNetworkDetail();
    } catch (e: any) {
      setErr(e?.message || 'Unable to update network staff');
    } finally {
      setSaving(false);
    }
  }

  async function revokeStaff(staffId: string) {
    if (!selectedNetworkId) return;

    setSaving(true);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch(
        `/api/lab-networks/${encodeURIComponent(selectedNetworkId)}/staff/${encodeURIComponent(staffId)}`,
        {
          method: 'DELETE',
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Revoke staff HTTP ${res.status}`);
      }

      setNotice('Network staff revoked.');
      await loadNetworkDetail();
    } catch (e: any) {
      setErr(e?.message || 'Unable to revoke network staff');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadNetworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedNetworkId) {
      void loadNetworkDetail(selectedNetworkId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetworkId]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-gray-950 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                MedReach network command
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                Lab HQ, branch and franchise management
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600">
                Manage parent lab networks, corporate chains, franchises and their
                branch-level visibility without mixing branch operations with HQ
                governance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadNetworks();
                if (selectedNetworkId) void loadNetworkDetail();
              }}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {notice}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {err}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Visible branches" value={summary?.totals.branches ?? 0} />
          <StatCard label="Active branches" value={summary?.totals.activeBranches ?? 0} />
          <StatCard label="Network staff" value={summary?.totals.staffMembers ?? staff.length} />
          <StatCard label="Jobs" value={summary?.totals.jobs ?? 0} />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[360px,1fr]">
          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Create network / HQ group</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Use this for multi-branch labs, franchise operators, holding companies
                or corporate chains.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Legal name</span>
                  <input
                    value={networkDraft.legalName}
                    onChange={(e) =>
                      setNetworkDraft((prev) => ({ ...prev, legalName: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder="e.g. Acme Pathology Holdings"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Display name</span>
                  <input
                    value={networkDraft.displayName}
                    onChange={(e) =>
                      setNetworkDraft((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder="Public HQ/group name"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Network type</span>
                  <select
                    value={networkDraft.networkType}
                    onChange={(e) =>
                      setNetworkDraft((prev) => ({
                        ...prev,
                        networkType: e.target.value as NetworkType,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    {NETWORK_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="text-xs font-medium text-gray-600">Country</span>
                    <input
                      value={networkDraft.country}
                      onChange={(e) =>
                        setNetworkDraft((prev) => ({
                          ...prev,
                          country: e.target.value.toUpperCase().slice(0, 2),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="text-xs font-medium text-gray-600">Currency</span>
                    <input
                      value={networkDraft.currency}
                      onChange={(e) =>
                        setNetworkDraft((prev) => ({
                          ...prev,
                          currency: e.target.value.toUpperCase().slice(0, 3),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void createNetwork()}
                  className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Create network'}
                </button>
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Networks</h2>

              <div className="mt-4 flex flex-col gap-2">
                {loadingNetworks ? (
                  <div className="text-sm text-gray-500">Loading networks...</div>
                ) : networks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-4 text-sm text-gray-500">
                    No lab networks are visible yet.
                  </div>
                ) : (
                  networks.map((network) => (
                    <button
                      key={network.id}
                      type="button"
                      onClick={() => setSelectedNetworkId(network.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedNetworkId === network.id
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-950">
                            {network.displayName || network.legalName}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{network.legalName}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${badgeClass(network.status)}`}>
                          {network.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div>{network.networkType}</div>
                        <div className="text-right">
                          {network.counts?.branches ?? 0} branches
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </aside>

          <section className="flex flex-col gap-6">
            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedNetwork
                      ? selectedNetwork.displayName || selectedNetwork.legalName
                      : 'Select a network'}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedNetwork
                      ? `${selectedNetwork.networkType} · ${selectedNetwork.country}/${selectedNetwork.currency}`
                      : 'Create or select a network to view HQ-level branch visibility.'}
                  </p>
                </div>

                {selectedNetwork ? (
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(selectedNetwork.status)}`}>
                    {selectedNetwork.status}
                  </span>
                ) : null}
              </div>

              {loadingDetail ? (
                <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-gray-500">
                  Loading HQ summary...
                </div>
              ) : null}

              {summary ? (
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <StatCard label="Tests" value={summary.totals.tests} />
                  <StatCard label="Panels" value={summary.totals.panels} />
                  <StatCard label="Specimens" value={summary.totals.specimenBundles} />
                  <StatCard label="Finance records" value={summary.totals.financialRecords} />
                </div>
              ) : null}

              {summary?.revenue?.available && summary.revenue.byCurrency?.length ? (
                <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    HQ revenue by currency
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {summary.revenue.byCurrency.map((row) => (
                      <div key={row.currency} className="rounded-2xl border bg-white p-3">
                        <div className="text-xs font-semibold text-gray-500">{row.currency}</div>
                        <div className="mt-2 text-lg font-semibold text-gray-950">
                          {formatMoneyMinor(row.currency, row.labGrossCents)}
                        </div>
                        <div className="text-[11px] text-gray-500">Lab gross</div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {formatMoneyMinor(row.currency, row.labNetCents)}
                            </div>
                            <div>Lab net</div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {formatMoneyMinor(row.currency, row.platformFeeCents)}
                            </div>
                            <div>Platform fee</div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {formatMoneyMinor(row.currency, row.phlebGrossCents)}
                            </div>
                            <div>Phleb gross</div>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{row.records}</div>
                            <div>Finance records</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    Revenue is grouped by currency from MedReachOrderFinancial and keeps lab,
                    phlebotomist and platform values separate.
                  </p>
                </div>
              ) : summary?.revenue?.available === false ? (
                <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-xs leading-5 text-gray-600">
                  {summary.revenue.reason || 'No finance rows exist yet for HQ-visible branches.'}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Attach branch</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Attach an existing LabPartner branch/site to the selected HQ or franchise group.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr,160px,180px,140px]">
                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">LabPartner ID</span>
                  <input
                    value={branchDraft.labId}
                    onChange={(e) =>
                      setBranchDraft((prev) => ({ ...prev, labId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder="lab_xxx"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Branch code</span>
                  <input
                    value={branchDraft.branchCode}
                    onChange={(e) =>
                      setBranchDraft((prev) => ({ ...prev, branchCode: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder="HQ-001"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Branch type</span>
                  <select
                    value={branchDraft.branchType}
                    onChange={(e) =>
                      setBranchDraft((prev) => ({
                        ...prev,
                        branchType: e.target.value as BranchType,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    {BRANCH_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={saving || !selectedNetworkId}
                    onClick={() => void attachBranch()}
                    className="w-full rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                  >
                    Attach
                  </button>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={branchDraft.hqVisible}
                  onChange={(e) =>
                    setBranchDraft((prev) => ({ ...prev, hqVisible: e.target.checked }))
                  }
                />
                Visible to HQ summary
              </label>
            </section>

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Branches</h2>

              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-12 gap-2 border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-4">Branch</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Visibility</div>
                  <div className="col-span-2">Jobs</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {!summary || summary.branches.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No branches attached yet.</div>
                ) : (
                  <div className="divide-y">
                    {summary.branches.map((branch) => (
                      <div
                        key={branch.id}
                        className="grid grid-cols-1 gap-3 px-3 py-3 text-xs md:grid-cols-12 md:items-center"
                      >
                        <div className="md:col-span-4">
                          <div className="font-semibold text-gray-950">
                            {branch.displayName || branch.name}
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-gray-500">
                            {branch.id}
                          </div>
                          <input
                            defaultValue={branch.branchCode || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (branch.branchCode || '')) {
                                void updateBranch(branch.id, { branchCode: e.target.value });
                              }
                            }}
                            className="mt-2 w-full rounded-lg border bg-white px-2 py-1 text-xs"
                            placeholder="Branch code"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <select
                            value={branch.branchType || 'OWNED_BRANCH'}
                            disabled={saving}
                            onChange={(e) =>
                              void updateBranch(branch.id, {
                                branchType: e.target.value as BranchType,
                              })
                            }
                            className="w-full rounded-lg border bg-white px-2 py-1 text-xs"
                          >
                            {BRANCH_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={branch.hqVisible}
                              disabled={saving}
                              onChange={(e) =>
                                void updateBranch(branch.id, {
                                  hqVisible: e.target.checked,
                                })
                              }
                            />
                            HQ visible
                          </label>
                        </div>

                        <div className="text-gray-600 md:col-span-2">
                          <div>{branch.counts?.jobs ?? 0} jobs</div>
                          <div className="text-[11px] text-gray-400">
                            {branch.counts?.staffMembers ?? 0} staff
                          </div>
                        </div>

                        <div className="flex justify-start md:col-span-2 md:justify-end">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void detachBranch(branch.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Detach
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold">Network staff</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Network staff govern HQ-level visibility. Branch staff remain managed from
                branch settings.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr,180px,160px,140px]">
                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">User ID</span>
                  <input
                    value={staffDraft.userId}
                    onChange={(e) =>
                      setStaffDraft((prev) => ({ ...prev, userId: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                    placeholder="user_xxx"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Role</span>
                  <select
                    value={staffDraft.role}
                    onChange={(e) =>
                      setStaffDraft((prev) => ({
                        ...prev,
                        role: e.target.value as NetworkStaffRole,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    {NETWORK_STAFF_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-gray-600">Status</span>
                  <select
                    value={staffDraft.status}
                    onChange={(e) =>
                      setStaffDraft((prev) => ({
                        ...prev,
                        status: e.target.value as StaffStatus,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="ACTIVE">ACTIVE</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={saving || !selectedNetworkId}
                    onClick={() => void saveStaff()}
                    className="w-full rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                  >
                    Save staff
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {NETWORK_STAFF_ROLES.map((role) => (
                  <div key={role} className="rounded-2xl border bg-gray-50 p-3 text-xs">
                    <div className="font-semibold text-gray-900">{role}</div>
                    <div className="mt-1 leading-5 text-gray-500">{ROLE_HELP[role]}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border">
                <div className="grid grid-cols-12 gap-2 border-b bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-4">User</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Invited</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {staff.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No network staff configured.</div>
                ) : (
                  <div className="divide-y">
                    {staff.map((member) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-1 gap-3 px-3 py-3 text-xs md:grid-cols-12 md:items-center"
                      >
                        <div className="md:col-span-4">
                          <div className="font-mono text-gray-950">{member.userId}</div>
                          <div className="mt-1 text-[11px] text-gray-500">{member.id}</div>
                        </div>

                        <div className="md:col-span-2">
                          <select
                            value={member.role}
                            disabled={saving}
                            onChange={(e) =>
                              void updateStaff(member.id, {
                                role: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border bg-white px-2 py-1 text-xs"
                          >
                            {NETWORK_STAFF_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <select
                            value={member.status}
                            disabled={saving}
                            onChange={(e) =>
                              void updateStaff(member.id, {
                                status: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border bg-white px-2 py-1 text-xs"
                          >
                            {STAFF_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="text-gray-500 md:col-span-2">
                          {formatDate(member.invitedAt)}
                        </div>

                        <div className="flex flex-wrap justify-start gap-2 md:col-span-2 md:justify-end">
                          {member.status !== 'ACTIVE' ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void updateStaff(member.id, {
                                  status: 'ACTIVE',
                                })
                              }
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                void updateStaff(member.id, {
                                  status: 'SUSPENDED',
                                })
                              }
                              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                            >
                              Suspend
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={saving || member.status === 'REVOKED'}
                            onClick={() => void revokeStaff(member.id)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}