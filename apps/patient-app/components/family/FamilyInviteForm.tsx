import type { RelationshipCategory } from './types';
import { Plus, UserRoundPlus } from 'lucide-react';

export default function FamilyInviteForm({
  inviteName,
  setInviteName,
  inviteContact,
  setInviteContact,
  inviteRelation,
  setInviteRelation,
  inviting,
  inviteError,
  isPremium,
  onSubmit,
}: {
  inviteName: string;
  setInviteName: (v: string) => void;
  inviteContact: string;
  setInviteContact: (v: string) => void;
  inviteRelation: RelationshipCategory;
  setInviteRelation: (v: RelationshipCategory) => void;
  inviting: boolean;
  inviteError: string | null;
  isPremium: boolean;
  onSubmit: () => void;
}) {
  return (
    <div id="family-invite" className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-slate-900">Add family / friend</div>
          <div className="mt-1 text-xs text-slate-500">
            Send an invite and let them accept securely.
          </div>
        </div>
        <UserRoundPlus className="h-4 w-4 text-slate-400" />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <input
          type="text"
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          placeholder="Full name"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
        />
        <input
          type="text"
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          placeholder="Email or mobile number"
          value={inviteContact}
          onChange={(e) => setInviteContact(e.target.value)}
        />
        <select
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          value={inviteRelation}
          onChange={(e) => setInviteRelation(e.target.value as RelationshipCategory)}
        >
          <option value="Partner">Spouse / Partner</option>
          <option value="Child">Child / Dependant</option>
          <option value="Parent">Parent / Elder</option>
          <option value="Other">Friend / Care circle</option>
        </select>

        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          disabled={!inviteName.trim() || !inviteContact.trim() || inviting || !isPremium}
        >
          <Plus className="h-4 w-4" />
          <span>{inviting ? 'Sending…' : 'Send invitation'}{!isPremium ? ' (Premium)' : ''}</span>
        </button>

        {inviteError ? <p className="text-xs text-rose-600">{inviteError}</p> : null}

        <p className="text-[11px] leading-5 text-slate-500">
          Pending invites can be resent or cancelled, and active links now support permission editing.
        </p>
      </div>
    </div>
  );
}