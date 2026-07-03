import { gatewayBase } from '@/src/lib/env';
async function getExecution() {
  try {
    const base = gatewayBase();
    const r = await fetch(`${base}/api/insightcore/studio/evaluation/execution`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({ item: null }));
    return j.item;
  } catch {
    return null;
  }
}

export default async function EvaluationExecutionPage() {
  const item = await getExecution();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight">Execution quality</h1>
        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
          <pre className="overflow-x-auto text-sm text-slate-200">
            {JSON.stringify(item, null, 2)}
          </pre>
        </div>
      </div>
    </main>
  );
}
