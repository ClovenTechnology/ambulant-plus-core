'use client'
import { useSearchParams } from 'next/navigation'
export default function ReorderTest(){
  const query = useSearchParams()
  const reportId = query.get('reportId')
  return (<main className="p-6 space-y-3">
    <h1 className="text-lg font-semibold">Reorder Test</h1>
    <div className="text-sm">We will route this request to another MedReach lab with confirmed availability.</div>
    <div className="text-sm">Report: {reportId || 'â€”'}</div>
    <div className="text-sm text-gray-500">Stub view â€” integrate with lab marketplace in next patch.</div>
  </main>)
}
