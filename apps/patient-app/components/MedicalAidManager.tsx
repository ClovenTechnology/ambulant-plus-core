// apps/patient-app/components/MedicalAidManager.tsx
'use client';

import React, { useEffect, useState } from 'react';

type TelemedCover = 'none' | 'full' | 'partial';

export type MedicalAid = {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  payerName: string;
  planName?: string;
  membershipNumber: string;
  dependentCode?: string;
  principalName?: string;
  principalIdNumber?: string;
  telemedCover: TelemedCover;
  telemedCopayType?: 'fixed' | 'percent';
  telemedCopayValue?: number;
  comFilePath?: string;
  comFileName?: string;
  notes?: string;
  active?: boolean;
};

type Props = {
  patientId: string;
  /** Compact = small inline card for checkout; default = richer profile view */
  compact?: boolean;
};

export default function MedicalAidManager({ patientId, compact }: Props) {
  const [items, setItems] = useState<MedicalAid[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MedicalAid | null>(null);

  const active = items.find((m) => m.active) ?? items[0];

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/medical-aids?patientId=${encodeURIComponent(patientId)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load medical aid profiles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!patientId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(m: MedicalAid) {
    setEditing(m);
    setModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Remove this medical aid profile?')) return;
    try {
      await fetch(`/api/medical-aids?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to remove entry.');
    }
  }

  async function handleSetActive(id: string) {
    const target = items.find((m) => m.id === id);
    if (!target) return;
    try {
      const res = await fetch('/api/medical-aids', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, active: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      const updated = j.item as MedicalAid;
      setItems((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? updated
            : m.patientId === updated.patientId
            ? { ...m, active: false }
            : m
        )
      );
    } catch (e) {
      console.error(e);
      alert('Failed to mark as default.');
    }
  }

  const title = 'Medical Aid / Insurance';

  if (compact) {
    return (
      <section className="border rounded-lg p-3 bg-slate-50">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-gray-800">{title}</div>
            <div className="text-xs text-gray-500">
              Used when submitting claims after your virtual consult.
            </div>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
          >
            Add / Edit
          </button>
        </div>

        {err && <div className="mt-2 text-xs text-rose-600">{err}</div>}
        {loading && <div className="mt-2 text-xs text-gray-500">Loading…</div>}

        {!loading && !err && (
          <div className="mt-2 text-xs">
            {active ? (
              <div className="border rounded bg-white px-2 py-2">
                <div className="font-semibold text-gray-800">
                  {active.payerName}
                  {active.planName ? ` — ${active.planName}` : ''}
                </div>
                <div className="text-gray-700">
                  Member {active.membershipNumber}
                  {active.dependentCode ? `-${active.dependentCode}` : ''}
                </div>
                <div className="mt-1 text-[11px] text-gray-600">
                  Telemed:{' '}
                  {active.telemedCover === 'full'
                    ? 'Full cover'
                    : active.telemedCover === 'partial'
                    ? active.telemedCopayType &&
                      typeof active.telemedCopayValue === 'number'
                      ? `Partial (co-pay ${
                          active.telemedCopayType === 'percent'
                            ? `${active.telemedCopayValue}%`
                            : `R${active.telemedCopayValue.toFixed(2)}`
                        })`
                      : 'Partial cover (co-payment)'
                    : 'Not indicated / none'}
                </div>
                {active.comFileName && (
                  <div className="mt-1 text-[11px] text-gray-600">
                    COM: {active.comFileName}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500">
                No medical aid profile captured yet. You can still proceed as self-pay.
              </div>
            )}
          </div>
        )}

        {modalOpen && (
          <MedicalAidModal
            patientId={patientId}
            initial={editing ?? undefined}
            onClose={() => setModalOpen(false)}
            onSaved={(saved) => {
              setModalOpen(false);
              setEditing(null);
              setItems((prev) => {
                const existing = prev.find((m) => m.id === saved.id);
                if (existing) {
                  return prev.map((m) => (m.id === saved.id ? saved : m));
                }
                return [...prev, saved];
              });
            }}
          />
        )}
      </section>
    );
  }

  // Full manager (profile page)
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800">{title}</div>
          <div className="text-xs text-gray-500">
            Store your medical aid / insurance policies so claims can be submitted on your behalf.
          </div>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          Add Policy
        </button>
      </div>

      {err && <div className="text-xs text-rose-600">{err}</div>}
      {loading && <div className="text-xs text-gray-500">Loading…</div>}

      {!loading && !err && items.length === 0 && (
        <div className="text-xs text-gray-500">
          No medical aid policies captured yet.
        </div>
      )}

      {!loading && !err && items.length > 0 && (
        <ul className="space-y-2 text-sm">
          {items.map((m) => (
            <li
              key={m.id}
              className="border rounded bg-white px-3 py-2 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">
                    {m.payerName}
                    {m.planName ? ` — ${m.planName}` : ''}
                  </div>
                  <div className="text-xs text-gray-600">
                    Member {m.membershipNumber}
                    {m.dependentCode ? `-${m.dependentCode}` : ''}
                    {m.principalName ? ` · Principal: ${m.principalName}` : ''}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    Telemed:{' '}
                    {m.telemedCover === 'full'
                      ? 'Full cover for virtual consultations'
                      : m.telemedCover === 'partial'
                      ? m.telemedCopayType &&
                        typeof m.telemedCopayValue === 'number'
                        ? `Partial cover (co-pay ${
                            m.telemedCopayType === 'percent'
                              ? `${m.telemedCopayValue}%`
                              : `R${m.telemedCopayValue.toFixed(2)}`
                          })`
                        : 'Partial cover (co-payment / deductible)'
                      : 'Not covered or not indicated'}
                  </div>
                  {m.comFileName && (
                    <div className="text-[11px] text-gray-600">
                      COM on file: {m.comFileName}
                    </div>
                  )}
                  {m.notes && (
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      Notes: {m.notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {m.active && (
                    <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                      Default for claims
                    </span>
                  )}
                  {!m.active && (
                    <button
                      type="button"
                      onClick={() => handleSetActive(m.id)}
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(m)}
                    className="text-[11px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-[11px] px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <MedicalAidModal
          patientId={patientId}
          initial={editing ?? undefined}
          onClose={() => setModalOpen(false)}
          onSaved={(saved) => {
            setModalOpen(false);
            setEditing(null);
            setItems((prev) => {
              const existing = prev.find((m) => m.id === saved.id);
              if (existing) {
                return prev.map((m) => (m.id === saved.id ? saved : m));
              }
              return [...prev, saved];
            });
          }}
        />
      )}
    </section>
  );
}

type ModalProps = {
  patientId: string;
  initial?: Partial<MedicalAid>;
  onClose: () => void;
  onSaved: (item: MedicalAid) => void;
};

function MedicalAidModal({ patientId, initial, onClose, onSaved }: ModalProps) {
  const [payerName, setPayerName] = useState(initial?.payerName ?? '');
  const [planName, setPlanName] = useState(initial?.planName ?? '');
  const [membershipNumber, setMembershipNumber] = useState(
    initial?.membershipNumber ?? ''
  );
  const [dependentCode, setDependentCode] = useState(initial?.dependentCode ?? '');
  const [principalName, setPrincipalName] = useState(initial?.principalName ?? '');
  const [principalIdNumber, setPrincipalIdNumber] = useState(
    initial?.principalIdNumber ?? ''
  );
  const [telemedCover, setTelemedCover] = useState<TelemedCover>(
    (initial?.telemedCover as TelemedCover) ?? 'partial'
  );
  const [telemedCopayType, setTelemedCopayType] = useState<
    'fixed' | 'percent' | ''
  >((initial?.telemedCopayType as any) ?? '');
  const [telemedCopayValue, setTelemedCopayValue] = useState<
    number | '' | undefined
  >(
    typeof initial?.telemedCopayValue === 'number'
      ? initial.telemedCopayValue
      : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [active, setActive] = useState(initial?.active ?? false);
  const [comFile, setComFile] = useState<File | null>(null);
  const [existingCom, setExistingCom] = useState<string | undefined>(
    initial?.comFileName
  );

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isEdit = !!initial?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');

    if (!payerName.trim() || !membershipNumber.trim()) {
      setErr('Please enter at least scheme/payer name and membership number.');
      return;
    }

    setSaving(true);
    try {
      let comFilePath = initial?.comFilePath;
      let comFileName = initial?.comFileName;

      if (comFile) {
        const fd = new FormData();
        fd.append('file', comFile);
        fd.append('patientId', patientId || 'pt-za-001');

        const res = await fetch('/api/medical-aids/upload', {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error('Failed to upload COM.');
        const j = await res.json();
        comFilePath = j.comFilePath;
        comFileName = j.comFileName;
      }

      const payload: any = {
        id: initial?.id,
        patientId: patientId || 'pt-za-001',
        payerName: payerName.trim(),
        planName: planName.trim() || undefined,
        membershipNumber: membershipNumber.trim(),
        dependentCode: dependentCode.trim() || undefined,
        principalName: principalName.trim() || undefined,
        principalIdNumber: principalIdNumber.trim() || undefined,
        telemedCover,
        telemedCopayType: telemedCopayType || undefined,
        telemedCopayValue:
          telemedCopayValue === '' ? undefined : Number(telemedCopayValue),
        notes: notes.trim() || undefined,
        active,
        comFilePath,
        comFileName,
      };

      const res = await fetch('/api/medical-aids', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to save.'));
      const j = await res.json();
      const saved = j.item as MedicalAid;
      onSaved(saved);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">
            {isEdit ? 'Edit Medical Aid Policy' : 'Add Medical Aid Policy'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-800"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Scheme / Payer</span>
              <input
                className="border rounded px-2 py-1"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="e.g. Discovery, Momentum, Bonitas"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Plan / Option</span>
              <input
                className="border rounded px-2 py-1"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="e.g. Classic Smart"
              />
            </label>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Membership number</span>
              <input
                className="border rounded px-2 py-1"
                value={membershipNumber}
                onChange={(e) => setMembershipNumber(e.target.value)}
                placeholder="e.g. 123456789"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Dependent code</span>
              <input
                className="border rounded px-2 py-1"
                value={dependentCode}
                onChange={(e) => setDependentCode(e.target.value)}
                placeholder="e.g. 01"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">Principal ID number</span>
              <input
                className="border rounded px-2 py-1"
                value={principalIdNumber}
                onChange={(e) => setPrincipalIdNumber(e.target.value)}
                placeholder="e.g. 8001010123088"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-600">Principal member name</span>
            <input
              className="border rounded px-2 py-1"
              value={principalName}
              onChange={(e) => setPrincipalName(e.target.value)}
              placeholder="Name of main member"
            />
          </label>

          <div className="border rounded px-3 py-2 bg-slate-50 space-y-2">
            <div className="text-xs font-medium text-gray-700">
              Virtual consult cover (telemedicine / contactless)
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="telemedCover"
                  value="full"
                  checked={telemedCover === 'full'}
                  onChange={() => setTelemedCover('full')}
                />
                <span>Full cover</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="telemedCover"
                  value="partial"
                  checked={telemedCover === 'partial'}
                  onChange={() => setTelemedCover('partial')}
                />
                <span>Partial (co-payment / deductible)</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name="telemedCover"
                  value="none"
                  checked={telemedCover === 'none'}
                  onChange={() => setTelemedCover('none')}
                />
                <span>Not covered / unknown</span>
              </label>
            </div>

            {telemedCover === 'partial' && (
              <div className="grid md:grid-cols-2 gap-2 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600">Co-payment type</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={telemedCopayType}
                    onChange={(e) =>
                      setTelemedCopayType(e.target.value as any)
                    }
                  >
                    <option value="">Select…</option>
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed amount (ZAR)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-gray-600">
                    Co-payment value ({telemedCopayType === 'percent' ? '%' : 'R'})
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    className="border rounded px-2 py-1"
                    value={telemedCopayValue === '' ? '' : telemedCopayValue}
                    onChange={(e) =>
                      setTelemedCopayValue(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                  />
                </label>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-gray-600">
                Certificate of Membership (COM) — PDF / image
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) =>
                  setComFile(e.target.files?.[0] ?? null)
                }
                className="text-xs"
              />
              {existingCom && !comFile && (
                <span className="text-[11px] text-gray-600">
                  Existing: {existingCom}
                </span>
              )}
              {comFile && (
                <span className="text-[11px] text-gray-600">
                  Selected: {comFile.name}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-gray-600">Notes (e.g. pre-auth, limits)</span>
              <textarea
                className="border rounded px-2 py-1 min-h-[60px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Pre-authorisation numbers, scheme-specific rules, etc."
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>Use this policy as my default for telemedicine claims</span>
          </label>

          {err && <div className="text-xs text-rose-600">{err}</div>}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-gray-300 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
