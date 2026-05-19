async function getFamilies() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const r = await fetch(`${base}/api/insightcore/studio/pathways/families`, {
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ items: [] }));
    return j.items || [];
  } catch {
    return [];
  }
}

export default async function PathwaysPage() {
  const items = await getFamilies();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Pathway families</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Review deployment and research pathway family groupings.
        </p>

        <div className="mt-8 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-slate-300">
              No pathway families available.
            </div>
          ) : (
            items.map((item: any) => (
              <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold">{item.title}</div>
                <div className="mt-1 text-sm text-slate-300">{item.description}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(item.members || []).map((member: any) => (
                    <span
                      key={member.id}
                      className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200"
                    >
                      {member.title} · {member.kind}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}