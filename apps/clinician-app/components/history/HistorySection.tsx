'use client';

import { useEffect, useState } from 'react';
import { Collapse, Skeleton } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';

export type HistoryKind =
  | 'cases'
  | 'conditions'
  | 'medications'
  | 'allergies'
  | 'operations'
  | 'vaccinations'
  | 'labs';

export type HistoryItem = {
  id: string;
  date: string;          // ISO
  label: string;         // primary text e.g. "Hypertension"
  subtitle?: string;     // e.g. "Chronic, controlled"
  meta?: string;         // e.g. "ICD-10 I10"
  status?: string;       // e.g. "Active", "Resolved", "Completed"
};

const DEMO_HISTORY: Record<HistoryKind, HistoryItem[]> = {
  cases: [
    {
      id: 'case-001',
      date: '2024-08-01',
      label: 'Teleconsult — Acute bronchitis',
      subtitle: 'Cough, low-grade fever, sore throat',
      meta: 'Outcome: Conservative management',
      status: 'Completed',
    },
    {
      id: 'case-002',
      date: '2024-10-15',
      label: 'Video follow-up — Hypertension',
      subtitle: 'BP optimisation and lifestyle coaching',
      meta: 'Outcome: Meds adjusted',
      status: 'Completed',
    },
  ],
  conditions: [
    {
      id: 'cond-htn',
      date: '2022-03-10',
      label: 'Essential (primary) hypertension',
      subtitle: 'Chronic, controlled on current therapy',
      meta: 'ICD-10: I10',
      status: 'Active',
    },
    {
      id: 'cond-t2dm',
      date: '2023-07-21',
      label: 'Type 2 diabetes mellitus',
      subtitle: 'Non-insulin dependent',
      meta: 'ICD-10: E11.9',
      status: 'Active',
    },
  ],
  medications: [
    {
      id: 'med-001',
      date: '2024-10-15',
      label: 'Metformin 500 mg tablet',
      subtitle: '1 tab twice daily with meals',
      meta: 'Repeats: 3 | Route: PO',
      status: 'Active',
    },
    {
      id: 'med-002',
      date: '2024-08-01',
      label: 'Amoxicillin 500 mg capsule',
      subtitle: 'Completed 5-day course',
      meta: 'Indication: Acute bronchitis',
      status: 'Completed',
    },
  ],
  allergies: [
    {
      id: 'alg-pen',
      date: '2021-04-10',
      label: 'Penicillin',
      subtitle: 'Rash / urticaria',
      meta: 'Severity: Moderate',
      status: 'Active',
    },
    {
      id: 'alg-nuts',
      date: '2019-09-02',
      label: 'Peanuts',
      subtitle: 'Lip swelling',
      meta: 'Severity: Mild',
      status: 'Active',
    },
  ],
  labs: [
    {
      id: 'lab-001',
      date: '2024-07-03',
      label: 'HbA1c',
      subtitle: 'Result: 7.1%',
      meta: 'Lab: Ampath | Specimen: Blood',
      status: 'Completed',
    },
    {
      id: 'lab-002',
      date: '2024-06-20',
      label: 'Full blood count (FBC)',
      subtitle: 'Result: Within normal limits',
      meta: 'Lab: Lancet | Specimen: Blood',
      status: 'Completed',
    },
  ],
  operations: [
    {
      id: 'op-001',
      date: '2019-11-05',
      label: 'Laparoscopic cholecystectomy',
      subtitle: 'Elective procedure, uncomplicated',
      meta: 'Facility: Groote Schuur Hospital',
      status: 'Resolved',
    },
  ],
  vaccinations: [
    {
      id: 'imm-001',
      date: '2021-03-18',
      label: 'COVID-19 vaccine (mRNA)',
      subtitle: 'Dose 1',
      meta: 'Site: Left deltoid | Facility: Community clinic',
      status: 'Completed',
    },
    {
      id: 'imm-002',
      date: '2021-04-15',
      label: 'COVID-19 vaccine (mRNA)',
      subtitle: 'Dose 2',
      meta: 'Site: Left deltoid | Facility: Community clinic',
      status: 'Completed',
    },
    {
      id: 'imm-003',
      date: '2023-05-09',
      label: 'Influenza (seasonal)',
      subtitle: 'Annual flu shot',
      meta: 'Facility: GP practice',
      status: 'Completed',
    },
  ],
};

export type HistorySectionProps = {
  title: string;
  kind: HistoryKind;
  patientId: string;
  defaultOpen?: boolean;
};

export default function HistorySection({
  title,
  kind,
  patientId,
  defaultOpen = true,
}: HistorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItems = (items?.length || 0) > 0;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/history/${kind}?patientId=${encodeURIComponent(patientId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const raw = Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json)
          ? json
          : [];

        const mapped: HistoryItem[] = raw.map((r: any, idx: number) => ({
          id: String(r.id ?? `${kind}-${idx}`),
          date:
            r.date ??
            r.performedAt ??
            r.recordedAt ??
            r.createdAt ??
            new Date().toISOString(),
          label: r.label ?? r.name ?? r.title ?? 'Unnamed record',
          subtitle: r.subtitle ?? r.description ?? r.detail ?? '',
          meta: r.meta ?? r.code ?? r.icd ?? r.site ?? '',
          status: r.status ?? r.state ?? '',
        }));

        if (!cancelled) setItems(mapped);
      } catch {
        if (!cancelled) {
          setItems(DEMO_HISTORY[kind] || []);
          setError('Using demo data (history endpoint unavailable).');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, patientId]);

  return (
    <div className="border rounded bg-white">
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <span>{title}</span>
          {hasItems && (
            <span className="text-[11px] text-gray-500">
              ({items!.length})
            </span>
          )}
          {error && (
            <span className="text-[10px] text-amber-600 border border-amber-200 bg-amber-50 rounded-full px-2 py-0.5">
              Demo
            </span>
          )}
        </div>
        <CollapseBtn open={open} onClick={() => setOpen((v) => !v)} />
      </div>

      <Collapse open={open}>
        <div className="px-2 pb-2">
          {loading && (
            <div className="space-y-1 mt-1">
              <Skeleton height="h-4" />
              <Skeleton height="h-4" />
            </div>
          )}

          {!loading && !hasItems && (
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span aria-hidden>🗂️</span>
              <span className="italic">No records to display yet.</span>
            </div>
          )}

          {!loading && hasItems && (
            <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto pr-1">
              {items!.map((item) => (
                <li
                  key={item.id}
                  className="rounded border border-gray-100 bg-gray-50 px-2 py-1 text-xs flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                  {item.subtitle && (
                    <div className="text-[11px] text-gray-700 line-clamp-2">
                      {item.subtitle}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      {item.meta && (
                        <span className="font-mono px-1.5 py-0.5 rounded-full bg-white border border-gray-200">
                          {item.meta}
                        </span>
                      )}
                    </div>
                    {item.status && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                        {item.status}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapse>
    </div>
  );
}
