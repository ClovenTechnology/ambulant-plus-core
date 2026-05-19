import type { FamilyMember, PermissionsDraft } from './types';
import PermissionToggle from './PermissionToggle';

export default function FamilyPermissionsModal({
  open,
  member,
  draft,
  setDraft,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  member: FamilyMember | null;
  draft: PermissionsDraft;
  setDraft: React.Dispatch<React.SetStateAction<PermissionsDraft>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/60 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Edit permissions for {member.name}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Choose exactly what this relationship is allowed to do.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <PermissionToggle
            label="Join Televisit"
            value={draft.canJoinTelevisit}
            onChange={(v) => setDraft((p) => ({ ...p, canJoinTelevisit: v }))}
          />
          <PermissionToggle
            label="Book appointments"
            value={draft.canBookAppointments}
            onChange={(v) => setDraft((p) => ({ ...p, canBookAppointments: v }))}
          />
          <PermissionToggle
            label="View health summary"
            value={draft.canViewHighLevelSummary}
            onChange={(v) => setDraft((p) => ({ ...p, canViewHighLevelSummary: v }))}
          />

          <PermissionToggle
            label="Encounter summary"
            value={draft.modules.encounters.viewSummary}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  encounters: { ...p.modules.encounters, viewSummary: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Full encounter notes"
            value={draft.modules.encounters.viewFullNotes}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  encounters: { ...p.modules.encounters, viewFullNotes: v },
                },
              }))
            }
          />

          <PermissionToggle
            label="Appointments: book"
            value={draft.modules.appointments.book}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  appointments: { ...p.modules.appointments, book: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Appointments: cancel"
            value={draft.modules.appointments.cancel}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  appointments: { ...p.modules.appointments, cancel: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Appointments: reschedule"
            value={draft.modules.appointments.reschedule}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  appointments: { ...p.modules.appointments, reschedule: v },
                },
              }))
            }
          />

          <PermissionToggle
            label="Reminders: view"
            value={draft.modules.reminders.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  reminders: { ...p.modules.reminders, view: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Reminders: manage"
            value={draft.modules.reminders.manage}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  reminders: { ...p.modules.reminders, manage: v },
                },
              }))
            }
          />

          <PermissionToggle
            label="Medications: view"
            value={draft.modules.meds.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  meds: { ...p.modules.meds, view: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Medications: manage"
            value={draft.modules.meds.manage}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  meds: { ...p.modules.meds, manage: v },
                },
              }))
            }
          />

          <PermissionToggle
            label="Labs"
            value={draft.modules.labs.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  labs: { ...p.modules.labs, view: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Vitals"
            value={draft.modules.vitals.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  vitals: { ...p.modules.vitals, view: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="Reports"
            value={draft.modules.reports.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  reports: { ...p.modules.reports, view: v },
                },
              }))
            }
          />

          <PermissionToggle
            label="CarePort: view"
            value={draft.modules.careport.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  careport: { ...p.modules.careport, view: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="CarePort: manage"
            value={draft.modules.careport.manage}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  careport: { ...p.modules.careport, manage: v },
                },
              }))
            }
          />

          <PermissionToggle
            label="MedReach: view"
            value={draft.modules.medreach.view}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  medreach: { ...p.modules.medreach, view: v },
                },
              }))
            }
          />
          <PermissionToggle
            label="MedReach: manage"
            value={draft.modules.medreach.manage}
            onChange={(v) =>
              setDraft((p) => ({
                ...p,
                modules: {
                  ...p.modules,
                  medreach: { ...p.modules.medreach, manage: v },
                },
              }))
            }
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      </div>
    </div>
  );
}