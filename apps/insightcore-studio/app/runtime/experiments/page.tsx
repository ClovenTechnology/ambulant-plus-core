import { gatewayBase } from '@/src/lib/env';
async function getRuntimeExperiments() {
  try {
    const base = gatewayBase();
    const r = await fetch(`${base}/api/insightcore/studio/runtime/experiments`, {
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ items: [] }));
    return j.items || [];
  } catch {
    return [];
  }
}

export default async function RuntimeExperimentsPage() {
  const items = await getRuntimeExperiments();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Runtime experiments</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Inspect experiment assignments affecting research family execution.
        </p>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
          {items.length > 0 ? (
            <pre className="overflow-x-auto text-sm text-slate-200">
              {JSON.stringify(items, null, 2)}
            </pre>
          ) : (
            <div className="text-slate-300">No runtime experiment assignments available.</div>
          )}
        </div>
      </div>
    </main>
  );
}
