'use client'
import { useState } from 'react'
import { useLiveAppointments } from '@/src/hooks/useLiveAppointments'
import type { Appointment } from '@/lib/types'

export default function Dashboard() {
  const [tab, setTab] = useState<'General'|'Specialist'|'Premium Only'>('General')
  const clinicianId = 'clin-demo'
  const { appointments, progressMap } = useLiveAppointments(clinicianId)

  const filteredQueue = appointments.filter(a => {
    // Optional: filter by tab if needed (priority/category mapping)
    return true
  })

  const statusLabel = (status: 'pre'|'ongoing'|'overrun') => status==='pre'?'Pre-start':status==='ongoing'?'Ongoing':'Overrun'
  const shakeClass = "animate-[shake-subtle_1.2s_infinite]"

  return (
    <main className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Clinician Dashboard</h2>
      <div className="flex gap-2 text-sm">
        {(['General','Specialist','Premium Only'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1 border rounded transition-colors duration-200 ${tab===t?'bg-black text-white':'bg-white hover:bg-gray-100'}`}>{t}</button>
        ))}
      </div>

      <div className="border rounded">
        <div className="p-2 text-sm bg-gray-50 border-b font-medium">Queue — {tab}</div>
        <ul className="divide-y">
          {filteredQueue.map(item => {
            const progress = progressMap[item.id]?.pct ?? 0
            const status = progressMap[item.id]?.status ?? 'pre'
            const progColor = status==='pre'?'#FBBF24':status==='ongoing'?'#22C55E':'#EF4444'
            const overrunClass = status==='overrun'?shakeClass:''
            const tooltipText = `${progress.toFixed(0)}% — ${statusLabel(status)}`

            return (
              <li key={item.id} className={`p-3 flex flex-col gap-2 hover:bg-gray-50 transition-colors duration-200 ${overrunClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.patient.name}</div>
                    <div className="text-xs text-gray-600">{item.reason}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 border rounded font-semibold ${item.priority==='High'?'bg-red-100 text-red-700 border-red-200':'bg-gray-100 text-gray-700 border-gray-200'}`}>{item.priority}</div>
                </div>

                {item.start && item.end && (
                  <div className="relative h-4 w-full bg-gray-200 rounded-full overflow-hidden" title={tooltipText}>
                    <div className="h-4 rounded-full flex items-center justify-center text-xs font-medium text-white transition-all duration-500 ease-linear" style={{ width: `${status==='overrun'?Math.min(progress,150):progress}%`, backgroundColor: progColor, transitionProperty:'width, background-color' }}>
                      {progress.toFixed(0)}%
                    </div>
                  </div>
                )}
              </li>
            )
          })}
          {filteredQueue.length===0 && <li className="p-3 text-sm text-gray-500">No patients in queue.</li>}
        </ul>
      </div>
    </main>
  )
}
