//apps/clinician-app/app/workspaces/page.tsx
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// --- Workspace Registry Model ---
export type WorkspaceDef = {
  key: string
  name: string
  route: string
  description: string
  enabled: boolean
}

const WORKSPACES: WorkspaceDef[] = [
  { key: 'cardiology', name: 'Cardiology', route: '/workspaces/cardiology', description: 'Cardiac diagnostics, monitoring and care', enabled: true },
  { key: 'dental', name: 'Dental', route: '/workspaces/dental', description: 'Oral diagnostics, imaging and procedures', enabled: true },
  { key: 'dermatology', name: 'Dermatology', route: '/workspaces/dermatology', description: 'Skin, tissue and dermatological care', enabled: true },
  { key: 'endocrinology', name: 'Endocrinology', route: '/workspaces/endocrinology', description: 'Hormonal, metabolic and endocrine care', enabled: true },
  { key: 'ent', name: 'ENT', route: '/workspaces/ent', description: 'Ear, nose and throat care', enabled: true },
  { key: 'fertility', name: 'Fertility', route: '/workspaces/fertility', description: 'Reproductive health and fertility services', enabled: true },
  { key: 'neurology', name: 'Neurology', route: '/workspaces/neurology', description: 'Neuro diagnostics and monitoring', enabled: true },
  { key: 'obgyn', name: 'Obstetrics & Gynaecology', route: '/workspaces/obgyn', description: 'Women’s health, pregnancy and reproductive care', enabled: true },
  { key: 'occupational-therapy', name: 'Occupational Therapy', route: '/workspaces/occupational-therapy', description: 'Functional rehabilitation and daily living support', enabled: true },
  { key: 'oncology', name: 'Oncology', route: '/workspaces/oncology', description: 'Cancer care and treatment workflows', enabled: true },
  { key: 'optometry', name: 'Optometry', route: '/workspaces/optometry', description: 'Vision care and eye health services', enabled: true },
  { key: 'speech-therapy', name: 'Speech Therapy', route: '/workspaces/speech-therapy', description: 'Speech, language and communication therapy', enabled: true },
  { key: 'paediatric', name: 'Paediatric Care', route: '/workspaces/paediatric', description: 'Child and adolescent healthcare services', enabled: true },
  { key: 'physio', name: 'Physiotherapy', route: '/workspaces/physio', description: 'Physical rehabilitation and mobility care', enabled: true },
  { key: 'std', name: 'STD Clinic', route: '/workspaces/std', description: 'Sexual health and infectious disease services', enabled: true },
  { key: 'substance-abuse', name: 'Substance Abuse', route: '/workspaces/substance-abuse', description: 'Addiction treatment and recovery services', enabled: true },
  { key: 'radiology', name: 'Radiology', route: '/workspaces/radiology', description: 'Imaging, X-ray and diagnostic radiology', enabled: true },
{ key: 'surgery', name: 'Surgery', route: '/workspaces/surgery', description: 'Peri-op planning, procedure events and post-op care', enabled: true },
{ key: 'urology', name: 'Urology', route: '/workspaces/urology', description: 'Genitourinary diagnostics and procedural workflows', enabled: true },
{ key: 'general-practice', name: 'General Practice', route: '/workspaces/general-practice', description: 'Primary care for virtual and in-person visits', enabled: true }
]

export default function WorkspacesPage() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return WORKSPACES.filter(w =>
      w.enabled &&
      (w.name.toLowerCase().includes(query.toLowerCase()) ||
       w.description.toLowerCase().includes(query.toLowerCase()))
    )
  }, [query])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Clinical Workspaces</h1>
        <p className="text-sm text-muted-foreground">
          Select a clinical domain environment
        </p>
      </div>

      {/* Search */}
      <div className="mb-6 flex items-center gap-3 max-w-md">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Search workspace..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(ws => (
          <Link key={ws.key} href={ws.route}>
            <Card className="hover:shadow-lg transition-all rounded-2xl cursor-pointer">
              <CardContent className="p-5">
                <div className="flex flex-col gap-2">
                  <h2 className="font-semibold text-lg">{ws.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {ws.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
