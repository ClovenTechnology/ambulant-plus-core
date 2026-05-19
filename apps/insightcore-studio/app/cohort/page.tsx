async function getCohort() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const r = await fetch(`${base}/api/insightcore/studio/cohort`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export default async function CohortPage() {
  const data = await getCohort();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">InsightCore Studio</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Cohort</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Inspect cohort-level episode and alert intelligence summaries.
        </p>

        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
          {data ? (
            <pre className="overflow-x-auto text-sm text-slate-200">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="text-slate-300">No cohort summary yet.</div>
          )}
        </div>
      </div>
    </main>
  );
}