// apps/clinician-app/src/hooks/useLiveAppointments.ts
import { useEffect, useState } from 'react'
import type { Appointment } from '@/lib/types'

export function useLiveAppointments(clinicianId: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, { pct: number; status: 'pre'|'ongoing'|'overrun' }>>({})

  // Fetch live appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch(`/api/_proxy/appointments?clinicianId=${encodeURIComponent(clinicianId)}`)
        if (!res.ok) throw new Error('Failed to fetch appointments')
        const data: Appointment[] = await res.json()
        setAppointments(data)
      } catch (e) {
        console.error(e)
        setAppointments([]) // fallback: empty list
      }
    }

    fetchAppointments()
    const interval = setInterval(fetchAppointments, 30_000) // refresh every 30s
    return () => clearInterval(interval)
  }, [clinicianId])

  // Live progress updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newProgress: typeof progressMap = {}

      appointments.forEach(a => {
        const start = new Date(a.start).getTime()
        const end = new Date(a.end).getTime()

        let pct = 0
        let status: 'pre' | 'ongoing' | 'overrun' = 'pre'

        if (now < start) {
          pct = 0
          status = 'pre'
        } else if (now >= start && now <= end) {
          pct = ((now - start) / (end - start)) * 100
          status = 'ongoing'
        } else {
          pct = ((now - end) / (end - start)) * 100
          status = 'overrun'
        }

        newProgress[a.id] = { pct, status }
      })

      setProgressMap(newProgress)
    }, 500)

    return () => clearInterval(interval)
  }, [appointments])

  return { appointments, progressMap }
}
