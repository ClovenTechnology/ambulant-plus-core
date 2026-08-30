// apps/clinician-app/app/sfu/[roomId]/InsightPane.tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

import { Card } from '@/components/ui';
import type { InsightReply } from '@/components/sfu/InsightPanel';
import type {
  PatientAllergyBrief,
  PatientClinicalContext,
  PatientContextStatus,
  PatientMedicationBrief,
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
  patientMeds?: PatientMedicationBrief[] | null;
  clinicalContext?: PatientClinicalContext | null;
  contextStatus?: PatientContextStatus;
  contextError?: string | null;
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
  patientMeds = null,
  clinicalContext = null,
  contextStatus = 'unavailable',
  contextError,
  onChangeSoap,
  onChangePatientEducation,
  onToast,
  onShowSoapTab,
}: InsightPaneProps) {
  const [insightBusy, setInsightBusy] = useState(false);
  const [insight, setInsight] = useState<InsightReply | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);

  const analyzeWithInsight = async () => {
    if (contextStatus !== 'ready' || !clinicalContext) {
      setInsight(null);
      setInsightError(
        'InsightCore analysis is unavailable because authorised patient context could not be verified. No fallback analysis was generated.',
      );
      return;
    }

    setInsightBusy(true);
    setInsightError(null);
    try {
      const payload = {
        mode: 'clinician_encounter_review',
        encounterId: clinicalContext.encounter?.id || null,
        patientId: profile.id || null,
        soap,
        patientEducation,
        reason: appt.reason,
        patient: {
          id: profile.id,
          name: profile.name || appt.patientName,
          dob: profile.dob || null,
          gender: profile.gender || null,
        },
        medications: patientMeds || [],
        allergies: patientAllergies || [],
        conditions: clinicalContext.conditions || [],
        recentLabResults: (clinicalContext.labResults || []).slice(0, 30),
        priorEncounters: (clinicalContext.encounters || []).slice(0, 20),
        cases: (clinicalContext.cases || []).slice(0, 20),
        provenance: {
          source: clinicalContext.source,
          observedAt: clinicalContext.observedAt,
          clinicianReviewRequired: true,
        },
      };

      const res = await fetch('/api/insightcore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(() => ({} as any));

      if (!res.ok || raw?.ok === false) {
        throw new Error(raw?.message || raw?.error || `InsightCore HTTP ${res.status}`);
      }

      const data =
        (raw && (raw.summary || raw.goals || raw.notes) && raw) ||
        (raw && raw.data && (raw.data.summary || raw.data.goals || raw.data.notes) && raw.data) ||
        (raw && raw.insight && (raw.insight.summary || raw.insight.goals || raw.insight.notes) && raw.insight);

      if (!data) {
        throw new Error('InsightCore returned no reviewable clinical analysis.');
      }

      setInsight(data as InsightReply);
    } catch (error) {
      setInsight(null);
      setInsightError(
        error instanceof Error
          ? `InsightCore unavailable: ${error.message}. No fallback analysis was generated.`
          : 'InsightCore unavailable. No fallback analysis was generated.',
      );
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
      {contextStatus !== 'ready' ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-900">
          Patient context is {contextStatus}. {contextError ? `(${contextError}) ` : ''}InsightCore is fail-closed until context is verified.
        </div>
      ) : null}
      {insightError ? (
        <div className="mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-2 text-xs text-rose-800">
          {insightError}
        </div>
      ) : null}
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
