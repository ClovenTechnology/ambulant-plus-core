'use client'
import { useRouter } from 'next/navigation'
import { sdk } from '@/src/lib/sdk'
import { useLiveAppointments } from '@/src/hooks/useLiveAppointments'
import type { Appointment } from '@/lib/types'

export default function AgendaList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (a: Appointment) => void }) {
  const router = useRouter()
  const clinicianId = 'clin-demo' // replace with dynamic clinician ID
  const { appointments, progressMap } = useLiveAppointments(clinicianId)

  const join = async (a: Appointment) => {
    try {
      await sdk.getRtcToken({
        roomName: a.roomName,
        identity: `clinician:${a.clinician.id}`,
        role: 'moderator'
      })
      router.push(`/sfu/${encodeURIComponent(a.roomName)}?appt=${encodeURIComponent(a.id)}`)
    } catch {
      alert('Failed to obtain join token.')
    }
  }

  if (!appointments.length) {
    return <div className="p-4 text-gray-500">No appointments today.</div>
  }

  return (
    <section className="rounded-xl border bg-white/60 backdrop-blur p-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-medium">Agenda</h2>
        <div className="flex-1" />
        <div className="text-sm text-gray-600">{appointments.length} today</div>
      </div>

      <ul className="space-y-2">
        {appointments.map(a => {
          const active = selectedId === a.id
          const statusColor =
            a.status === 'waiting' ? 'bg-amber-500' :
            a.status === 'checked_in' ? 'bg-green-500' :
            a.status === 'no_show' ? 'bg-red-500' : 'bg-slate-500'

          const progress = progressMap[a.id]?.pct ?? 0
          const progStatus = progressMap[a.id]?.status ?? 'pre'
          const progColor =
            progStatus === 'pre' ? '#FBBF24' : progStatus === 'ongoing' ? '#22C55E' : '#EF4444'
          const overrunClass = progStatus === 'overrun' ? 'animate-[shake-subtle_1.2s_infinite]' : ''

          const tooltipText = `${progress.toFixed(0)}% — ${progStatus}`

          return (
            <li key={a.id} className={`rounded-lg border p-3 cursor-pointer transition ${active ? 'border-blue-400 bg-blue-50' : 'hover:bg-gray-50'} ${overrunClass}`} onClick={() => onSelect(a)}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.patient.name}</div>
                  <div className="text-xs text-gray-600 truncate">{a.reason}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Encounter: {a.encounterId ?? 'N/A'}</div>
                </div>
                <div className="text-sm tabular-nums text-gray-700">
                  {new Date(a.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(a.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Mini progress bar with tooltip */}
              <div className="relative h-5 w-full bg-gray-200 rounded-full overflow-hidden" title={tooltipText}>
                <div className="h-5 rounded-full flex items-center justify-center text-xs font-medium text-white transition-all duration-500 ease-linear" style={{ width: `${progStatus==='overrun'?Math.min(progress,150):progress}%`, backgroundColor: progColor, transitionProperty:'width, background-color' }}>
                  {progress.toFixed(0)}%
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={e => { e.stopPropagation(); join(a) }} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100">Join</button>
                <button onClick={e => { e.stopPropagation(); router.push(`/patients/${encodeURIComponent(a.patient.id)}`) }} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-100">View</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
