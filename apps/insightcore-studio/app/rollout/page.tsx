import RolloutEditorClient from './RolloutEditorClient';

async function getRollouts() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const [modelsRes, experimentsRes] = await Promise.all([
      fetch(`${base}/api/insightcore/studio/models/rollout`, { cache: 'no-store' }),
      fetch(`${base}/api/insightcore/studio/experiments/active`, { cache: 'no-store' }),
    ]);

    const models = modelsRes.ok ? (await modelsRes.json()).items : [];
    const experiments = experimentsRes.ok ? (await experimentsRes.json()).items : [];
    return { models, experiments };
  } catch {
    return { models: [], experiments: [] };
  }
}

export default async function RolloutPage() {
  const { models, experiments } = await getRollouts();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Rollout control</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review active model rollout posture and currently active experiments.
        </p>

        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">Model rollout</div>
            <div className="mt-4 space-y-3">
              {models.length === 0 ? (
                <div className="text-slate-300">No rollout records available.</div>
              ) : (
                models.map((item: any) => (
                  <div
                    key={`${item.modelId}-${item.version}`}
                    className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{item.modelId}</div>
                      <div className="text-sm text-slate-300">{item.trafficPercent}%</div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      v{item.version} · {item.audience}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold">Active experiments</div>
            <div className="mt-4 space-y-3">
              {experiments.length === 0 ? (
                <div className="text-slate-300">No active experiments.</div>
              ) : (
                experiments.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-[16px] border border-white/10 bg-black/10 px-4 py-3"
                  >
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-300">
                      {item.family} · v{item.version}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <RolloutEditorClient />
        </div>
      </div>
    </main>
  );
}