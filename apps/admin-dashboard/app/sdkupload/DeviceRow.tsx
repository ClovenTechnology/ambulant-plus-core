'use client'
export default function DeviceRow({d, onToggle}:{d:any; onToggle:(id:string, field:'active'|'mode', value:any)=>void}){
  return (
    <tr key={d.id} className="border-t">
      <td className="py-2">{d.name}</td>
      <td className="uppercase">{d.mode}</td>
      <td>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.active} onChange={e=>onToggle(d.id,'active',e.target.checked)} />
          <span>{d.active? 'Active':'Inactive'}</span>
        </label>
      </td>
      <td className="truncate">{(d.streams||[]).join(", ")}</td>
      <td className="text-right">
        <button className="px-2 py-1 border rounded mr-2" onClick={()=>onToggle(d.id,'mode', d.mode==='mock'?'live':'mock')}>Switch to {d.mode==='mock'?'Live':'Mock'}</button>
      </td>
    </tr>
  )
}
