import { gatewayBase } from '@/src/lib/env';
async function getBias() {
  try {
    const base = gatewayBase();
    const r = await fetch(`${base}/api/insightcore/studio/provenance/bias`, {
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ items: [] }));
    return j.items || [];
  } catch {
    return [];
  }
}

export default async function ProvenanceBiasPage() {
  const items = await getBias();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Measurement bias</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review known measurement-bias flags that should influence evidence weighting and safety review.
        </p>

        <div className="mt-8 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-slate-300">
              No bias records available.
            </div>
          ) : (
            items.map((item: any) => (
              <div key={item.code} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold">{item.label}</div>
                <div className="mt-2 text-sm text-slate-300">
                  {item.code} Â· {item.severity}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
