// apps/admin-dashboard/lib/authz/scopeCatalog.ts

export type ScopeItem = {
  scope: string;
  label: string;
  desc?: string;
  danger?: boolean;
};

export type ScopeGroup = {
  key: string;
  title: string;
  description: string;
  items: ScopeItem[];
};

/**
 * ✅ CANONICAL SCOPE CATALOG
 * This is your source-of-truth. UI + API enforcement should align to these names.
 */
export const SCOPE_GROUPS: ScopeGroup[] = [
  {
    key: 'staff-communications',
    title: 'Staff & Communications',
    description: 'Internal staff identity, collaboration, meetings and communication governance.',
    items: [
      { scope: 'staff.directory.read', label: 'Read staff directory', desc: 'Search staff and view authorised staff profile information.' },
      { scope: 'staff.manage', label: 'Manage staff', desc: 'Update staff organisational data and lifecycle state.', danger: true },
      { scope: 'staff.roles.manage', label: 'Manage staff roles', desc: 'Assign or revoke direct staff roles and scopes.', danger: true },
      { scope: 'communications.use', label: 'Use internal communications', desc: 'Message and call eligible staff.' },
      { scope: 'meetings.create', label: 'Create meetings', desc: 'Create scheduled and instant meetings.' },
      { scope: 'meetings.moderate', label: 'Moderate meetings', desc: 'Host, admit, mute, remove and end meeting participants.', danger: true },
      { scope: 'meetings.invite_external', label: 'Invite external guests', desc: 'Invite verified external email guests.', danger: true },
      { scope: 'meetings.record', label: 'Record meetings', desc: 'Start and stop controlled meeting recordings.', danger: true },
      { scope: 'meetings.audit.read', label: 'Read meeting audit', desc: 'Review meeting attendance and communication audit evidence.' },
    ],
  },
  {
    key: 'applications-forms',
    title: 'Applications & Enterprise Forms',
    description: 'Publish opportunities, review canonical applications and govern reusable enterprise forms and submission data.',
    items: [
      { scope: 'forms.read', label: 'Read enterprise forms', desc: 'View form definitions, versions and publication state.' },
      { scope: 'forms.design', label: 'Design enterprise forms', desc: 'Create forms and edit draft form versions.' },
      { scope: 'forms.publish', label: 'Publish enterprise forms', desc: 'Publish, retire or archive enterprise form versions.', danger: true },
      { scope: 'forms.submissions.read', label: 'Read form submissions', desc: 'Review submitted form data within authorised workflows.' },
      { scope: 'forms.submissions.sensitive.read', label: 'Read sensitive form answers', desc: 'View fields explicitly classified as sensitive.', danger: true },
      { scope: 'opportunities.read', label: 'Read opportunities', desc: 'View opportunity definitions and publication state.' },
      { scope: 'opportunities.manage', label: 'Manage opportunities', desc: 'Create and edit opportunity drafts and paused listings.' },
      { scope: 'opportunities.publish', label: 'Publish opportunities', desc: 'Publish, pause and close public opportunity listings.', danger: true },
      { scope: 'applications.read', label: 'Read applications', desc: 'View canonical Application records and permitted recruitment metadata.' },
      { scope: 'applications.review', label: 'Review applications', desc: 'Move applications through governed review and shortlist stages.' },
      { scope: 'applications.assign', label: 'Assign application reviewers', desc: 'Assign active Staff profiles as application reviewers.' },
      { scope: 'applications.decision', label: 'Make application decisions', desc: 'Record terminal recruitment decisions such as decline.', danger: true },
      { scope: 'applications.documents.read', label: 'Read applicant documents', desc: 'View applicant-requested document metadata and obtain short-lived authorised downloads.', danger: true },
      { scope: 'applications.documents.request', label: 'Request applicant documents', desc: 'Create governed document requests and move eligible applications into the document-request stage.' },
      { scope: 'applications.documents.review', label: 'Review applicant documents', desc: 'Accept, reject, re-request and complete governed applicant-document review cycles.', danger: true },
    ],
  },
  {
    key: 'settings',
    title: 'Settings',
    description: 'Tenant-scoped configuration (identity, branding, defaults).',
    items: [
      { scope: 'settings.read', label: 'Read settings', desc: 'View settings pages and configuration values.' },
      { scope: 'settings.write', label: 'Write settings', desc: 'Change and save settings (high impact).', danger: true },
    ],
  },
  {
    key: 'reports',
    title: 'Reports',
    description: 'Lifecycle + permission model as documented in Reports governance.',
    items: [
      { scope: 'reports.read', label: 'Read reports', desc: 'View report details in-app.' },
      { scope: 'reports.create', label: 'Create draft', desc: 'Generate / create a draft report.' },
      { scope: 'reports.edit_draft', label: 'Edit draft', desc: 'Edit drafts before submission.' },
      { scope: 'reports.submit', label: 'Submit', desc: 'Submit draft for review (locks content).' },
      { scope: 'reports.verify', label: 'Verify', desc: 'Verify / approve for publishing.', danger: true },
      { scope: 'reports.publish', label: 'Publish', desc: 'Release to intended audience.', danger: true },
      { scope: 'reports.amend', label: 'Amend', desc: 'Issue correction while preserving audit trail.', danger: true },
      { scope: 'reports.redact', label: 'Redact / void', desc: 'Restrict/void visibility due to compliance.', danger: true },
      { scope: 'reports.export', label: 'Export', desc: 'Export PDF/CSV.', danger: true },
      { scope: 'reports.share_link', label: 'Share link', desc: 'Generate external viewer link (time-limited).', danger: true },
      { scope: 'reports.hard_delete', label: 'Hard delete', desc: 'Exceptional cases only; prefer archive.', danger: true },
    ],
  },
  {
    key: 'finance',
    title: 'Payouts & Finance',
    description: 'Payout runs, approvals, exports and refunds.',
    items: [
      { scope: 'finance.read', label: 'Read finance', desc: 'View statements, balances, payouts, refunds.' },
      { scope: 'finance.export', label: 'Export finance', desc: 'Export finance data (CSV/PDF).', danger: true },
      { scope: 'finance.payouts.run', label: 'Run payouts', desc: 'Initiate payout run (creates batch).', danger: true },
      { scope: 'finance.payouts.approve', label: 'Approve payouts', desc: 'Approve payout run (high risk).', danger: true },
      { scope: 'finance.refunds', label: 'Refunds', desc: 'Issue or manage refunds/chargebacks.', danger: true },
    ],
  },
  {
    key: 'ops',
    title: 'Operations',
    description: 'Dispatch workflows and support operations.',
    items: [
      { scope: 'ops.read', label: 'Read ops', desc: 'View ops queues, dispatches, support cases.' },
      { scope: 'ops.dispatch.write', label: 'Dispatch write', desc: 'Create/update dispatch tasks.', danger: true },
      { scope: 'ops.support.write', label: 'Support write', desc: 'Update support tickets/notes/escalations.', danger: true },
    ],
  },
  {
    key: 'compliance',
    title: 'Compliance',
    description: 'Credentialing verification, audits, and exports.',
    items: [
      { scope: 'compliance.read', label: 'Read compliance', desc: 'View compliance dashboard and queues.' },
      { scope: 'compliance.verify_clinicians', label: 'Verify clinicians', desc: 'Approve/reject clinicians & credentials.', danger: true },
      { scope: 'compliance.audit.read', label: 'Read audits', desc: 'View audit events and trails.' },
      { scope: 'compliance.audit.export', label: 'Export audits', desc: 'Export audit logs (sensitive).', danger: true },
    ],
  },
];

export const ALL_SCOPES = new Set<string>(SCOPE_GROUPS.flatMap((g) => g.items.map((i) => i.scope)));

export const DANGER_SCOPES = new Set<string>(
  SCOPE_GROUPS.flatMap((g) => g.items.filter((i) => i.danger).map((i) => i.scope))
);

export const SCOPE_META = new Map<
  string,
  { groupKey: string; label: string; desc?: string; danger: boolean }
>(
  SCOPE_GROUPS.flatMap((g) =>
    g.items.map((i) => [
      i.scope,
      { groupKey: g.key, label: i.label, desc: i.desc, danger: Boolean(i.danger) },
    ])
  )
);

/**
 * ✅ LEGACY → CANONICAL ALIASES
 * Add to this as you discover old scope names in rolePresets / DB.
 */
export const SCOPE_ALIASES: Record<string, string> = {
  // staff / communications
  'staff.read': 'staff.directory.read',
  'staff.directory': 'staff.directory.read',
  'staff.write': 'staff.manage',
  'staff.roles': 'staff.roles.manage',
  'communications': 'communications.use',
  'meetings.host': 'meetings.moderate',
  'meetings.external': 'meetings.invite_external',
  'meetings.audit': 'meetings.audit.read',

  // enterprise forms
  'forms.view': 'forms.read',
  'forms.write': 'forms.design',
  'forms.edit': 'forms.design',
  'forms.release': 'forms.publish',
  'forms.submissions': 'forms.submissions.read',
  'forms.sensitive': 'forms.submissions.sensitive.read',

  // reports
  'reports.edit': 'reports.edit_draft',
  'reports.editdraft': 'reports.edit_draft',
  'reports.edit-draft': 'reports.edit_draft',
  'reports.submit_for_review': 'reports.submit',
  'reports.submit-for-review': 'reports.submit',
  'reports.approve': 'reports.verify',
  'reports.review': 'reports.verify',
  'reports.release': 'reports.publish',
  'reports.share': 'reports.share_link',
  'reports.sharelink': 'reports.share_link',
  'reports.link': 'reports.share_link',
  'reports.delete': 'reports.hard_delete',

  // ops
  'ops.dispatch': 'ops.dispatch.write',
  'ops.support': 'ops.support.write',

  // compliance/audit
  'audit.read': 'compliance.audit.read',
  'audit.export': 'compliance.audit.export',
  'compliance.verify': 'compliance.verify_clinicians',

  // settings
  'settings.update': 'settings.write',
  'settings.admin': 'settings.write',

  // finance
  'finance.payouts': 'finance.payouts.run',
  'finance.payouts.create': 'finance.payouts.run',
};

function tidyToken(s: string) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/^[\[\(\{]+|[\]\)\}]+$/g, '') // strip wrapper brackets
    .replace(/;+$/g, '')
    .replace(/\s+/g, '');
}

export function normalizeScope(raw: string): string {
  const t = tidyToken(raw);
  if (!t) return '';
  // keep underscores (canonical uses them), but tolerate ":" or "/" etc.
  const relaxed = t.replace(/[:/\\]+/g, '.');
  return SCOPE_ALIASES[relaxed] ?? relaxed;
}

export function parseScopesText(input: string): {
  scopes: string[];
  report: { changed: Array<{ from: string; to: string }>; dropped: string[] };
} {
  const tokens = (input || '')
    .split(/[\s,]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const changed: Array<{ from: string; to: string }> = [];
  const dropped: string[] = [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const tok of tokens) {
    const to = normalizeScope(tok);
    if (!to) {
      dropped.push(tok);
      continue;
    }
    if (to !== tidyToken(tok)) changed.push({ from: tok, to });

    if (!seen.has(to)) {
      seen.add(to);
      out.push(to);
    }
  }

  return { scopes: out, report: { changed, dropped } };
}

/**
 * Best-effort scope derivation from audit action string (until API returns meta.scope).
 */
export function deriveScopeFromAuditAction(action: string): string | null {
  const a = (action || '').toLowerCase();

  if (a.includes('role')) return 'settings.write';
  if (a.includes('settings')) return 'settings.write';

  if (a.includes('enterprise_form') || a.includes('form.')) {
    if (a.includes('submission')) return 'forms.submissions.read';
    if (a.includes('publish') || a.includes('retire') || a.includes('archive')) return 'forms.publish';
    if (a.includes('create') || a.includes('update') || a.includes('structure') || a.includes('version')) return 'forms.design';
    return 'forms.read';
  }

  if (a.includes('report')) {
    if (a.includes('create') || a.includes('draft_create')) return 'reports.create';
    if (a.includes('edit')) return 'reports.edit_draft';
    if (a.includes('submit')) return 'reports.submit';
    if (a.includes('verify') || a.includes('approve') || a.includes('review')) return 'reports.verify';
    if (a.includes('publish') || a.includes('release')) return 'reports.publish';
    if (a.includes('amend') || a.includes('correct')) return 'reports.amend';
    if (a.includes('redact') || a.includes('void')) return 'reports.redact';
    if (a.includes('share')) return 'reports.share_link';
    if (a.includes('export')) return 'reports.export';
    if (a.includes('delete') || a.includes('hard_delete')) return 'reports.hard_delete';
    return 'reports.read';
  }

  if (a.includes('payout')) {
    if (a.includes('approve')) return 'finance.payouts.approve';
    return 'finance.payouts.run';
  }
  if (a.includes('refund')) return 'finance.refunds';
  if (a.includes('finance') || a.includes('statement') || a.includes('invoice')) return 'finance.read';
  if (a.includes('dispatch') || a.includes('medreach') || a.includes('careport')) return 'ops.dispatch.write';
  if (a.includes('support') || a.includes('ticket')) return 'ops.support.write';
  if (a.includes('audit')) {
    if (a.includes('export')) return 'compliance.audit.export';
    return 'compliance.audit.read';
  }
  if (a.includes('credential') || a.includes('verify_clinician')) return 'compliance.verify_clinicians';

  return null;
}
