import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';

export const COMPLIANCE_RENEWAL_TIME_ZONE = 'Africa/Johannesburg';
export const DEFAULT_RENEWAL_THRESHOLDS = [30, 14, 7, 1, 0] as const;

export type RenewalGroup =
  | 'ALL'
  | 'CLINICIAN'
  | 'CAREPORT'
  | 'MEDREACH'
  | 'CLIENT'
  | 'PATIENT'
  | 'STAFF'
  | 'CORPORATE';

export type RenewalItem = {
  key: string;
  source: 'COMPLIANCE_CREDENTIAL' | 'CLINICIAN_PROFILE' | 'CLINICIAN_CHECK' | 'STAFF_DOCUMENT' | 'PLATFORM_INSURANCE';
  credentialId: string | null;
  group: Exclude<RenewalGroup, 'ALL'>;
  holderType: string;
  holderSubtype: string | null;
  holderId: string;
  holderName: string;
  holderEmail: string | null;
  credentialType: string;
  credentialLabel: string;
  credentialNumber: string | null;
  issuingAuthority: string | null;
  authorityClass: string;
  enforcementClass: string;
  enforcementPoint: string;
  enforcementScope: string | null;
  state: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  dueBucket: 'OVERDUE' | 'TODAY' | 'THIS_WEEK' | 'NEXT_14_DAYS' | 'NEXT_30_DAYS' | 'FUTURE' | 'MISSING_EXPIRY';
  reminderDays: number[];
  autoRemindersEnabled: boolean;
  lastReminderAt: string | null;
};

type RenewalFilters = {
  group?: RenewalGroup;
  due?: 'all' | 'today' | 'week' | 'month' | 'overdue' | 'missing' | 'range';
  from?: string;
  to?: string;
  q?: string;
};

function clean(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function dateKey(value: Date, timeZone = COMPLIANCE_RENEWAL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function keyToUtcDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function daysUntilExpiry(expiresAt: Date | null | undefined, now = new Date()) {
  if (!expiresAt) return null;
  const today = keyToUtcDate(dateKey(now));
  const expiry = keyToUtcDate(dateKey(expiresAt));
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

function dueBucket(days: number | null): RenewalItem['dueBucket'] {
  if (days == null) return 'MISSING_EXPIRY';
  if (days < 0) return 'OVERDUE';
  if (days === 0) return 'TODAY';
  if (days <= 7) return 'THIS_WEEK';
  if (days <= 14) return 'NEXT_14_DAYS';
  if (days <= 30) return 'NEXT_30_DAYS';
  return 'FUTURE';
}

function groupForHolderType(holderType: string): Exclude<RenewalGroup, 'ALL'> {
  const value = holderType.toUpperCase();
  if (value.startsWith('CLINICIAN')) return 'CLINICIAN';
  if (value.startsWith('CAREPORT')) return 'CAREPORT';
  if (value.startsWith('MEDREACH')) return 'MEDREACH';
  if (value.startsWith('CLIENT')) return 'CLIENT';
  if (value.startsWith('PATIENT')) return 'PATIENT';
  if (value.startsWith('STAFF') || value.startsWith('ADMIN')) return 'STAFF';
  return 'CORPORATE';
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function renewalItem(input: Omit<RenewalItem, 'daysUntilExpiry' | 'dueBucket'> & { expiresAtDate?: Date | null }): RenewalItem {
  const days = daysUntilExpiry(input.expiresAtDate ?? (input.expiresAt ? new Date(input.expiresAt) : null));
  const { expiresAtDate: _expiresAtDate, ...base } = input;
  return {
    ...base,
    daysUntilExpiry: days,
    dueBucket: dueBucket(days),
  };
}

function normaliseCyberSettings(value: any) {
  const raw = value?.cyberLiability && typeof value.cyberLiability === 'object'
    ? value.cyberLiability
    : {};
  return {
    enabled: raw.enabled === true,
    insurerName: clean(raw.insurerName, 240),
    policyNumber: clean(raw.policyNumber, 240),
    effectiveDate: clean(raw.effectiveDate, 20) || null,
    expiryDate: clean(raw.expiryDate, 20) || null,
    coverageLimitZar:
      raw.coverageLimitZar === null || raw.coverageLimitZar === undefined || raw.coverageLimitZar === ''
        ? null
        : Number.isFinite(Number(raw.coverageLimitZar))
          ? Number(raw.coverageLimitZar)
          : null,
    excessZar:
      raw.excessZar === null || raw.excessZar === undefined || raw.excessZar === ''
        ? null
        : Number.isFinite(Number(raw.excessZar))
          ? Number(raw.excessZar)
          : null,
    territorialScope: clean(raw.territorialScope, 500),
    incidentResponseContact: clean(raw.incidentResponseContact, 500),
    renewalContactEmail: clean(raw.renewalContactEmail, 320) || null,
    policyDocumentRef: clean(raw.policyDocumentRef, 700),
    notesInternal: clean(raw.notesInternal, 4000),
  };
}

function insurancePolicyRows(value: any): any[] {
  return Array.isArray(value?.policies) ? value.policies : [];
}

async function readRawItems(): Promise<RenewalItem[]> {
  const [credentials, clinicians, clinicianChecks, staffDocuments, insuranceSetting] = await Promise.all([
    prisma.complianceCredential.findMany({
      where: { state: { notIn: ['SUPERSEDED', 'ARCHIVED', 'NOT_APPLICABLE'] } },
      orderBy: [{ expiresAt: 'asc' }, { updatedAt: 'desc' }],
      take: 5000,
    }),
    prisma.clinicianProfile.findMany({
      where: {
        OR: [
          { boardCertificateExpires: { not: null } },
          { idExpiry: { not: null } },
          { piInsuranceExpiry: { not: null } },
        ],
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        email: true,
        specialty: true,
        regulatorBody: true,
        regulatorRegistration: true,
        boardCertificateNumber: true,
        boardCertificateIssuer: true,
        boardCertificateExpires: true,
        idIssuingCountry: true,
        idExpiry: true,
        piInsuranceProvider: true,
        piInsuranceNumber: true,
        piInsuranceExpiry: true,
      },
      take: 5000,
    }),
    prisma.clinicianComplianceCheck.findMany({
      where: { expiresAt: { not: null } },
      select: {
        id: true,
        orgId: true,
        clinicianId: true,
        kind: true,
        regulator: true,
        status: true,
        expiresAt: true,
      },
      orderBy: { expiresAt: 'asc' },
      take: 5000,
    }),
    prisma.staffEmploymentDocument.findMany({
      where: { expiresAt: { not: null }, state: { not: 'deleted' } },
      select: {
        id: true,
        documentType: true,
        title: true,
        expiresAt: true,
        state: true,
        staffProfile: { select: { id: true, name: true, email: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take: 5000,
    }),
    prisma.platformSetting.findUnique({
      where: { key: 'professional-indemnity.v1' },
      select: { value: true },
    }),
  ]);

  const clinicianIds = Array.from(new Set(clinicianChecks.map((row) => row.clinicianId).filter(Boolean)));
  const checkClinicians = clinicianIds.length
    ? await prisma.clinicianProfile.findMany({
        where: { id: { in: clinicianIds } },
        select: { id: true, displayName: true, email: true, specialty: true },
      })
    : [];
  const checkClinicianById = new Map(checkClinicians.map((row) => [row.id, row]));

  const items: RenewalItem[] = [];

  for (const row of credentials) {
    items.push(
      renewalItem({
        key: `credential:${row.id}`,
        source: 'COMPLIANCE_CREDENTIAL',
        credentialId: row.id,
        group: groupForHolderType(row.holderType),
        holderType: row.holderType,
        holderSubtype: row.holderSubtype,
        holderId: row.holderId,
        holderName: row.holderName,
        holderEmail: row.holderEmail,
        credentialType: row.credentialType,
        credentialLabel: row.credentialLabel,
        credentialNumber: row.credentialNumber,
        issuingAuthority: row.issuingAuthority,
        authorityClass: row.authorityClass,
        enforcementClass: row.enforcementClass,
        enforcementPoint: row.enforcementPoint,
        enforcementScope: row.enforcementScope,
        state: row.state,
        expiresAt: toIso(row.expiresAt),
        expiresAtDate: row.expiresAt,
        reminderDays: row.reminderDays,
        autoRemindersEnabled: row.autoRemindersEnabled,
        lastReminderAt: toIso(row.lastReminderAt),
      }),
    );
  }

  for (const row of clinicians) {
    const holderName = row.displayName || row.email || row.userId;
    const subtype = row.specialty || 'CLINICIAN';
    if (row.boardCertificateExpires) {
      items.push(
        renewalItem({
          key: `legacy:clinician:${row.id}:board-certificate`,
          source: 'CLINICIAN_PROFILE',
          credentialId: null,
          group: 'CLINICIAN',
          holderType: 'CLINICIAN',
          holderSubtype: subtype,
          holderId: row.id,
          holderName,
          holderEmail: row.email,
          credentialType: 'PROFESSIONAL_REGISTRATION',
          credentialLabel: 'Professional registration / board certificate',
          credentialNumber: row.boardCertificateNumber || row.regulatorRegistration,
          issuingAuthority: row.boardCertificateIssuer || row.regulatorBody,
          authorityClass: 'UNCLASSIFIED_LEGACY',
          enforcementClass: 'MANUAL_REVIEW',
          enforcementPoint: 'PRIVILEGE_GATE',
          enforcementScope: 'CLINICAL_PRACTICE',
          state: 'VALID',
          expiresAt: row.boardCertificateExpires.toISOString(),
          expiresAtDate: row.boardCertificateExpires,
          reminderDays: [30, 14, 7, 1],
          autoRemindersEnabled: true,
          lastReminderAt: null,
        }),
      );
    }
    if (row.idExpiry) {
      items.push(
        renewalItem({
          key: `legacy:clinician:${row.id}:identity`,
          source: 'CLINICIAN_PROFILE',
          credentialId: null,
          group: 'CLINICIAN',
          holderType: 'CLINICIAN',
          holderSubtype: subtype,
          holderId: row.id,
          holderName,
          holderEmail: row.email,
          credentialType: 'IDENTITY_DOCUMENT',
          credentialLabel: 'Identity / passport document',
          credentialNumber: null,
          issuingAuthority: row.idIssuingCountry,
          authorityClass: 'AMBULANT_POLICY',
          enforcementClass: 'MANUAL_REVIEW',
          enforcementPoint: 'RENEWAL_GATE',
          enforcementScope: 'IDENTITY_ASSURANCE',
          state: 'VALID',
          expiresAt: row.idExpiry.toISOString(),
          expiresAtDate: row.idExpiry,
          reminderDays: [30, 14, 7, 1],
          autoRemindersEnabled: true,
          lastReminderAt: null,
        }),
      );
    }
    if (row.piInsuranceExpiry) {
      items.push(
        renewalItem({
          key: `legacy:clinician:${row.id}:pi-insurance`,
          source: 'CLINICIAN_PROFILE',
          credentialId: null,
          group: 'CLINICIAN',
          holderType: 'CLINICIAN',
          holderSubtype: subtype,
          holderId: row.id,
          holderName,
          holderEmail: row.email,
          credentialType: 'PROFESSIONAL_INDEMNITY',
          credentialLabel: 'Professional indemnity / malpractice cover',
          credentialNumber: row.piInsuranceNumber,
          issuingAuthority: row.piInsuranceProvider,
          authorityClass: 'AMBULANT_POLICY',
          enforcementClass: 'MANUAL_REVIEW',
          enforcementPoint: 'PRIVILEGE_GATE',
          enforcementScope: 'CLINICAL_PRACTICE',
          state: 'VALID',
          expiresAt: row.piInsuranceExpiry.toISOString(),
          expiresAtDate: row.piInsuranceExpiry,
          reminderDays: [30, 14, 7, 1],
          autoRemindersEnabled: true,
          lastReminderAt: null,
        }),
      );
    }
  }

  for (const row of clinicianChecks) {
    if (!row.expiresAt) continue;
    const clinician = checkClinicianById.get(row.clinicianId);
    items.push(
      renewalItem({
        key: `legacy:clinician-check:${row.id}`,
        source: 'CLINICIAN_CHECK',
        credentialId: null,
        group: 'CLINICIAN',
        holderType: 'CLINICIAN',
        holderSubtype: clinician?.specialty || 'CLINICIAN',
        holderId: row.clinicianId,
        holderName: clinician?.displayName || clinician?.email || row.clinicianId,
        holderEmail: clinician?.email || null,
        credentialType: clean(row.kind, 120) || 'COMPLIANCE_CHECK',
        credentialLabel: clean(row.kind, 240).replace(/_/g, ' ') || 'Compliance check',
        credentialNumber: null,
        issuingAuthority: row.regulator,
        authorityClass: 'UNCLASSIFIED_LEGACY',
        enforcementClass: 'MANUAL_REVIEW',
        enforcementPoint: 'PRIVILEGE_GATE',
        enforcementScope: 'CLINICAL_PRACTICE',
        state: clean(row.status, 80).toUpperCase() || 'VALID',
        expiresAt: row.expiresAt.toISOString(),
        expiresAtDate: row.expiresAt,
        reminderDays: [30, 14, 7, 1],
        autoRemindersEnabled: true,
        lastReminderAt: null,
      }),
    );
  }

  for (const row of staffDocuments) {
    if (!row.expiresAt) continue;
    items.push(
      renewalItem({
        key: `legacy:staff-document:${row.id}`,
        source: 'STAFF_DOCUMENT',
        credentialId: null,
        group: 'STAFF',
        holderType: 'STAFF',
        holderSubtype: 'ADMIN_STAFF',
        holderId: row.staffProfile.id,
        holderName: row.staffProfile.name || row.staffProfile.email,
        holderEmail: row.staffProfile.email,
        credentialType: clean(row.documentType, 120) || 'EMPLOYMENT_DOCUMENT',
        credentialLabel: row.title || clean(row.documentType, 240).replace(/_/g, ' '),
        credentialNumber: null,
        issuingAuthority: null,
        authorityClass: 'UNCLASSIFIED_LEGACY',
        enforcementClass: 'MANUAL_REVIEW',
        enforcementPoint: 'RENEWAL_GATE',
        enforcementScope: 'STAFF_COMPLIANCE',
        state: clean(row.state, 80).toUpperCase() || 'VALID',
        expiresAt: row.expiresAt.toISOString(),
        expiresAtDate: row.expiresAt,
        reminderDays: [30, 14, 7, 1],
        autoRemindersEnabled: true,
        lastReminderAt: null,
      }),
    );
  }

  const insuranceValue = insuranceSetting?.value as any;
  for (const policy of insurancePolicyRows(insuranceValue)) {
    const expiry = clean(policy?.expiryDate, 20);
    if (!expiry) continue;
    const expiryDate = new Date(`${expiry}T00:00:00.000Z`);
    if (!Number.isFinite(expiryDate.getTime())) continue;
    const policyId = clean(policy?.id, 180) || clean(policy?.policyNumber, 180) || 'platform-policy';
    items.push(
      renewalItem({
        key: `platform-insurance:pi:${policyId}`,
        source: 'PLATFORM_INSURANCE',
        credentialId: null,
        group: 'CORPORATE',
        holderType: 'AMBULANT_CORPORATE',
        holderSubtype: 'PROFESSIONAL_INDEMNITY',
        holderId: 'ambulant-plus',
        holderName: 'Ambulant+',
        holderEmail: null,
        credentialType: 'PLATFORM_PROFESSIONAL_INDEMNITY',
        credentialLabel: clean(policy?.label, 240) || 'Platform professional indemnity / malpractice cover',
        credentialNumber: clean(policy?.policyNumber, 240) || null,
        issuingAuthority: clean(policy?.insurerName, 240) || null,
        authorityClass: 'AMBULANT_POLICY',
        enforcementClass: 'PLATFORM_HARD_GATE',
        enforcementPoint: 'RENEWAL_GATE',
        enforcementScope: 'AMBULANT_CORPORATE_COVER',
        state: policy?.active === false ? 'INACTIVE' : 'VALID',
        expiresAt: expiryDate.toISOString(),
        expiresAtDate: expiryDate,
        reminderDays: [30, 14, 7, 1],
        autoRemindersEnabled: policy?.active !== false,
        lastReminderAt: null,
      }),
    );
  }

  const cyber = normaliseCyberSettings(insuranceValue);
  if (cyber.enabled || cyber.expiryDate) {
    const expiryDate = cyber.expiryDate ? new Date(`${cyber.expiryDate}T00:00:00.000Z`) : null;
    items.push(
      renewalItem({
        key: 'platform-insurance:cyber-liability',
        source: 'PLATFORM_INSURANCE',
        credentialId: null,
        group: 'CORPORATE',
        holderType: 'AMBULANT_CORPORATE',
        holderSubtype: 'CYBER_LIABILITY',
        holderId: 'ambulant-plus',
        holderName: 'Ambulant+',
        holderEmail: cyber.renewalContactEmail,
        credentialType: 'PLATFORM_CYBER_LIABILITY',
        credentialLabel: 'Platform-wide cyber liability / technology cover',
        credentialNumber: cyber.policyNumber || null,
        issuingAuthority: cyber.insurerName || null,
        authorityClass: 'AMBULANT_POLICY',
        enforcementClass: 'PLATFORM_HARD_GATE',
        enforcementPoint: 'RENEWAL_GATE',
        enforcementScope: 'AMBULANT_CORPORATE_CYBER_RISK',
        state: cyber.enabled ? 'VALID' : 'INACTIVE',
        expiresAt: expiryDate && Number.isFinite(expiryDate.getTime()) ? expiryDate.toISOString() : null,
        expiresAtDate: expiryDate && Number.isFinite(expiryDate.getTime()) ? expiryDate : null,
        reminderDays: [30, 14, 7, 1],
        autoRemindersEnabled: cyber.enabled,
        lastReminderAt: null,
      }),
    );
  }

  if (items.length) {
    const reminders = await prisma.complianceRenewalReminder.findMany({
      where: { subjectKey: { in: items.map((item) => item.key) }, sentAt: { not: null } },
      select: { subjectKey: true, sentAt: true },
      orderBy: { sentAt: 'desc' },
      take: Math.min(10_000, items.length * 5),
    });
    const latest = new Map<string, Date>();
    for (const reminder of reminders) {
      if (reminder.sentAt && !latest.has(reminder.subjectKey)) latest.set(reminder.subjectKey, reminder.sentAt);
    }
    for (const item of items) {
      const at = latest.get(item.key);
      if (at && !item.lastReminderAt) item.lastReminderAt = at.toISOString();
    }
  }

  return items;
}

function sameMonth(dateIso: string | null, now = new Date()) {
  if (!dateIso) return false;
  return dateKey(new Date(dateIso)).slice(0, 7) === dateKey(now).slice(0, 7);
}

function matchesFilters(item: RenewalItem, filters: RenewalFilters) {
  const group = filters.group || 'ALL';
  if (group !== 'ALL' && item.group !== group) return false;

  const q = clean(filters.q, 200).toLowerCase();
  if (q) {
    const haystack = [
      item.holderName,
      item.holderEmail,
      item.holderType,
      item.holderSubtype,
      item.credentialType,
      item.credentialLabel,
      item.credentialNumber,
      item.issuingAuthority,
      item.enforcementScope,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  const due = filters.due || 'month';
  const days = item.daysUntilExpiry;
  if (due === 'all') return true;
  if (due === 'today') return days === 0;
  if (due === 'week') return days != null && days >= 0 && days <= 7;
  if (due === 'month') return days != null && days >= 0 && sameMonth(item.expiresAt);
  if (due === 'overdue') return days != null && days < 0;
  if (due === 'missing') return days == null;
  if (due === 'range') {
    if (!item.expiresAt) return false;
    const key = dateKey(new Date(item.expiresAt));
    if (filters.from && key < filters.from) return false;
    if (filters.to && key > filters.to) return false;
    return true;
  }
  return true;
}

export async function listComplianceRenewals(filters: RenewalFilters = {}) {
  const items = await readRawItems();
  const todayKey = dateKey(new Date());
  const stats = {
    total: items.length,
    dueThisMonth: items.filter((item) => item.daysUntilExpiry != null && item.daysUntilExpiry >= 0 && sameMonth(item.expiresAt)).length,
    dueThisWeek: items.filter((item) => item.daysUntilExpiry != null && item.daysUntilExpiry >= 0 && item.daysUntilExpiry <= 7).length,
    dueToday: items.filter((item) => item.daysUntilExpiry === 0).length,
    overdue: items.filter((item) => item.daysUntilExpiry != null && item.daysUntilExpiry < 0).length,
    missingExpiry: items.filter((item) => item.daysUntilExpiry == null).length,
  };
  const filtered = items.filter((item) => matchesFilters(item, filters));
  filtered.sort((a, b) => {
    if (a.daysUntilExpiry == null && b.daysUntilExpiry == null) return a.holderName.localeCompare(b.holderName);
    if (a.daysUntilExpiry == null) return 1;
    if (b.daysUntilExpiry == null) return -1;
    return a.daysUntilExpiry - b.daysUntilExpiry || a.holderName.localeCompare(b.holderName);
  });
  return {
    generatedAt: new Date().toISOString(),
    today: todayKey,
    timeZone: COMPLIANCE_RENEWAL_TIME_ZONE,
    designPrinciple: 'PROGRESSIVE_ASSURANCE_PRIVILEGE_GATING_NOT_SIGNUP_PARALYSIS',
    enforcementMode: 'VISIBILITY_REMINDERS_ONLY_NO_NEW_AUTOMATIC_SUSPENSIONS',
    stats,
    categories: Array.from(new Set(items.map((item) => item.holderSubtype).filter(Boolean))).sort(),
    items: filtered,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function reminderSubject(item: RenewalItem) {
  const days = item.daysUntilExpiry;
  if (days == null) return `Compliance document review required — ${item.credentialLabel}`;
  if (days < 0) return `Compliance document overdue — ${item.credentialLabel}`;
  if (days === 0) return `Compliance document expires today — ${item.credentialLabel}`;
  return `Compliance renewal reminder — ${item.credentialLabel} expires in ${days} day${days === 1 ? '' : 's'}`;
}

function reminderText(item: RenewalItem) {
  const expiry = item.expiresAt ? dateKey(new Date(item.expiresAt)) : 'not recorded';
  return [
    `Hello ${item.holderName},`,
    '',
    `This is an Ambulant+ compliance renewal reminder for: ${item.credentialLabel}.`,
    `Expiry date: ${expiry}.`,
    '',
    'Please sign in to your Ambulant+ workspace and submit the renewed document or updated credential when available.',
    '',
    'This reminder does not itself change your account status. Any affected capability is governed by the applicable credential and privilege rules.',
    '',
    'Ambulant+ Compliance',
  ].join('\n');
}

function reminderHtml(item: RenewalItem) {
  return `<p>Hello ${escapeHtml(item.holderName)},</p><p>This is an Ambulant+ compliance renewal reminder for <strong>${escapeHtml(item.credentialLabel)}</strong>.</p><p>Expiry date: <strong>${escapeHtml(item.expiresAt ? dateKey(new Date(item.expiresAt)) : 'not recorded')}</strong>.</p><p>Please sign in to your Ambulant+ workspace and submit the renewed document or updated credential when available.</p><p><small>This reminder does not itself change your account status. Any affected capability is governed by the applicable credential and privilege rules.</small></p><p>Ambulant+ Compliance</p>`;
}

function actorHasCompliance(values: string[]) {
  const set = new Set(values.map((value) => value.toLowerCase()));
  return [
    '*',
    'admin:all',
    'superadmin',
    'compliance',
    'compliance:read',
    'compliance:manage',
    'compliance.read',
    'compliance.manage',
    'manageroles',
  ].some((value) => set.has(value));
}

export async function complianceAdminProfileIds() {
  const profiles = await prisma.adminUserProfile.findMany({
    where: { lifecycleState: { in: ['ACTIVE', 'LEAVE'] } },
    select: {
      id: true,
      roles: {
        select: { role: { select: { name: true, scopes: { select: { scope: true } } } } },
      },
      designation: {
        select: {
          roles: {
            select: { role: { select: { name: true, scopes: { select: { scope: true } } } } },
          },
        },
      },
    },
    take: 1000,
  });

  return profiles
    .filter((profile) => {
      const roleEntries = [
        ...profile.roles.map((entry) => entry.role),
        ...(profile.designation?.roles || []).map((entry) => entry.role),
      ];
      const values = roleEntries.flatMap((role) => [role.name, ...role.scopes.map((entry) => entry.scope)]);
      return actorHasCompliance(values);
    })
    .map((profile) => profile.id);
}

async function notifyComplianceAdmins(item: RenewalItem, dedupeSuffix: string, actorProfileId?: string | null) {
  const recipientIds = await complianceAdminProfileIds();
  const title = reminderSubject(item).slice(0, 240);
  const body = `${item.holderName} · ${item.credentialLabel} · ${item.expiresAt ? dateKey(new Date(item.expiresAt)) : 'expiry not recorded'}`.slice(0, 1000);

  let created = 0;
  for (const recipientProfileId of recipientIds) {
    const dedupeKey = `compliance:${dedupeSuffix}:${recipientProfileId}`.slice(0, 240);
    try {
      await prisma.staffNotification.create({
        data: {
          recipientProfileId,
          actorProfileId: actorProfileId || null,
          type: 'COMPLIANCE_RENEWAL',
          title,
          body,
          dedupeKey,
          payload: {
            subjectKey: item.key,
            holderType: item.holderType,
            holderId: item.holderId,
            credentialType: item.credentialType,
            expiresAt: item.expiresAt,
            enforcementPoint: item.enforcementPoint,
            enforcementScope: item.enforcementScope,
          } as Prisma.InputJsonValue,
        },
      });
      created += 1;
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }
  }
  return created;
}

async function deliverEmailReminder(item: RenewalItem, eventKind: string) {
  if (!item.holderEmail) return { ok: true, skipped: true, reason: 'recipient_email_missing' } as const;

  const outbox = await prisma.notificationOutbox.create({
    data: {
      eventKind,
      recipientEmail: item.holderEmail,
      channel: 'EMAIL',
      payload: {
        subjectKey: item.key,
        holderType: item.holderType,
        holderId: item.holderId,
        credentialType: item.credentialType,
        expiresAt: item.expiresAt,
      } as Prisma.InputJsonValue,
    },
  });

  const sent = await sendEmail(item.holderEmail, reminderSubject(item), reminderHtml(item), reminderText(item));
  await prisma.notificationOutbox.update({
    where: { id: outbox.id },
    data: sent.ok
      ? { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null }
      : { status: 'FAILED', attempts: { increment: 1 }, lastError: clean(sent.error || 'email_delivery_failed', 1000) },
  });
  return sent.ok
    ? ({ ok: true, skipped: false } as const)
    : ({ ok: false, skipped: false, reason: clean(sent.error || 'email_delivery_failed', 1000) } as const);
}

async function markCredentialReminder(item: RenewalItem, at: Date) {
  if (!item.credentialId) return;
  await prisma.complianceCredential.update({
    where: { id: item.credentialId },
    data: { lastReminderAt: at },
  }).catch(() => undefined);
}

export async function sendManualComplianceReminders(input: {
  keys: string[];
  actorUserId: string;
  actorProfileId: string;
}) {
  const keySet = new Set(input.keys.map((key) => clean(key, 400)).filter(Boolean));
  if (!keySet.size) return { requested: 0, sent: 0, adminOnly: 0, failed: 0, skipped: 0, results: [] as any[] };
  if (keySet.size > 200) throw new Error('bulk_reminder_limit_exceeded');

  const all = (await listComplianceRenewals({ due: 'all' })).items;
  const selected = all.filter((item) => keySet.has(item.key));
  const results: any[] = [];
  let sentCount = 0;
  let adminOnly = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of selected) {
    if (!item.expiresAt) {
      skipped += 1;
      results.push({ key: item.key, ok: false, status: 'SKIPPED_MISSING_EXPIRY' });
      continue;
    }
    const now = new Date();
    const reminder = await prisma.complianceRenewalReminder.create({
      data: {
        orgId: 'org-default',
        subjectKey: item.key,
        credentialId: item.credentialId,
        holderType: item.holderType,
        holderId: item.holderId,
        holderName: item.holderName,
        recipientEmail: item.holderEmail,
        credentialType: item.credentialType,
        dueAt: new Date(item.expiresAt),
        reminderKind: 'MANUAL',
        thresholdDays: null,
        channel: item.holderEmail ? 'EMAIL' : 'ADMIN',
        status: 'PENDING',
        triggeredByUserId: input.actorUserId,
        metadata: { source: item.source } as Prisma.InputJsonValue,
      },
    });

    const adminNotifications = await notifyComplianceAdmins(item, `manual:${reminder.id}`, input.actorProfileId);
    const delivery = await deliverEmailReminder(item, 'compliance.renewal.manual');
    const success = delivery.ok;
    const status = success ? 'SENT' : 'FAILED';

    await prisma.complianceRenewalReminder.update({
      where: { id: reminder.id },
      data: {
        status,
        sentAt: success ? now : null,
        lastError: success ? null : clean((delivery as any).reason || 'delivery_failed', 1000),
        metadata: {
          source: item.source,
          adminNotifications,
          emailSkipped: Boolean((delivery as any).skipped),
        } as Prisma.InputJsonValue,
      },
    });

    if (success) {
      await markCredentialReminder(item, now);
      if ((delivery as any).skipped) adminOnly += 1;
      else sentCount += 1;
    } else {
      failed += 1;
    }
    results.push({ key: item.key, ok: success, status, adminNotifications, emailSkipped: Boolean((delivery as any).skipped) });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorType: 'ADMIN',
      actorRefId: input.actorProfileId,
      app: 'admin-dashboard',
      action: 'compliance.renewal.reminders.manual',
      entityType: 'ComplianceRenewalReminder',
      description: `Manual compliance renewal reminders processed for ${selected.length} item(s)`,
      meta: { requested: keySet.size, matched: selected.length, sent: sentCount, adminOnly, failed, skipped } as Prisma.InputJsonValue,
    },
  }).catch(() => undefined);

  return { requested: keySet.size, matched: selected.length, sent: sentCount, adminOnly, failed, skipped, results };
}

export async function runComplianceRenewalSweep(input: { actorUserId?: string | null; actorProfileId?: string | null } = {}) {
  const items = (await listComplianceRenewals({ due: 'all' })).items.filter(
    (item) => item.autoRemindersEnabled && item.expiresAt && item.daysUntilExpiry != null && item.daysUntilExpiry <= 30,
  );

  let created = 0;
  let emailed = 0;
  let adminOnly = 0;
  let failed = 0;
  let duplicates = 0;

  for (const item of items) {
    const days = item.daysUntilExpiry as number;
    // Send only the most urgent currently-applicable stage. This prevents a newly
    // onboarded or long-overdue credential from receiving 30/14/7/1/0 reminders
    // all at once while still allowing the next stage to fire later.
    const threshold =
      days <= 0 ? 0 :
      days <= 1 ? 1 :
      days <= 7 ? 7 :
      days <= 14 ? 14 :
      30;

    let reminder: any;
    try {
      reminder = await prisma.complianceRenewalReminder.create({
        data: {
          orgId: 'org-default',
          subjectKey: item.key,
          credentialId: item.credentialId,
          holderType: item.holderType,
          holderId: item.holderId,
          holderName: item.holderName,
          recipientEmail: item.holderEmail,
          credentialType: item.credentialType,
          dueAt: new Date(item.expiresAt as string),
          reminderKind: 'SCHEDULED',
          thresholdDays: threshold,
          channel: item.holderEmail ? 'EMAIL' : 'ADMIN',
          status: 'PENDING',
          triggeredByUserId: input.actorUserId || null,
          metadata: { source: item.source, daysUntilExpiry: item.daysUntilExpiry } as Prisma.InputJsonValue,
        },
      });
      created += 1;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        duplicates += 1;
        continue;
      }
      throw error;
    }

    const adminNotifications = await notifyComplianceAdmins(
      item,
      `scheduled:${item.key}:${dateKey(new Date(item.expiresAt as string))}:${threshold}`,
      input.actorProfileId || null,
    );
    const delivery = await deliverEmailReminder(item, `compliance.renewal.scheduled.${threshold}`);
    const now = new Date();
    const success = delivery.ok;

    await prisma.complianceRenewalReminder.update({
      where: { id: reminder.id },
      data: {
        status: success ? 'SENT' : 'FAILED',
        sentAt: success ? now : null,
        lastError: success ? null : clean((delivery as any).reason || 'delivery_failed', 1000),
        metadata: {
          source: item.source,
          daysUntilExpiry: item.daysUntilExpiry,
          adminNotifications,
          emailSkipped: Boolean((delivery as any).skipped),
        } as Prisma.InputJsonValue,
      },
    });

    if (success) {
      await markCredentialReminder(item, now);
      if ((delivery as any).skipped) adminOnly += 1;
      else emailed += 1;
    } else {
      failed += 1;
    }
  }

  return { scanned: items.length, created, emailed, adminOnly, failed, duplicates };
}
