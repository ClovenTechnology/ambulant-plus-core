//apps/clinician-app/app/workspaces/surgery/page.tsx
'use client';

import React from 'react';
import { SURGERY_DOMAINS } from '@/src/components/workspaces/surgery/constants';
import { useSurgeryWorkspace } from '@/src/components/workspaces/surgery/useSurgeryWorkspace';

export default function SurgeryWorkspacePage(props: {
  patientId?: string;
  encounterId?: string;
  clinicianId?: string;
}) {
  const vm = useSurgeryWorkspace(props);
  const { state, actions } = vm;

  const sensitiveClass = state.privacyMode ? 'blur-sm select-none' : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs text-gray-500">Ambulant+ · Surgical Suite</p>
            <h1 className="text-xl font-semibold">Surgery Workspace</h1>
            <p className="text-sm text-gray-600">
              Peri-op documentation with safety-first export to Findings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1">
              Patient: <span className="font-mono">{vm.patientId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1">
              Encounter: <span className="font-mono">{vm.encounterId}</span>
            </span>
            <span className="rounded-full border bg-white px-2 py-1">
              Priority: <span className="font-semibold">{state.priority.toUpperCase()}</span>
            </span>
            <button
              type="button"
              onClick={() => actions.setPrivacyMode(!state.privacyMode)}
              className={
                'rounded-full border px-2 py-1 ' +
                (state.privacyMode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white')
              }
            >
              Privacy mode
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 space-y-4">
        {state.banner ? (
          <div
            className={
              'rounded-lg border px-3 py-2 text-sm ' +
              (state.banner.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : state.banner.kind === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-blue-200 bg-blue-50 text-blue-900')
            }
          >
            {state.banner.text}
          </div>
        ) : null}

        <section className="rounded-xl border bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Surgical subdomain</h2>
              <p className="text-xs text-gray-500">{vm.selectedDomain.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Priority</label>
              <select
                className="rounded border px-2 py-1.5 text-sm"
                value={state.priority}
                onChange={(e) => actions.setPriority(e.target.value as any)}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SURGERY_DOMAINS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => actions.setDomain(d.key)}
                className={
                  'rounded-full border px-3 py-1.5 text-xs ' +
                  (state.domain === d.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-gray-50')
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pre-op */}
          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">Pre-op assessment</h3>

            <label className="block text-xs text-gray-600">
              Pre-op diagnosis
              <input
                className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                value={state.preOpDiagnosis}
                onChange={(e) => actions.setPreOpDiagnosis(e.target.value)}
                placeholder="e.g., Acute appendicitis"
              />
            </label>

            <label className="block text-xs text-gray-600">
              Surgical indication
              <textarea
                className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                rows={3}
                value={state.indication}
                onChange={(e) => actions.setIndication(e.target.value)}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Risks / anesthesia considerations
              <textarea
                className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                rows={2}
                value={state.risksNotes}
                onChange={(e) => actions.setRisksNotes(e.target.value)}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Allergies
              <textarea
                className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                rows={2}
                value={state.allergyNotes}
                onChange={(e) => actions.setAllergyNotes(e.target.value)}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Current meds / anticoagulation
              <textarea
                className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                rows={2}
                value={state.medicationNotes}
                onChange={(e) => actions.setMedicationNotes(e.target.value)}
              />
            </label>

            <button
              onClick={actions.exportPreOpAsFinding}
              className="w-full rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
              type="button"
            >
              Export pre-op assessment
            </button>
          </section>

          {/* Safety + Procedure */}
          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Safety checklist & procedure note</h3>
              <span className="text-xs rounded-full border px-2 py-1 bg-gray-50">
                Checklist {vm.checklistCompletion}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ['identityConfirmed', 'Identity confirmed'],
                ['consentConfirmed', 'Consent confirmed'],
                ['procedureConfirmed', 'Procedure confirmed'],
                ['sideSiteMarked', 'Side/site marked'],
                ['allergiesChecked', 'Allergies checked'],
                ['anticoagReviewed', 'Anticoag reviewed'],
                ['fastingStatusChecked', 'Fasting checked'],
                ['antibioticProphylaxisPlanned', 'Antibiotic prophylaxis planned'],
                ['bloodProductPlan', 'Blood products plan'],
                ['implantsAvailable', 'Implants available'],
                ['equipmentCheckComplete', 'Equipment check complete'],
                ['whoTimeoutComplete', 'WHO timeout complete'],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-gray-700">
                  <input
                    type="checkbox"
                    checked={state.checklist[k]}
                    onChange={() => actions.toggleChecklist(k)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="border-t pt-3 space-y-2">
              <label className="block text-xs text-gray-600">
                Procedure name
                <input
                  className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                  value={state.procedure.procedureName}
                  onChange={(e) => actions.setProcedure({ procedureName: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-600">
                  Approach
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={state.procedure.approach}
                    onChange={(e) => actions.setProcedure({ approach: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  Anesthesia
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={state.procedure.anesthesia}
                    onChange={(e) => actions.setProcedure({ anesthesia: e.target.value })}
                  />
                </label>
              </div>

              <label className="block text-xs text-gray-600">
                Intra-op findings
                <textarea
                  className={'mt-1 w-full rounded border px-2 py-1.5 text-sm ' + sensitiveClass}
                  rows={2}
                  value={state.procedure.findings}
                  onChange={(e) => actions.setProcedure({ findings: e.target.value })}
                />
              </label>

              <label className="block text-xs text-gray-600">
                Key steps summary
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  rows={2}
                  value={state.procedure.stepsSummary}
                  onChange={(e) => actions.setProcedure({ stepsSummary: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-600">
                  Estimated blood loss (ml)
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={state.procedure.bloodLossMl}
                    onChange={(e) => actions.setProcedure({ bloodLossMl: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  Specimens sent
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                    value={state.procedure.specimensSent}
                    onChange={(e) => actions.setProcedure({ specimensSent: e.target.value })}
                  />
                </label>
              </div>

              <label className="block text-xs text-gray-600">
                Implants / devices
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  value={state.procedure.implantsDevices}
                  onChange={(e) => actions.setProcedure({ implantsDevices: e.target.value })}
                />
              </label>

              <label className="block text-xs text-gray-600">
                Complications
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  value={state.procedure.complications}
                  onChange={(e) => actions.setProcedure({ complications: e.target.value })}
                />
              </label>

              <label className="block text-xs text-gray-600">
                Disposition
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  value={state.procedure.disposition}
                  onChange={(e) => actions.setProcedure({ disposition: e.target.value })}
                />
              </label>

              <button
                onClick={actions.exportProcedureAsFinding}
                className="w-full rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                type="button"
              >
                Export procedure note
              </button>
            </div>
          </section>

          {/* Post-op */}
          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold">Post-op plan</h3>

            <label className="block text-xs text-gray-600">
              Analgesia plan
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={state.postOp.analgesiaPlan}
                onChange={(e) => actions.setPostOp({ analgesiaPlan: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Antibiotic plan
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={state.postOp.antibioticPlan}
                onChange={(e) => actions.setPostOp({ antibioticPlan: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              DVT prophylaxis
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={state.postOp.dvtPlan}
                onChange={(e) => actions.setPostOp({ dvtPlan: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Wound care
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={state.postOp.woundCare}
                onChange={(e) => actions.setPostOp({ woundCare: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Mobilization
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={state.postOp.mobilization}
                onChange={(e) => actions.setPostOp({ mobilization: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Nutrition
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={state.postOp.nutrition}
                onChange={(e) => actions.setPostOp({ nutrition: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Red flags to advise
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={state.postOp.redFlags}
                onChange={(e) => actions.setPostOp({ redFlags: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Follow-up date
              <input
                type="date"
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                value={state.postOp.followUpDate}
                onChange={(e) => actions.setPostOp({ followUpDate: e.target.value })}
              />
            </label>

            <label className="block text-xs text-gray-600">
              Follow-up notes
              <textarea
                className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                value={state.postOp.followUpNotes}
                onChange={(e) => actions.setPostOp({ followUpNotes: e.target.value })}
              />
            </label>

            <button
              onClick={actions.exportPostOpAsFinding}
              className="w-full rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
              type="button"
            >
              Export post-op plan
            </button>
          </section>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Clinical summary (auto-composed)</h3>
              <p className="text-xs text-gray-500">
                Copy or export as peri-op summary finding.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={actions.copySummary}
                type="button"
                className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Copy summary
              </button>
              <button
                onClick={actions.exportSummaryAsFinding}
                type="button"
                className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Export summary
              </button>
              <button
                onClick={actions.resetAll}
                type="button"
                className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>

          <textarea
            className="mt-3 w-full rounded border bg-gray-50 px-2 py-2 text-xs font-mono text-gray-800"
            rows={16}
            readOnly
            value={vm.summaryNote}
          />
        </section>
      </main>
    </div>
  );
}
