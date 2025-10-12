export default function CarePortTrack(){
  const timeline = [
    { t:'2025-08-08 09:12', msg:'Pharmacy selected: MedCare Sandton (2.1km from patient)' },
    { t:'2025-08-08 09:18', msg:'Rider assigned: Sipho R. (1.0km from pharmacy)' },
    { t:'2025-08-08 09:33', msg:'Pharmacy preparing order' },
    { t:'2025-08-08 09:55', msg:'Rider picked up order' },
    { t:'2025-08-08 10:20', msg:'Out for delivery' },
  ]
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">CarePort Delivery Tracking</h1>
      <ul className="text-sm">
        {timeline.map((x,i)=>(
          <li key={i} className="border-l pl-3 ml-2 py-2">
            <div className="text-xs text-gray-500">{x.t}</div>
            <div>{x.msg}</div>
          </li>
        ))}
      </ul>
    </main>
  )
}
