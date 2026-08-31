'use client';

import { type ReactNode, useMemo, useState } from 'react';

import { Card, Tabs } from '@/components/ui';
import { Collapse } from '@/components/Collapse';
import { CollapseBtn } from '@/components/CollapseBtn';
import TodaysPills from '@/components/TodaysPills';
import type { RoomParty } from '@/src/lib/rtc/roster-contract';

export type PatientRightTab = 'chat' | 'overview' | 'history' | 'orders' | 'uploads';

export type Allergy = {
  name?: string;
  status: 'Active' | 'Resolved';
  note?: string;
  severity?: 'mild' | 'moderate' | 'severe';
};

export type HistoryEntry =
  | {
      id: string;
      kind: 'condition';
      name: string;
      diagnosedAt?: string | null;
      clinician?: string;
      facility?: string;
      location?: string;
      confirmTest?: string;
      comment?: string;
      at: number;
      by: string;
    }
  | {
      id: string;
      kind: 'operation';
      name: string;
      opDate?: string | null;
      clinician?: string;
      facility?: string;
      location?: string;
      comment?: string;
      at: number;
      by: string;
    }
  | {
      id: string;
      kind: 'vaccination';
      codeOrName: string;
      vType?: string;
      contents?: string;
      adminAt?: string | null;
      clinician?: string;
      facility?: string;
      location?: string;
      comment?: string;
      at: number;
      by: string;
    };

export type InboxItem = {
  id: string;
  kind: 'pharmacy' | 'lab';
  createdAt?: string;
  title: string;
  details?: string;
};

export type UploadItem = {
  id: string;
  kind: 'erx' | 'lab' | 'xray' | 'image' | 'other';
  name: string;
  size: number;
  at: number;
  by: string;
  url?: string;
};

type Props = {
  dense?: boolean;
  tab: PatientRightTab;
  onChangeTab: (t: PatientRightTab) => void;
  open: boolean;
  onToggleOpen: () => void;
  chatContent?: ReactNode;
  roster?: RoomParty[];
  allergies: Allergy[];
  allergiesLoading: boolean;
  onRefreshAllergies: () => void;
  onExportAllergies: () => void;
  currentMeds: string[];
  adherencePct: number;
  historyEntries: HistoryEntry[];
  inbox: InboxItem[];
  onRefreshInbox: () => void;
  uploads: UploadItem[];
  onUploadFiles: (
    files: FileList | null,
    kind: 'erx' | 'lab' | 'xray' | 'image' | 'other',
  ) => void;
};

function SafeDate({ iso }: { iso?: string | null }) {
  if (!iso) return <span>—</span>;
  return <span suppressHydrationWarning>{new Date(iso).toLocaleString()}</span>;
}

function roleLabel(role: RoomParty['role']) {
  switch (role) {
    case 'lead_patient':
      return 'Patient';
    case 'dependent_patient':
      return 'Dependant';
    case 'observer':
      return 'Observer';
    case 'care_ally':
      return 'Care ally';
    case 'lead_clinician':
      return 'Lead clinician';
    case 'co_clinician':
      return 'Co-clinician';
    case 'advisor':
      return 'Advisor';
    default:
      return role;
  }
}

function stateTone(state: RoomParty['state']) {
  switch (state) {
    case 'joined':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'accepted':
      return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'invited':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'left':
      return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'declined':
      return 'border-rose-200 bg-rose-50 text-rose-800';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function InvitedClinicianCard({ roster }: { roster?: RoomParty[] }) {
  const invitedClinicians = (roster || []).filter(
    (p) => p.role === 'co_clinician' || p.role === 'advisor',
  );

  if (invitedClinicians.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-slate-900">
        Invited clinicians
      </div>
      <div className="mt-2 space-y-2">
        {invitedClinicians.map((p) => (
          <div
            key={p.partyId}
            className={`rounded-xl border px-3 py-2 ${stateTone(p.state)}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">
                  {p.displayName || roleLabel(p.role)}
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {roleLabel(p.role)}
                  {p.specialty ? ` · ${p.specialty}` : ''}
                </div>
              </div>
              <div className="text-xs font-medium uppercase tracking-[0.14em]">
                {p.state}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function PatientRightPane({
  dense,
  tab,
  onChangeTab,
  open,
  onToggleOpen,
  chatContent,
  roster,
  allergies,
  allergiesLoading,
  onRefreshAllergies,
  onExportAllergies,
  currentMeds,
  adherencePct,
  historyEntries,
  inbox,
  onRefreshInbox,
  uploads,
  onUploadFiles,
}: Props) {
  const [pillAdherencePct, setPillAdherencePct] = useState(adherencePct);

  const activeAllergies = useMemo(
    () => allergies.filter((a) => a.status === 'Active'),
    [allergies],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card title="Consultation workspace">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <Tabs
            items={[
              { key: 'chat', label: 'Chat' },
              { key: 'overview', label: 'Overview' },
              { key: 'history', label: 'History' },
              { key: 'orders', label: 'Orders' },
              { key: 'uploads', label: 'Uploads' },
            ]}
            value={tab}
            onChange={(k) => onChangeTab(k as PatientRightTab)}
          >
            {() => null}
          </Tabs>

          <CollapseBtn open={open} onClick={onToggleOpen} />
        </div>

        <Collapse open={open} className="px-4 py-4">
          {tab === 'chat' ? (
            chatContent ?? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                Consultation chat is unavailable.
              </div>
            )
          ) : null}

          {tab === 'overview' ? (
            <div className="space-y-4">
              <InvitedClinicianCard roster={roster} />

              <Card className="p-4">
                <div className="text-sm font-semibold text-slate-900">Allergies</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-sm text-slate-600">
                    Active: <b>{activeAllergies.length}</b> / Total: <b>{allergies.length}</b>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      onClick={onRefreshAllergies}
                      disabled={allergiesLoading}
                    >
                      {allergiesLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <button
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      onClick={onExportAllergies}
                    >
                      Export to clinician
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {allergies.length === 0 ? (
                    <div className="text-sm text-slate-500">No allergies recorded.</div>
                  ) : (
                    allergies.map((a, i) => (
                      <div
                        key={`${a.name || 'allergy'}-${i}`}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {a.name || 'Allergy'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {a.severity ? `Severity: ${a.severity}` : 'Severity: —'}
                              {a.note ? ` · ${a.note}` : ''}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              a.status === 'Active'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-sm font-semibold text-slate-900">Current medication</div>
                {currentMeds.length > 0 ? (
                  <div className="mt-2 text-sm text-slate-600">
                    Current adherence snapshot: <b>{pillAdherencePct}%</b>
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {currentMeds.length === 0 ? (
                    <div className="text-sm text-slate-500">No current medications listed.</div>
                  ) : (
                    currentMeds.map((m, i) => (
                      <div
                        key={`${m}-${i}`}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                      >
                        {m}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4">
                  <TodaysPills
                    pills={currentMeds.map((m, i) => ({
                      id: `pill-${i}`,
                      name: m.split(' ')[0] || m,
                      dose: m,
                      time: 'Today',
                      status: 'Pending' as const,
                    }))}
                    onAdherenceUpdate={setPillAdherencePct}
                  />
                </div>
              </Card>
            </div>
          ) : null}

          {tab === 'history' ? (
            <div className="space-y-3">
              {historyEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No structured history entries yet.
                </div>
              ) : (
                historyEntries.map((h) => (
                  <Card key={h.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {h.kind === 'condition' ? `Condition: ${h.name}` : null}
                        {h.kind === 'operation' ? `Operation: ${h.name}` : null}
                        {h.kind === 'vaccination' ? `Vaccination: ${h.codeOrName}` : null}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(h.at).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {h.kind === 'condition' && h.diagnosedAt ? (
                        <div className="text-sm text-slate-700">
                          <b>Diagnosed:</b> <SafeDate iso={h.diagnosedAt} />
                        </div>
                      ) : null}
                      {h.kind === 'operation' && h.opDate ? (
                        <div className="text-sm text-slate-700">
                          <b>Date:</b> <SafeDate iso={h.opDate} />
                        </div>
                      ) : null}
                      {h.kind === 'vaccination' && h.adminAt ? (
                        <div className="text-sm text-slate-700">
                          <b>Administered:</b> <SafeDate iso={h.adminAt} />
                        </div>
                      ) : null}
                      {h.clinician ? (
                        <div className="text-sm text-slate-700">
                          <b>Clinician:</b> {h.clinician}
                        </div>
                      ) : null}
                      {h.facility ? (
                        <div className="text-sm text-slate-700">
                          <b>Facility:</b> {h.facility}
                        </div>
                      ) : null}
                      {h.location ? (
                        <div className="text-sm text-slate-700">
                          <b>Location:</b> {h.location}
                        </div>
                      ) : null}
                    </div>

                    {'comment' in h && h.comment ? (
                      <div className="mt-3 text-sm text-slate-700">
                        <b>Comment:</b> {h.comment}
                      </div>
                    ) : null}
                  </Card>
                ))
              )}
            </div>
          ) : null}

          {tab === 'orders' ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={onRefreshInbox}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {inbox.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No prescription or lab items yet.
                </div>
              ) : (
                inbox.map((it) => (
                  <Card key={it.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{it.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {it.kind === 'pharmacy' ? 'Pharmacy eRx' : 'Lab order'}
                          {it.details ? ` · ${it.details}` : ''}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        <SafeDate iso={it.createdAt} />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : null}

          {tab === 'uploads' ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {(['erx', 'lab', 'xray', 'image', 'other'] as const).map((kind) => (
                  <Card key={kind} className="p-4">
                    <div className="text-sm font-semibold capitalize text-slate-900">
                      {kind} files
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      JPEG, PNG, PDF, WEBM
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => onUploadFiles(e.target.files, kind)}
                      className="mt-3 text-xs"
                    />
                  </Card>
                ))}
              </div>

              <div className="space-y-3">
                {uploads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No uploads yet.
                  </div>
                ) : (
                  uploads.map((u) => (
                    <Card key={u.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {u.name}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              ({u.kind})
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {new Date(u.at).toLocaleString()} · {Math.round(u.size / 1024)} KB
                          </div>
                        </div>

                        {u.url ? (
                          <a
                            href={u.url}
                            download
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Download
                          </a>
                        ) : null}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </Collapse>
      </Card>
    </div>
  );
}