async function getLineage() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const r = await fetch(`${base}/api/insightcore/studio/lineage?patientId=pt-za-001`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({ item: null }));
    return j.item;
  } catch {
    return null;
  }
}

export default async function LineagePage() {
  const lineage = await getLineage();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Model and rule lineage</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Track engine versions, pathway usage and rule participation across generated outputs.
        </p>

        {!lineage ? (
          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5 text-slate-300">
            No lineage record yet.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">Patient</div>
              <div className="mt-2 text-lg font-semibold">{lineage.patientId}</div>
              <div className="mt-4 text-sm text-slate-400">Generated</div>
              <div className="mt-1 text-sm text-slate-300">{lineage.generatedAt}</div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 xl:col-span-2">
              <div className="text-sm text-slate-400">Pathways applied</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(lineage.pathwaysApplied || []).length > 0 ? (
                  lineage.pathwaysApplied.map((p: string) => (
                    <span key={p} className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200">
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-300">No pathway record yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 xl:col-span-3">
              <div className="text-sm text-slate-400">Experiments</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(lineage.experiments || []).length > 0 ? (
                  lineage.experiments.map((exp: string) => (
                    <span key={exp} className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200">
                      {exp}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-300">No experiment record yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 xl:col-span-3">
              <div className="text-sm text-slate-400">Engines run</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(lineage.enginesRun || []).map((engine: any) => (
                  <div key={engine.id} className="rounded-[18px] border border-white/10 bg-black/10 p-4">
                    <div className="font-medium">{engine.title}</div>
                    <div className="mt-1 text-sm text-slate-300">{engine.id}</div>
                    <div className="mt-2 text-xs text-slate-500">{engine.category} · v{engine.version}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 xl:col-span-3">
              <div className="text-sm text-slate-400">Rules applied</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(lineage.rulesApplied || []).map((rule: any) => (
                  <div key={rule.id} className="rounded-[18px] border border-white/10 bg-black/10 p-4">
                    <div className="font-medium">{rule.title}</div>
                    <div className="mt-1 text-sm text-slate-300">{rule.id}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {rule.family} · {rule.source} · v{rule.version}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}