// apps/clinician-app/app/sfu/[roomId]/InsightPane.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

import { Card } from '@/components/ui';
import type { InsightReply } from '@/components/sfu/InsightPanel';
import type {
  PatientAllergyBrief,
  PatientProfile,
} from './patientContext';
import type { SoapState } from './ErxComposer';

const InsightPanel = dynamic(
  () =>
    import('@/components/sfu/InsightPanel').then((m) => ({
      default: m.InsightPanel,
    })),
  { ssr: false }
);

type ToastKind = 'info' | 'success' | 'warning' | 'error';

type InsightPaneProps = {
  dense: boolean;
  soap: SoapState;
  patientEducation: string;
  profile: PatientProfile;
  appt: {
    reason: string;
    clinicianName: string;
    patientName: string;
  };
  patientAllergies: PatientAllergyBrief[] | null;
  onChangeSoap: (next: SoapState) => void;
  onChangePatientEducation: (value: string) => void;
  onToast: (body: string, kind?: ToastKind, title?: string) => void;
  onShowSoapTab?: () => void;
};

export default function InsightPane({
  dense,
  soap,
  patientEducation,
  profile,
  appt,
  patientAllergies,
  onChangeSoap,
  onChangePatientEducation,
  onToast,
  onShowSoapTab,
}: InsightPaneProps) {
  const [insightBusy, setInsightBusy] = useState(false);
  const [insight, setInsight] = useState<InsightReply | null>(null);

  const analyzeWithInsight = async () => {
    setInsightBusy(true);
    try {
      const payload = {
        soap,
        patient: profile.name || appt.patientName,
        clinician: appt.clinicianName,
        reason: appt.reason,
        meds: [], // eRx composer is separate now; SOAP is main context
        allergies: patientAllergies,
      };
      const res = await fetch('/api/insightcore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(() => ({} as any));
      const data =
        (raw && (raw.summary || raw.goals || raw.notes) && raw) ||
        (raw &&
          raw.data &&
          (raw.data.summary || raw.data.goals || raw.data.notes) &&
          raw.data);
      if (data) setInsight(data as any);
      else {
        setInsight({
          summary: `Suggested plan for ${profile.name || appt.patientName}: Dx ${
            soap.a || soap.p || '—'
          }.`,
          goals: [
            'Symptom reduction in 7d',
            'Adherence ≥85%',
            'Follow-up in 10–14d',
          ],
          notes: 'Review red flags, hydration, follow-up, etc.',
        });
      }
    } catch {
      setInsight({
        summary: `Suggested plan for ${profile.name || appt.patientName}: Dx ${
          soap.a || soap.p || '—'
        }.`,
        goals: [
          'Symptom reduction in 7d',
          'Adherence ≥85%',
          'Follow-up in 10–14d',
        ],
        notes: 'Insight service unavailable—using fallback plan.',
      });
    } finally {
      setInsightBusy(false);
    }
  };

  const insightToText = () => {
    if (!insight) return '';
    const text = [
      insight.summary ? `Summary: ${insight.summary}` : '',
      insight.goals?.length
        ? `Goals:\n- ${insight.goals.join('\n- ')}`
        : '',
      insight.notes ? `Notes: ${insight.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    return text;
  };

  const acceptInsight = () => {
    if (!insight) return;
    const text = insightToText();
    onChangePatientEducation(
      patientEducation ? `${patientEducation}\n\n---\n${text}` : text
    );
    onToast('Insight accepted into Patient Education.', 'success');
  };

  const adjustInsight = () => {
    if (!insight) return;
    const text = insightToText();
    onChangeSoap({
      ...soap,
      p: soap.p ? `${soap.p}\n\n---\n${text}` : text,
    });
    onShowSoapTab?.();
    onToast('Insight copied to Plan. Edit in SOAP tab.', 'info');
  };

  const declineInsight = () => {
    if (!insight) return;
    setInsight(null);
    onToast('Insight declined.', 'warning');
  };

  return (
    <Card title="InsightCore" dense={dense} gradient>
      <div className="text-xs text-gray-500 mb-2">
        Draft AI assistance. Review suggestions carefully before accepting.
      </div>
      <InsightPanel insight={insight} busy={insightBusy} onAnalyze={analyzeWithInsight} />
      <div className="mt-2 flex gap-2">
        <button
          className="px-2 py-1 border rounded text-xs"
          onClick={acceptInsight}
          disabled={!insight}
        >
          Accept
        </button>
        <button
          className="px-2 py-1 border rounded text-xs"
          onClick={adjustInsight}
          disabled={!insight}
        >
          Adjust
        </button>
        <button
          className="px-2 py-1 border rounded text-xs"
          onClick={declineInsight}
          disabled={!insight}
        >
          Decline
        </button>
      </div>
    </Card>
  );
}
