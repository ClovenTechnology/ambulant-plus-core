// apps/patient-app/app/encounters/page.tsx
type Encounter = { id:string; caseId:string; start:string; mode?:string };
type Case = { id:string; title?:string; status:'Open'|'Closed'|'Referred'; updatedAt:string; latestEncounter?:Encounter };

function groupEncountersIntoCases(encs: Encounter[]): Case[] {
  const map: Record<string, Case> = {};
  for (const e of encs) {
    const c = map[e.caseId] ?? (map[e.caseId] = { id: e.caseId, status:'Open', updatedAt:e.start });
    if (!c.latestEncounter || new Date(e.start) > new Date(c.latestEncounter.start)) {
      c.latestEncounter = e; c.updatedAt = e.start;
    }
  }
  return Object.values(map).sort((a,b)=>+new Date(b.updatedAt)-+new Date(a.updatedAt));
}

function makeMockCases(): Case[] {
  const now = Date.now();
  const mk = (i:number, status:Case['status']): Case => ({
    id: `C-${1000+i}`,
    title: ['Headache & Fever','Follow-up: Hypertension','Persistent Cough'][i],
    status,
    updatedAt: new Date(now - i*36e5).toISOString(),
    latestEncounter: { id:`E-${2000+i}`, caseId:`C-${1000+i}`, start:new Date(now - i*36e5).toISOString(), mode: i===1?'Video':'Chat' }
  });
  return [mk(0,'Open'), mk(1,'Closed'), mk(2,'Referred')];
}

export default async function EncountersPage() {
  let items: Case[] = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/encounters`, { cache: 'no-store' });
    const data = await res.json();
    items = Array.isArray(data?.cases) ? data.cases
          : Array.isArray(data?.encounters) ? groupEncountersIntoCases(data.encounters)
          : [];
  } catch {}

  if (!items || items.length === 0) items = makeMockCases();

  return (
    <main className="space-y-4">
      <h1 className="text-xl font-semibold">My Cases</h1>
      <ul className="space-y-3">
        {items.map(c=>(
          <li key={c.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.title ?? `Case #${c.id}`}</div>
              <span className={`text-xs px-2 py-0.5 rounded ${c.status==='Open'?'bg-green-100 text-green-700': c.status==='Referred' ? 'bg-amber-100 text-amber-800':'bg-zinc-100 text-zinc-700'}`}>{c.status}</span>
            </div>
            <div className="text-sm text-zinc-500">Updated {new Date(c.updatedAt).toLocaleString()}</div>
            {c.latestEncounter && (
              <div className="text-[13px] mt-1 text-zinc-600">
                Last encounter: {new Date(c.latestEncounter.start).toLocaleString()} Â· {c.latestEncounter.mode ?? 'â€”'}
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
