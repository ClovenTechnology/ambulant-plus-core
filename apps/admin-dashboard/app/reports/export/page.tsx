export default function ExportPage(){
  return (
    <main className="p-6 space-y-2">
      <h1 className="text-lg font-semibold">Monthly Export</h1>
      <p className="text-sm text-gray-600">Download a CSV snapshot of CarePort orders and MedReach reports.</p>
      <a href="/api/analytics/monthly" className="inline-block px-3 py-2 border rounded bg-black text-white text-sm">Download CSV</a>
    </main>
  )
}
