async function getBaselineStateDomain() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const r = await fetch(`${base}/api/insightcore/studio/domain/baseline-state`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({ item: null }));
    return j.item;
  } catch {
    return null;
  }
}

export default async function DomainBaselineStatePage() {
  const item = await getBaselineStateDomain();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Baseline state family</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review baseline-state interpretation models and state attribution scaffolding.
        </p>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
          {item ? (
            <pre className="overflow-x-auto text-sm text-slate-200">
              {JSON.stringify(item, null, 2)}
            </pre>
          ) : (
            <div className="text-slate-300">No baseline state domain output yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}