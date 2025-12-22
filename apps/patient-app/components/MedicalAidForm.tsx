// apps/patient-app/components/MedicalAidForm.tsx
'use client';

import React, { useState } from 'react';

export type MedicalAidPolicy = {
  id: string;
  patientId?: string;
  schemeName: string;
  planName?: string;
  membershipNumber: string;
  dependentCode?: string;
  principalName?: string;
  coversTelemedicine: boolean;
  telemedicineCoverType: 'full' | 'partial';
  coPaymentType?: 'fixed' | 'percent' | null;
  coPaymentValue?: number | null;
  notes?: string;
  comFileOriginalName?: string | null;
  comFileStoredAs?: string | null;
  hasCom?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  initial?: Partial<MedicalAidPolicy> | null;
  onSaved?: (policy: MedicalAidPolicy) => void;
  onCancel?: () => void;
};

export default function MedicalAidForm({
  initial,
  onSaved,
  onCancel,
}: Props) {
  const [schemeName, setSchemeName] = useState(
    initial?.schemeName ?? ''
  );
  const [planName, setPlanName] = useState(
    initial?.planName ?? ''
  );
  const [membershipNumber, setMembershipNumber] = useState(
    initial?.membershipNumber ?? ''
  );
  const [dependentCode, setDependentCode] = useState(
    initial?.dependentCode ?? ''
  );
  const [principalName, setPrincipalName] = useState(
    initial?.principalName ?? ''
  );
  const [coversTelemed, setCoversTelemed] = useState(
    initial?.coversTelemedicine ?? true
  );
  const [telemedCoverType, setTelemedCoverType] = useState<
    'full' | 'partial'
  >(initial?.telemedicineCoverType ?? 'full');
  const [coPaymentType, setCoPaymentType] = useState<
    'fixed' | 'percent'
  >(initial?.coPaymentType ?? 'percent');
  const [coPaymentValue, setCoPaymentValue] = useState<
    number | ''
  >(initial?.coPaymentValue ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isDefault, setIsDefault] = useState(
    initial?.isDefault ?? false
  );

  const [comFile, setComFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEditing = !!initial?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!schemeName.trim() || !membershipNumber.trim()) {
      setErr('Scheme and membership number are required.');
      return;
    }

    if (coversTelemed && telemedCoverType === 'partial') {
      if (coPaymentValue === '' || Number(coPaymentValue) < 0) {
        setErr(
          'Please provide a co-payment amount (approximate is fine).'
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        id: initial?.id,
        schemeName: schemeName.trim(),
        planName: planName.trim(),
        membershipNumber: membershipNumber.trim(),
        dependentCode: dependentCode.trim(),
        principalName: principalName.trim(),
        coversTelemedicine: coversTelemed,
        telemedicineCoverType: telemedCoverType,
        coPaymentType:
          coversTelemed && telemedCoverType === 'partial'
            ? coPaymentType
            : null,
        coPaymentValue:
          coversTelemed && telemedCoverType === 'partial'
            ? Number(coPaymentValue)
            : null,
        notes: notes.trim(),
        isDefault,
      };

      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch('/api/medical-aids', {
        method,
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          `Save failed: ${res.status} ${await res
            .text()
            .catch(() => '')}`
        );
      }

      const json = await res.json();
      let policy: MedicalAidPolicy =
        json.item || json.policy || json;

      // Optional COM upload
      if (comFile) {
        const fd = new FormData();
        fd.append('policyId', policy.id);
        fd.append('file', comFile);

        const up = await fetch(
          '/api/medical-aids/upload',
          {
            method: 'POST',
            body: fd,
          }
        );
        if (up.ok) {
          const uj = await up.json().catch(() => ({}));
          policy = {
            ...policy,
            comFileOriginalName:
              uj.originalName || comFile.name,
            comFileStoredAs: uj.storedAs,
            hasCom: true,
          };
        }
      }

      onSaved?.(policy);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save medical aid.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 text-sm"
    >
      <div className="grid md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">
            Scheme / Medical Aid
          </span>
          <input
            className="border rounded px-2 py-1"
            value={schemeName}
            onChange={(e) =>
              setSchemeName(e.target.value)
            }
            placeholder="e.g. Discovery Health"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">
            Plan / Option (optional)
          </span>
          <input
            className="border rounded px-2 py-1"
            value={planName}
            onChange={(e) =>
              setPlanName(e.target.value)
            }
            placeholder="e.g. Executive, Classic Saver"
          />
        </label>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">
            Membership / Policy No.
          </span>
          <input
            className="border rounded px-2 py-1"
            value={membershipNumber}
            onChange={(e) =>
              setMembershipNumber(e.target.value)
            }
            placeholder="e.g. 123456789"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">
            Dependent code
          </span>
          <input
            className="border rounded px-2 py-1"
            value={dependentCode}
            onChange={(e) =>
              setDependentCode(e.target.value)
            }
            placeholder="e.g. 01"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">
            Principal member (if not you)
          </span>
          <input
            className="border rounded px-2 py-1"
            value={principalName}
            onChange={(e) =>
              setPrincipalName(e.target.value)
            }
            placeholder="e.g. John Doe"
          />
        </label>
      </div>

      <div className="border rounded p-3 bg-slate-50 space-y-2">
        <div className="text-xs font-medium text-gray-800">
          Virtual consultations / telemedicine cover
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={coversTelemed}
            onChange={(e) =>
              setCoversTelemed(e.target.checked)
            }
          />
          <span>
            This policy states that{' '}
            <strong>
              virtual / telemedicine consultations
            </strong>{' '}
            are covered.
          </span>
        </label>

        {coversTelemed && (
          <div className="grid md:grid-cols-2 gap-2 text-xs mt-1">
            <div>
              <div className="mb-1">
                Coverage type (for virtual consultations)
              </div>
              <div className="flex flex-col gap-1">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="telemedCoverType"
                    value="full"
                    checked={
                      telemedCoverType === 'full'
                    }
                    onChange={() =>
                      setTelemedCoverType('full')
                    }
                  />
                  <span>Full cover (no co-payment)</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="telemedCoverType"
                    value="partial"
                    checked={
                      telemedCoverType === 'partial'
                    }
                    onChange={() =>
                      setTelemedCoverType('partial')
                    }
                  />
                  <span>
                    Partial cover / co-payment
                    required
                  </span>
                </label>
              </div>
            </div>

            {telemedCoverType === 'partial' && (
              <div className="space-y-1">
                <div>Approximate co-payment</div>
                <div className="flex gap-2 items-center">
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={coPaymentType}
                    onChange={(e) =>
                      setCoPaymentType(
                        e.target.value === 'fixed'
                          ? 'fixed'
                          : 'percent'
                      )
                    }
                  >
                    <option value="fixed">
                      Fixed amount (ZAR)
                    </option>
                    <option value="percent">
                      Percentage (% of tariff)
                    </option>
                  </select>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-24 text-xs"
                    value={coPaymentValue}
                    onChange={(e) =>
                      setCoPaymentValue(
                        e.target.value === ''
                          ? ''
                          : Number(e.target.value)
                      )
                    }
                    placeholder={
                      coPaymentType === 'percent'
                        ? 'e.g. 20'
                        : 'e.g. 150'
                    }
                  />
                </div>
                <div className="text-[11px] text-gray-500">
                  This helps Ambulant+ estimate any
                  co-payment that may be due.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-600">
            Certificate of Membership (COM)
          </span>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) =>
              setComFile(
                e.target.files?.[0] ?? null
              )
            }
            className="text-xs"
          />
          <span className="text-[11px] text-gray-500">
            Upload your medical aid COM
            (certificate of membership). PDF or
            clear photo is fine.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-600">
            Notes (optional)
          </span>
          <textarea
            className="border rounded px-2 py-1 min-h-[60px]"
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
            placeholder="Anything specific about your cover, pre-authorisation rules, or exclusions."
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) =>
            setIsDefault(e.target.checked)
          }
        />
        <span>
          Use this as my{' '}
          <strong>default medical aid</strong> for
          future bookings.
        </span>
      </label>

      {err && (
        <div className="text-xs text-rose-600">
          {err}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        {onCancel && (
          <button
            type="button"
            className="px-3 py-1.5 border rounded text-xs"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
          disabled={saving}
        >
          {saving
            ? 'Saving...'
            : isEditing
            ? 'Save changes'
            : 'Save Medical Aid'}
        </button>
      </div>
    </form>
  );
}
