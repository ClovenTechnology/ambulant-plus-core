import GovernanceEditorClient from './GovernanceEditorClient';

async function getGovernance() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const [weightsRes, pathwaysRes] = await Promise.all([
      fetch(`${base}/api/insightcore/studio/governance/weights`, { cache: 'no-store' }),
      fetch(`${base}/api/insightcore/studio/governance/pathways`, { cache: 'no-store' }),
    ]);

    const weights = weightsRes.ok ? (await weightsRes.json()).items : [];
    const pathways = pathwaysRes.ok ? (await pathwaysRes.json()).items : [];
    return { weights, pathways };
  } catch {
    return { weights: [], pathways: [] };
  }
}

export default async function GovernancePage() {
  const { weights, pathways } = await getGovernance();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Governance</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review current rule-weight baselines and pathway activation state.
        </p>

        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">Rule weights</div>
            <div className="mt-4 space-y-3">
              {weights.length === 0 ? (
                <div className="text-slate-300">No weights available.</div>
              ) : (
                weights.map((item: any) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-[16px] border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <div className="text-sm text-slate-200">{item.key}</div>
                    <div className="text-sm font-medium">{item.value}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">Pathways</div>
            <div className="mt-4 space-y-3">
              {pathways.length === 0 ? (
                <div className="text-slate-300">No pathways available.</div>
              ) : (
                pathways.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-slate-300">
                        {item.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{item.description}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <GovernanceEditorClient />
        </div>
      </div>
    </main>
  );
}