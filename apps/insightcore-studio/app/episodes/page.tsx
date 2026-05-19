async function getEpisodes() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const r = await fetch(`${base}/api/insightcore/studio/episodes`, { cache: 'no-store' });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ items: [] }));
    return j.items || [];
  } catch {
    return [];
  }
}

export default async function EpisodesPage() {
  const items = await getEpisodes();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Episodes</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review grouped clinical episodes, severity state and risk posture.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-slate-300 md:col-span-2 xl:col-span-3">
              No episode records yet.
            </div>
          ) : (
            items.map((item: any) => (
              <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{item.title || 'Episode'}</div>
                    <div className="mt-1 text-sm text-slate-300">{item.syndrome}</div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    {item.severity}
                  </div>
                </div>

                <div className="mt-4 text-sm text-slate-400">Status</div>
                <div className="mt-1 text-base font-medium">{item.status}</div>

                <div className="mt-4 text-sm text-slate-400">Risk score</div>
                <div className="mt-1 text-2xl font-semibold">{item.riskScore}</div>

                <div className="mt-4 text-xs text-slate-500">
                  Updated {item.updatedAt || '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}