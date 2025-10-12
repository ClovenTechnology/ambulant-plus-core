\"use client\";
import { useEffect, useState } from \"react\";
function Timeline({ kind }: { kind:\"medreach\"|\"medreach\" }){
  const [items, setItems] = useState<any[]>([]);
  const [id, setId] = useState<string>(kind === \"medreach\" ? \"ERX-1001\" : \"LAB-2001\");
  useEffect(()=>{
    (async ()=>{
      const res = await fetch(`/api/${kind}/timeline?id=${encodeURIComponent(id)}`, { cache:\"no-store\" });
      const data = await res.json();
      setItems(data.timeline||[]);
    })();
  }, [id, kind]);
  return (
    <main className=\"p-6 space-y-4\">
      <h1 className=\"text-xl font-semibold\">{kind === \"medreach\" ? \"MedReach Phlebotomist Timeline\" : \"MedReach Phlebotomist Timeline\"}</h1>
      <input className=\"border px-2 py-1 rounded\" value={id} onChange={e=>setId(e.target.value)} />
      <ul className=\"space-y-2 text-sm\">
        {items.map((it, i)=>(
          <li key={i} className=\"p-2 border rounded flex justify-between\">
            <span>{it.status.replaceAll(\"_\",\" \")}</span>
            <span className=\"text-gray-500\">{new Date(it.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
export default function Page(){ return <Timeline kind=\"medreach\"/>; }
