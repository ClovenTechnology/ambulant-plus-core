/*
File: apps/clinician-app/app/workspaces/std/page.tsx
Purpose: STD / Sexual Health workspace — clinically serious Phase 1 (persisted) + consent gating + evidence + annotations + results comms events
Notes:
- Still uses POST-only APIs (findings/evidence/annotations).
- Adds encounter-scoped local persistence to feel real without GET endpoints.
- Results communication events export a results_review + follow_up_plan combo (Phase 1 local → Phase 2 audit log ready).
- Demo overrides via query params:
  /workspaces/std?patientId=p_123&encounterId=e_456&clinicianId=c_789
*/

'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

import { useStdWorkspace } from '@/src/components/workspaces/std/useStdWorkspace';
import {
  StdHeader,
  StdLeftPanel,
  StdEvidencePanel,
  StdPlanPanel,
  StdBookmarkModal,
  StdResultsAndCommsPanel,
} from '@/src/components/workspaces/std/StdPanels';

function qp(v: string | null) {
  const t = (v ?? '').trim();
  return t ? t : undefined;
}

export default function STDWorkspacePage() {
  const sp = useSearchParams();

  const patientId = qp(sp.get('patientId'));
  const encounterId = qp(sp.get('encounterId'));
  const clinicianId = qp(sp.get('clinicianId'));

  const vm = useStdWorkspace({ patientId, encounterId, clinicianId });
  const { state, actions } = vm;

  return (
    <div className="min-h-screen bg-gray-50">
      <StdHeader
        patientId={vm.patientId}
        encounterId={vm.encounterId}
        context={state.context}
        risk={vm.riskLevel}
        privacyMode={state.privacyMode}
        onTogglePrivacy={() => actions.setPrivacyMode(!state.privacyMode)}
      />

      <main className="mx-auto max-w-7xl px-4 py-4">
        {state.banner ? (
          <div
            className={
              'mb-4 rounded-lg border px-3 py-2 text-sm ' +
              (state.banner.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : state.banner.kind === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-gray-200 bg-white text-gray-800')
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{state.banner.text}</div>
              <button
                className="shrink-0 rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50"
                type="button"
                onClick={() => actions.setBanner(null as any)}
                title="Dismiss"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.6fr_1.1fr] gap-4">
          <StdLeftPanel
            context={state.context}
            contextCounts={vm.contextCounts}
            consent={state.consent}
            privacyMode={state.privacyMode}
            showSensitive={state.showSensitive}
            sensitiveMaskClass={vm.sensitiveMaskClass}
            exposureWindowDays={state.exposureWindowDays}
            notes={state.notes}
            symptoms={state.symptoms as any}
            screening={state.screening as any}
            urgencyFlags={state.urgencyFlags as any}
            riskFactors={state.riskFactors as any}
            specimenSites={state.specimenSites as any}
            findingsForContext={vm.findingsForContext}
            evidenceCountForFinding={vm.evidenceCountForFinding}
            actions={{
              setContext: actions.setContext,
              setShowSensitive: actions.setShowSensitive,

              toggleConsent: actions.toggleConsent as any,
              toggleUrgency: actions.toggleUrgency as any,
              toggleRisk: actions.toggleRisk as any,

              setExposureWindowDays: actions.setExposureWindowDays,
              toggleSymptom: actions.toggleSymptom as any,

              toggleScreening: actions.toggleScreening as any,
              toggleSite: actions.toggleSite as any,

              setNotes: actions.setNotes,

              applySuggestedDefaults: actions.applySuggestedDefaults,
              addStructuredFindingsFromChecklist: actions.addStructuredFindingsFromChecklist,

              setBanner: actions.setBanner,
            }}
          />

          <StdEvidencePanel
            context={state.context}
            busy={state.busy}
            consentMediaCapture={state.consent.mediaCapture}
            selectedEvidence={vm.selectedEvidence}
            evidenceForContext={vm.evidenceForContext}
            actions={{
              setBookmarkOpen: actions.setBookmarkOpen,
              setSelectedEvidenceId: actions.setSelectedEvidenceId,
              addDemoPinAnnotation: actions.addDemoPinAnnotation,
              setBanner: actions.setBanner,
            }}
          />

          <div className="space-y-4">
            <StdResultsAndCommsPanel
              busy={state.busy}
              sensitiveMaskClass={vm.sensitiveMaskClass}
              results={state.results}
              communications={state.communications}
              consentSensitiveHistoryDoc={state.consent.sensitiveHistoryDoc}
              followUp={state.followUp}
              actions={{
                seedResultsFromScreening: actions.seedResultsFromScreening,
                addCustomResult: actions.addCustomResult,
                updateResult: actions.updateResult,
                removeResult: actions.removeResult,
                exportOrdersAsFinding: actions.exportOrdersAsFinding,
                exportResultsAsFinding: actions.exportResultsAsFinding,

                addCommunicationEvent: actions.addCommunicationEvent,
                updateCommunicationEvent: actions.updateCommunicationEvent,
                removeCommunicationEvent: actions.removeCommunicationEvent,
                exportCommunicationCombo: actions.exportCommunicationCombo,
              }}
            />

            <StdPlanPanel
              busy={state.busy}
              sensitiveMaskClass={vm.sensitiveMaskClass}
              partnerPlan={state.partnerPlan}
              preventionPlan={state.preventionPlan}
              followUp={state.followUp}
              consentSensitiveHistoryDoc={state.consent.sensitiveHistoryDoc}
              summaryNote={vm.summaryNote}
              actions={{
                createManualFinding: actions.createManualFinding,
                setPartnerPlan: actions.setPartnerPlan,
                setPreventionPlan: actions.setPreventionPlan,
                setFollowUp: actions.setFollowUp,
                copySummaryNote: actions.copySummaryNote,
                exportSummaryAsFinding: actions.exportSummaryAsFinding,
              }}
            />
          </div>
        </div>
      </main>

      <StdBookmarkModal
        open={state.bookmarkOpen}
        busy={state.busy}
        context={state.context}
        onClose={() => actions.setBookmarkOpen(false)}
        onSave={actions.handleBookmark}
      />
    </div>
  );
}
