async function getRuntimePolicy() {
  try {
    const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';
    const r = await fetch(`${base}/api/insightcore/studio/governance/runtime-policy`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({ item: null }));
    return j.item;
  } catch {
    return null;
  }
}

export default async function GovernanceRuntimePolicyPage() {
  const item = await getRuntimePolicy();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold tracking-tight">Runtime policy</h1>
        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5">
          <pre className="overflow-x-auto text-sm text-slate-200">{JSON.stringify(item, null, 2)}</pre>
        </div>
      </div>
    </main>
  );
}