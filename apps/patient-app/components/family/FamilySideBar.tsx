import {
  Loader2,
  RotateCcw,
  ShieldOff,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import FamilyInviteForm from './FamilyInviteForm';
import type { FamilyMember, RelationshipCategory } from './types';
import { CATEGORY_LABELS, cn, formatExpiry, statusLabel, statusTone } from './utils';

export default function FamilySidebar({
  members,
  selectedId,
  onSelect,
  onOpenPermissions,
  onRevoke,
  onResend,
  onCancelInvite,
  actionBusyId,
  loading,
  loadError,
  usingMock,
  mockNote,
  onRetry,
  inviteName,
  setInviteName,
  inviteContact,
  setInviteContact,
  inviteRelation,
  setInviteRelation,
  inviting,
  inviteError,
  isPremium,
  onInviteSubmit,
}: {
  members: FamilyMember[];
  selectedId: string | null;
  onSelect: (member: FamilyMember) => void;
  onOpenPermissions: (member: FamilyMember) => void;
  onRevoke: (relationshipId?: string) => void;
  onResend: (invitationId?: string) => void;
  onCancelInvite: (invitationId?: string) => void;
  actionBusyId: string | null;
  loading: boolean;
  loadError: string | null;
  usingMock: boolean;
  mockNote: string | null;
  onRetry: () => void;
  inviteName: string;
  setInviteName: (v: string) => void;
  inviteContact: string;
  setInviteContact: (v: string) => void;
  inviteRelation: RelationshipCategory;
  setInviteRelation: (v: RelationshipCategory) => void;
  inviting: boolean;
  inviteError: string | null;
  isPremium: boolean;
  onInviteSubmit: () => void;
}) {
  return (
    <aside className="rounded-[28px] border border-white/60 bg-white/84 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Your care circle
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">
            Family members &amp; trusted friends
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-500">
            Add the people whose health you help coordinate and switch between them with clear context.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your care circle…
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      {usingMock ? (
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3">
          <div className="text-xs font-medium text-sky-900">Development fallback data</div>
          <div className="mt-1 text-[11px] leading-5 text-sky-800">
            Development fallback mode is enabled{mockNote ? ` (${mockNote})` : ''}.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-[11px] font-medium text-sky-900 hover:bg-sky-50"
            >
              Retry live data
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !loadError && members.length === 0 && !usingMock ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-4 text-sm text-slate-500">
          You haven&apos;t added any family members or friends yet. Use the invite form below to send your first connection request.
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {(['Partner', 'Child', 'Parent', 'Other'] as RelationshipCategory[]).map((cat) => {
          const items = members.filter((m) => m.category === cat);
          if (!items.length) return null;

          return (
            <div key={cat}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {CATEGORY_LABELS[cat]}
              </div>
              <ul className="space-y-2">
                {items.map((m) => {
                  const isSelected = selectedId === m.id;
                  const revokeBusy = actionBusyId === `rel-${m.relationshipId}`;
                  const resendBusy = actionBusyId === `inv-resend-${m.invitationId}`;
                  const cancelBusy = actionBusyId === `inv-cancel-${m.invitationId}`;

                  return (
                    <li key={m.id}>
                      <div
                        className={cn(
                          'w-full rounded-[22px] border px-3 py-3 transition-all duration-200',
                          isSelected
                            ? 'border-indigo-200 bg-indigo-50/70 shadow-sm'
                            : 'border-slate-200 bg-white/86 hover:-translate-y-0.5 hover:bg-white',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(m)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium text-slate-900">{m.name}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                  {m.relationLabel}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                                {m.access.canBook ? (
                                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                    Book
                                  </span>
                                ) : null}
                                {m.access.canViewHealth ? (
                                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                    Health
                                  </span>
                                ) : null}
                                {m.access.canJoinTelevisit ? (
                                  <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-sky-700">
                                    Televisit
                                  </span>
                                ) : null}
                              </div>
                              {m.status === 'pending-invite' && (m.invitedEmail || m.invitedPhone) ? (
                                <div className="mt-2 text-[11px] text-slate-500">
                                  {m.invitedEmail || m.invitedPhone}
                                </div>
                              ) : null}
                              {m.status === 'pending-invite' && m.expiresAt ? (
                                <div className="mt-1 text-[10px] text-slate-400">
                                  Expires: {formatExpiry(m.expiresAt)}
                                </div>
                              ) : null}
                            </div>

                            <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium', statusTone(m.status))}>
                              {statusLabel(m.status)}
                            </span>
                          </div>
                        </button>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.status === 'active' && m.relationshipId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenPermissions(m)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700"
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Edit permissions
                              </button>
                              <button
                                type="button"
                                onClick={() => onRevoke(m.relationshipId)}
                                disabled={revokeBusy}
                                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-700 disabled:opacity-60"
                              >
                                <ShieldOff className="h-3.5 w-3.5" />
                                {revokeBusy ? 'Revoking…' : 'Revoke access'}
                              </button>
                            </>
                          ) : null}

                          {m.status === 'pending-invite' && m.invitationId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onResend(m.invitationId)}
                                disabled={resendBusy || cancelBusy}
                                className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-700 disabled:opacity-60"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {resendBusy ? 'Resending…' : 'Resend'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onCancelInvite(m.invitationId)}
                                disabled={resendBusy || cancelBusy}
                                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-700 disabled:opacity-60"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {cancelBusy ? 'Cancelling…' : 'Cancel invite'}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <FamilyInviteForm
        inviteName={inviteName}
        setInviteName={setInviteName}
        inviteContact={inviteContact}
        setInviteContact={setInviteContact}
        inviteRelation={inviteRelation}
        setInviteRelation={setInviteRelation}
        inviting={inviting}
        inviteError={inviteError}
        isPremium={isPremium}
        onSubmit={onInviteSubmit}
      />
    </aside>
  );
}
