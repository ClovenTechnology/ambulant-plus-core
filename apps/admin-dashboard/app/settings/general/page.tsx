// apps/admin-dashboard/app/settings/general/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Palette,
  Globe2,
  Clock3,
  Mail,
  Phone,
  MapPin,
  Shield,
  SlidersHorizontal,
  Upload,
  Link2,
  Save,
  RotateCcw,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Droplets,
  FileText,
  ClipboardList,
} from 'lucide-react';

type WeekStartsOn = 'monday' | 'sunday';

type PdfWatermark = {
  enabled: boolean;
  defaultText: string;
  careportText?: string;
  medreachText?: string;
  opacity?: number; // 0–1
  diagonal?: boolean;
};

type GeneralSettings = {
  tenant: {
    displayName: string;
    legalName: string;
    slug: string;
  };
  locale: {
    timeZone: string;
    locale: string;
    currency: string;
    weekStartsOn: WeekStartsOn;
  };
  support: {
    supportEmail: string;
    replyToEmail: string;
    supportPhone: string;
    addressLine: string;
  };
  brand: {
    appName: string;
    tagline: string;
    primaryColor: string; // hex
    logoUrl: string;
    faviconUrl: string;
  };
  securityDefaults: {
    requireMfaForAdmins: boolean;
    requireMfaForClinicians: boolean;
    auditAdminActions: boolean;
  };
  ops: {
    maintenanceMode: boolean;
    allowSelfServeClinicianSignup: boolean;
    allowSelfServePatientSignup: boolean;
  };
  pdfWatermark: PdfWatermark; // ✅ merged from Version C
  meta?: {
    updatedAt?: string;
    updatedBy?: string;
  };
};

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string };

const DEFAULTS: GeneralSettings = {
  tenant: {
    displayName: 'Ambulant+ Tenant',
    legalName: 'Ambulant+ (Pty) Ltd',
    slug: 'default',
  },
  locale: {
    timeZone: 'Africa/Johannesburg',
    locale: 'en-ZA',
    currency: 'ZAR',
    weekStartsOn: 'monday',
  },
  support: {
    supportEmail: 'support@example.com',
    replyToEmail: 'noreply@example.com',
    supportPhone: '+27',
    addressLine: '',
  },
  brand: {
    appName: 'Ambulant+',
    tagline: 'Contactless Medicine',
    primaryColor: '#0EA5A4',
    logoUrl: '',
    faviconUrl: '',
  },
  securityDefaults: {
    requireMfaForAdmins: true,
    requireMfaForClinicians: false,
    auditAdminActions: true,
  },
  ops: {
    maintenanceMode: false,
    allowSelfServeClinicianSignup: false,
    allowSelfServePatientSignup: true,
  },
  pdfWatermark: {
    enabled: true,
    defaultText: 'AMBULANT+ CONFIDENTIAL',
    careportText: '',
    medreachText: '',
    opacity: 0.12,
    diagonal: true,
  },
  meta: {},
};

function safeJsonStringify(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isHexColor(v: string) {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim());
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeGeneralSettings(input: Partial<GeneralSettings> | null | undefined): GeneralSettings {
  const s = input ?? {};

  const wm = s.pdfWatermark ?? DEFAULTS.pdfWatermark;
  const opacity =
    typeof wm.opacity === 'number' && Number.isFinite(wm.opacity)
      ? clamp(wm.opacity, 0.05, 1)
      : DEFAULTS.pdfWatermark.opacity ?? 0.12;

  return {
    tenant: {
      displayName: s.tenant?.displayName ?? DEFAULTS.tenant.displayName,
      legalName: s.tenant?.legalName ?? DEFAULTS.tenant.legalName,
      slug: s.tenant?.slug ?? DEFAULTS.tenant.slug,
    },
    locale: {
      timeZone: s.locale?.timeZone ?? DEFAULTS.locale.timeZone,
      locale: s.locale?.locale ?? DEFAULTS.locale.locale,
      currency: s.locale?.currency ?? DEFAULTS.locale.currency,
      weekStartsOn: (s.locale?.weekStartsOn as WeekStartsOn) ?? DEFAULTS.locale.weekStartsOn,
    },
    support: {
      supportEmail: s.support?.supportEmail ?? DEFAULTS.support.supportEmail,
      replyToEmail: s.support?.replyToEmail ?? DEFAULTS.support.replyToEmail,
      supportPhone: s.support?.supportPhone ?? DEFAULTS.support.supportPhone,
      addressLine: s.support?.addressLine ?? DEFAULTS.support.addressLine,
    },
    brand: {
      appName: s.brand?.appName ?? DEFAULTS.brand.appName,
      tagline: s.brand?.tagline ?? DEFAULTS.brand.tagline,
      primaryColor: s.brand?.primaryColor ?? DEFAULTS.brand.primaryColor,
      logoUrl: s.brand?.logoUrl ?? DEFAULTS.brand.logoUrl,
      faviconUrl: s.brand?.faviconUrl ?? DEFAULTS.brand.faviconUrl,
    },
    securityDefaults: {
      requireMfaForAdmins: s.securityDefaults?.requireMfaForAdmins ?? DEFAULTS.securityDefaults.requireMfaForAdmins,
      requireMfaForClinicians:
        s.securityDefaults?.requireMfaForClinicians ?? DEFAULTS.securityDefaults.requireMfaForClinicians,
      auditAdminActions: s.securityDefaults?.auditAdminActions ?? DEFAULTS.securityDefaults.auditAdminActions,
    },
    ops: {
      maintenanceMode: s.ops?.maintenanceMode ?? DEFAULTS.ops.maintenanceMode,
      allowSelfServeClinicianSignup:
        s.ops?.allowSelfServeClinicianSignup ?? DEFAULTS.ops.allowSelfServeClinicianSignup,
      allowSelfServePatientSignup: s.ops?.allowSelfServePatientSignup ?? DEFAULTS.ops.allowSelfServePatientSignup,
    },
    pdfWatermark: {
      enabled: wm.enabled ?? DEFAULTS.pdfWatermark.enabled,
      defaultText: (wm.defaultText ?? DEFAULTS.pdfWatermark.defaultText).toString(),
      careportText: (wm.careportText ?? '').toString(),
      medreachText: (wm.medreachText ?? '').toString(),
      opacity,
      diagonal: wm.diagonal ?? DEFAULTS.pdfWatermark.diagonal,
    },
    meta: {
      updatedAt: s.meta?.updatedAt,
      updatedBy: s.meta?.updatedBy,
    },
  };
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 md:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-gray-50">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm md:text-base font-semibold text-gray-900">{title}</h3>
          </div>
          {description ? <p className="mt-1 text-xs md:text-sm text-gray-600">{description}</p> : null}
        </div>
      </div>

      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-medium text-gray-800">{label}</label>
        {hint ? <span className="text-[11px] text-gray-500">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <div className="inline-flex items-center gap-1 text-[11px] text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
      className={cx(
        'w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400',
        'focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300',
        disabled && 'bg-gray-50 text-gray-500'
      )}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cx(
        'w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-900',
        'focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300',
        disabled && 'bg-gray-50 text-gray-500'
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-10 items-center rounded-full border transition',
        checked ? 'bg-gray-900 border-gray-900' : 'bg-gray-200 border-gray-200',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
      aria-pressed={checked}
      aria-label="Toggle"
    >
      <span
        className={cx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function InlineBanner({
  kind,
  title,
  description,
  actions,
}: {
  kind: 'info' | 'success' | 'warn' | 'error';
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : kind === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-gray-200 bg-gray-50 text-gray-900';

  const icon =
    kind === 'success' ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : kind === 'warn' || kind === 'error' ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <SlidersHorizontal className="h-4 w-4" />
    );

  return (
    <div className={cx('rounded-2xl border p-3 md:p-4', styles)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{icon}</div>
          <div className="min-w-0">
            <div className="text-xs md:text-sm font-semibold">{title}</div>
            {description ? <div className="mt-0.5 text-[11px] md:text-xs opacity-90">{description}</div> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

/* ---------------------------------
   Report lifecycle + permissions matrix (Version B aesthetic)
----------------------------------*/
type Perm = 'allow' | 'cond' | 'deny';

const REPORT_LIFECYCLE: Array<{
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tint: 'gray' | 'amber' | 'emerald' | 'blue';
}> = [
  {
    key: 'draft',
    title: 'Draft',
    subtitle: 'Created, editable. Not visible to patient.',
    icon: <FileText className="h-4 w-4" />,
    tint: 'gray',
  },
  {
    key: 'submitted',
    title: 'Submitted',
    subtitle: 'Locked for review. Awaiting checks.',
    icon: <ClipboardList className="h-4 w-4" />,
    tint: 'amber',
  },
  {
    key: 'verified',
    title: 'Verified',
    subtitle: 'Compliance checks passed. Ready to publish.',
    icon: <Shield className="h-4 w-4" />,
    tint: 'emerald',
  },
  {
    key: 'published',
    title: 'Published',
    subtitle: 'Visible to intended audience. Export/share allowed by RBAC.',
    icon: <ExternalLink className="h-4 w-4" />,
    tint: 'blue',
  },
  {
    key: 'amended',
    title: 'Amended',
    subtitle: 'Correction issued. Maintains audit trail.',
    icon: <RotateCcw className="h-4 w-4" />,
    tint: 'amber',
  },
  {
    key: 'archived',
    title: 'Archived',
    subtitle: 'Read-only retention state. No further edits.',
    icon: <AlertTriangle className="h-4 w-4" />,
    tint: 'gray',
  },
];

const REPORT_ROLES = ['Admin', 'Ops', 'Finance', 'Compliance', 'Clinician', 'Patient'] as const;
type ReportRole = (typeof REPORT_ROLES)[number];

const REPORT_MATRIX: Array<{
  action: string;
  desc: string;
  perms: Record<ReportRole, Perm>;
}> = [
  {
    action: 'View (in-app)',
    desc: 'View report details within permitted scope.',
    perms: {
      Admin: 'allow',
      Ops: 'allow',
      Finance: 'allow',
      Compliance: 'allow',
      Clinician: 'allow',
      Patient: 'allow',
    },
  },
  {
    action: 'Generate / Create draft',
    desc: 'Create a new report or generate system report.',
    perms: {
      Admin: 'allow',
      Ops: 'allow',
      Finance: 'allow',
      Compliance: 'cond',
      Clinician: 'allow',
      Patient: 'cond',
    },
  },
  {
    action: 'Edit draft',
    desc: 'Edit content before submission (no patient visibility).',
    perms: {
      Admin: 'allow',
      Ops: 'cond',
      Finance: 'cond',
      Compliance: 'cond',
      Clinician: 'allow',
      Patient: 'deny',
    },
  },
  {
    action: 'Submit for review',
    desc: 'Lock report and route to verification queue.',
    perms: {
      Admin: 'allow',
      Ops: 'cond',
      Finance: 'cond',
      Compliance: 'allow',
      Clinician: 'allow',
      Patient: 'deny',
    },
  },
  {
    action: 'Verify / Approve',
    desc: 'Mark as verified and eligible for publishing.',
    perms: {
      Admin: 'allow',
      Ops: 'deny',
      Finance: 'cond',
      Compliance: 'allow',
      Clinician: 'deny',
      Patient: 'deny',
    },
  },
  {
    action: 'Publish / Release',
    desc: 'Make visible to patient / clinician / org audience.',
    perms: {
      Admin: 'allow',
      Ops: 'cond',
      Finance: 'cond',
      Compliance: 'allow',
      Clinician: 'deny',
      Patient: 'deny',
    },
  },
  {
    action: 'Amend (correction)',
    desc: 'Issue corrected version while preserving audit trail.',
    perms: {
      Admin: 'allow',
      Ops: 'deny',
      Finance: 'cond',
      Compliance: 'allow',
      Clinician: 'cond',
      Patient: 'deny',
    },
  },
  {
    action: 'Redact / Void',
    desc: 'Restrict visibility due to privacy/compliance.',
    perms: {
      Admin: 'allow',
      Ops: 'deny',
      Finance: 'deny',
      Compliance: 'allow',
      Clinician: 'deny',
      Patient: 'deny',
    },
  },
  {
    action: 'Export (PDF/CSV)',
    desc: 'Download/export within allowed scope.',
    perms: {
      Admin: 'allow',
      Ops: 'cond',
      Finance: 'allow',
      Compliance: 'allow',
      Clinician: 'cond',
      Patient: 'allow',
    },
  },
  {
    action: 'Share external link',
    desc: 'Generate viewer link; should be time-limited + watermarked.',
    perms: {
      Admin: 'allow',
      Ops: 'cond',
      Finance: 'cond',
      Compliance: 'allow',
      Clinician: 'cond',
      Patient: 'cond',
    },
  },
  {
    action: 'Hard delete',
    desc: 'Only for legal exception cases; prefer archive.',
    perms: {
      Admin: 'cond',
      Ops: 'deny',
      Finance: 'deny',
      Compliance: 'cond',
      Clinician: 'deny',
      Patient: 'deny',
    },
  },
];

function PermBadge({ p }: { p: Perm }) {
  const base = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium';
  if (p === 'allow')
    return (
      <span className={cx(base, 'bg-emerald-50 border-emerald-200 text-emerald-900')}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        Allowed
      </span>
    );
  if (p === 'cond')
    return (
      <span className={cx(base, 'bg-amber-50 border-amber-200 text-amber-900')}>
        <AlertTriangle className="h-3.5 w-3.5" />
        Conditional
      </span>
    );
  return <span className={cx(base, 'bg-gray-50 border-gray-200 text-gray-700')}>—</span>;
}

function PermCell({ p }: { p: Perm }) {
  const cls =
    p === 'allow'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : p === 'cond'
      ? 'bg-amber-50 text-amber-900 border-amber-200'
      : 'bg-white text-gray-400 border-gray-200';
  return (
    <div className={cx('h-8 w-full rounded-xl border flex items-center justify-center', cls)} aria-label={p}>
      {p === 'allow' ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : p === 'cond' ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <span className="text-[11px]">—</span>
      )}
    </div>
  );
}

function LifecyclePill({ tint, children }: { tint: 'gray' | 'amber' | 'emerald' | 'blue'; children: React.ReactNode }) {
  const cls =
    tint === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tint === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tint === 'blue'
      ? 'border-sky-200 bg-sky-50 text-sky-900'
      : 'border-gray-200 bg-gray-50 text-gray-900';
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium', cls)}>
      {children}
    </span>
  );
}

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<GeneralSettings>(DEFAULTS);
  const [original, setOriginal] = useState<GeneralSettings>(DEFAULTS);

  const [banner, setBanner] = useState<
    | { kind: 'info' | 'success' | 'warn' | 'error'; title: string; description?: string }
    | null
  >(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  const logoPreviewUrlRef = useRef<string | null>(null);
  const faviconPreviewUrlRef = useRef<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(null);

  const timeZoneOptions = useMemo(() => {
    const supported: string[] | undefined = (Intl as any)?.supportedValuesOf?.('timeZone');
    const list =
      supported && Array.isArray(supported) && supported.length > 50
        ? supported
        : [
            'Africa/Johannesburg',
            'UTC',
            'Europe/London',
            'Europe/Paris',
            'America/New_York',
            'America/Los_Angeles',
            'Asia/Dubai',
            'Asia/Kolkata',
            'Asia/Singapore',
            'Asia/Tokyo',
            'Australia/Sydney',
          ];

    return list.map((tz) => ({ value: tz, label: tz }));
  }, []);

  const localeOptions = useMemo(
    () => [
      { value: 'en-ZA', label: 'English (South Africa) — en-ZA' },
      { value: 'af-ZA', label: 'Afrikaans (South Africa) — af-ZA' }, // ✅ added
      { value: 'en-US', label: 'English (United States) — en-US' },
      { value: 'en-GB', label: 'English (United Kingdom) — en-GB' },
      { value: 'fr-FR', label: 'French (France) — fr-FR' },
      { value: 'pt-PT', label: 'Portuguese (Portugal) — pt-PT' },
    ],
    []
  );

  const currencyOptions = useMemo(
    () => [
      { value: 'ZAR', label: 'South African Rand — ZAR' },
      { value: 'USD', label: 'US Dollar — USD' },
      { value: 'EUR', label: 'Euro — EUR' },
      { value: 'GBP', label: 'British Pound — GBP' },
      { value: 'NGN', label: 'Nigerian Naira — NGN' },
      { value: 'KES', label: 'Kenyan Shilling — KES' },
    ],
    []
  );

  const isDirty = useMemo(() => {
    const a = safeJsonStringify(settings);
    const b = safeJsonStringify(original);
    return a !== b || !!logoFile || !!faviconFile;
  }, [settings, original, logoFile, faviconFile]);

  const validate = useCallback((s: GeneralSettings) => {
    const next: Record<string, string> = {};

    if (!s.tenant.displayName.trim()) next['tenant.displayName'] = 'Tenant display name is required.';
    if (!s.tenant.slug.trim()) next['tenant.slug'] = 'Tenant slug is required.';
    if (s.tenant.slug && !/^[a-z0-9-]+$/.test(s.tenant.slug.trim()))
      next['tenant.slug'] = 'Use lowercase letters, numbers, and hyphens only.';

    if (!s.support.supportEmail.trim() || !isEmail(s.support.supportEmail))
      next['support.supportEmail'] = 'Enter a valid support email.';
    if (!s.support.replyToEmail.trim() || !isEmail(s.support.replyToEmail))
      next['support.replyToEmail'] = 'Enter a valid reply-to email.';

    if (!s.locale.timeZone.trim()) next['locale.timeZone'] = 'Time zone is required.';
    if (!s.locale.locale.trim()) next['locale.locale'] = 'Locale is required.';
    if (!s.locale.currency.trim()) next['locale.currency'] = 'Currency is required.';

    if (!s.brand.appName.trim()) next['brand.appName'] = 'App name is required.';
    if (!isHexColor(s.brand.primaryColor)) next['brand.primaryColor'] = 'Use a valid hex color (e.g. #0EA5A4).';

    // URLs are optional, but if provided, allow http(s):// OR /relative/path
    const urlish = (v: string) => {
      const x = v.trim();
      return !x || /^https?:\/\/.+/i.test(x) || x.startsWith('/');
    };
    if (!urlish(s.brand.logoUrl)) next['brand.logoUrl'] = 'Enter a valid URL (http(s)://…) or a /relative path.';
    if (!urlish(s.brand.faviconUrl))
      next['brand.faviconUrl'] = 'Enter a valid URL (http(s)://…) or a /relative path.';

    // ✅ Watermark sanity (merged from Version C)
    const wm = s.pdfWatermark;
    const op =
      typeof wm.opacity === 'number' && Number.isFinite(wm.opacity) ? wm.opacity : DEFAULTS.pdfWatermark.opacity!;
    if (wm.enabled && !wm.defaultText.trim()) {
      next['pdfWatermark.defaultText'] = 'Default watermark text is required when watermark is enabled.';
    }
    if (!Number.isFinite(op) || op < 0.05 || op > 1) {
      next['pdfWatermark.opacity'] = 'Opacity must be between 0.05 and 1.00.';
    }

    return next;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    setErrors({});

    try {
      const res = await fetch('/api/admin/settings/general', { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiEnvelope<Partial<GeneralSettings>>;

      if (!json?.ok || !json.data) {
        throw new Error(json?.error || 'Failed to load settings.');
      }

      const normalized = normalizeGeneralSettings(json.data);
      setSettings(normalized);
      setOriginal(normalized);
      setBanner({
        kind: 'info',
        title: 'Settings loaded',
        description: 'You are editing tenant-scoped configuration. Changes apply immediately after saving.',
      });

      // Clear any staged local files after reload
      setLogoFile(null);
      setFaviconFile(null);
      setLogoPreviewUrl(null);
      setFaviconPreviewUrl(null);
      if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
      if (faviconPreviewUrlRef.current) URL.revokeObjectURL(faviconPreviewUrlRef.current);
      logoPreviewUrlRef.current = null;
      faviconPreviewUrlRef.current = null;
    } catch (e: any) {
      const normalized = normalizeGeneralSettings(DEFAULTS);
      setSettings(normalized);
      setOriginal(normalized);
      setBanner({
        kind: 'warn',
        title: 'Using fallback settings (API not reachable)',
        description:
          'The General Settings API endpoint was not reachable. UI is fully usable, but saving may fail until /api/admin/settings/general is available.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
      if (faviconPreviewUrlRef.current) URL.revokeObjectURL(faviconPreviewUrlRef.current);
    };
  }, [load]);

  const setByPath = useCallback((path: string, value: any) => {
    setSettings((prev) => {
      const next = normalizeGeneralSettings(prev);
      const parts = path.split('.');
      let cur: any = next;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }, []);

  const handlePickLogo = useCallback((file: File | null) => {
    setLogoFile(file);

    if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
    logoPreviewUrlRef.current = null;
    setLogoPreviewUrl(null);

    if (file) {
      const u = URL.createObjectURL(file);
      logoPreviewUrlRef.current = u;
      setLogoPreviewUrl(u);
    }
  }, []);

  const handlePickFavicon = useCallback((file: File | null) => {
    setFaviconFile(file);

    if (faviconPreviewUrlRef.current) URL.revokeObjectURL(faviconPreviewUrlRef.current);
    faviconPreviewUrlRef.current = null;
    setFaviconPreviewUrl(null);

    if (file) {
      const u = URL.createObjectURL(file);
      faviconPreviewUrlRef.current = u;
      setFaviconPreviewUrl(u);
    }
  }, []);

  async function uploadAsset(kind: 'logo' | 'favicon', file: File): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);

      const res = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) return null;

      const json = (await res.json()) as { ok?: boolean; url?: string };
      if (json?.ok && json.url) return json.url;
      return null;
    } catch {
      return null;
    }
  }

  const revert = useCallback(() => {
    setSettings(original);
    setErrors({});
    setBanner({
      kind: 'info',
      title: 'Reverted local changes',
      description: 'All unsaved edits were discarded.',
    });

    setLogoFile(null);
    setFaviconFile(null);

    if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
    if (faviconPreviewUrlRef.current) URL.revokeObjectURL(faviconPreviewUrlRef.current);
    logoPreviewUrlRef.current = null;
    faviconPreviewUrlRef.current = null;
    setLogoPreviewUrl(null);
    setFaviconPreviewUrl(null);
  }, [original]);

  const save = useCallback(async () => {
    setBanner(null);

    const normalized = normalizeGeneralSettings(settings);
    const nextErrors = validate(normalized);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setBanner({
        kind: 'error',
        title: 'Fix validation issues',
        description: 'One or more fields need attention before saving.',
      });
      return;
    }

    setSaving(true);
    try {
      // Upload assets first if present and if upload API exists
      let logoUrl = normalized.brand.logoUrl;
      let faviconUrl = normalized.brand.faviconUrl;

      if (logoFile) {
        const uploaded = await uploadAsset('logo', logoFile);
        if (uploaded) logoUrl = uploaded;
      }
      if (faviconFile) {
        const uploaded = await uploadAsset('favicon', faviconFile);
        if (uploaded) faviconUrl = uploaded;
      }

      const payload: GeneralSettings = {
        ...normalized,
        brand: {
          ...normalized.brand,
          logoUrl,
          faviconUrl,
        },
        pdfWatermark: {
          ...normalized.pdfWatermark,
          opacity: clamp(
            typeof normalized.pdfWatermark.opacity === 'number'
              ? normalized.pdfWatermark.opacity
              : DEFAULTS.pdfWatermark.opacity ?? 0.12,
            0.05,
            1
          ),
        },
      };

      const res = await fetch('/api/admin/settings/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as ApiEnvelope<Partial<GeneralSettings>>;
      if (!json?.ok || !json.data) {
        throw new Error(json?.error || 'Save failed.');
      }

      const saved = normalizeGeneralSettings(json.data);
      setSettings(saved);
      setOriginal(saved);

      setLogoFile(null);
      setFaviconFile(null);
      setErrors({});

      if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
      if (faviconPreviewUrlRef.current) URL.revokeObjectURL(faviconPreviewUrlRef.current);
      logoPreviewUrlRef.current = null;
      faviconPreviewUrlRef.current = null;
      setLogoPreviewUrl(null);
      setFaviconPreviewUrl(null);

      setBanner({
        kind: 'success',
        title: 'Saved',
        description: 'General settings have been updated and applied.',
      });
    } catch (e: any) {
      setBanner({
        kind: 'error',
        title: 'Save failed',
        description:
          'The backend endpoint did not accept this update. Ensure /api/admin/settings/general (PUT) exists and returns { ok, data }.',
      });
    } finally {
      setSaving(false);
    }
  }, [faviconFile, logoFile, settings, validate]);

  const resetToDefaults = useCallback(() => {
    const ok = window.confirm(
      'Reset all General Settings fields to defaults? This only changes the form until you click Save.'
    );
    if (!ok) return;

    setSettings(DEFAULTS);
    setErrors({});

    setLogoFile(null);
    setFaviconFile(null);

    if (logoPreviewUrlRef.current) URL.revokeObjectURL(logoPreviewUrlRef.current);
    if (faviconPreviewUrlRef.current) URL.revokeObjectURL(faviconPreviewUrlRef.current);
    logoPreviewUrlRef.current = null;
    faviconPreviewUrlRef.current = null;
    setLogoPreviewUrl(null);
    setFaviconPreviewUrl(null);

    setBanner({
      kind: 'warn',
      title: 'Defaults staged',
      description: 'Defaults are loaded into the form. Click Save to apply.',
    });
  }, []);

  const metaLine = useMemo(() => {
    const at = settings.meta?.updatedAt;
    const by = settings.meta?.updatedBy;
    if (!at && !by) return null;
    return `${at ? `Updated: ${at}` : ''}${at && by ? ' • ' : ''}${by ? `By: ${by}` : ''}`;
  }, [settings.meta?.updatedAt, settings.meta?.updatedBy]);

  const resolvedWatermark = useMemo(() => {
    const wm = settings.pdfWatermark ?? DEFAULTS.pdfWatermark;
    const def = (wm.defaultText || DEFAULTS.pdfWatermark.defaultText).trim();
    return {
      defaultText: def || DEFAULTS.pdfWatermark.defaultText,
      careportText: (wm.careportText?.trim() ? wm.careportText.trim() : def) || def,
      medreachText: (wm.medreachText?.trim() ? wm.medreachText.trim() : def) || def,
    };
  }, [settings.pdfWatermark]);

  const BrandPreview = useMemo(() => {
    const color = isHexColor(settings.brand.primaryColor) ? settings.brand.primaryColor : '#111827';
    const logoSrc = logoPreviewUrl ?? settings.brand.logoUrl;
    const faviconSrc = faviconPreviewUrl ?? settings.brand.faviconUrl;

    return (
      <div className="rounded-2xl border bg-gradient-to-b from-white to-gray-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 rounded-2xl border bg-white overflow-hidden flex items-center justify-center"
              title="Logo preview"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoSrc ? (
                <img src={logoSrc} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                <div className="text-[11px] text-gray-400">Logo</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                {settings.brand.appName || 'App Name'}
              </div>
              <div className="truncate text-xs text-gray-600">{settings.brand.tagline || 'Tagline'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[11px] text-gray-500">Primary</div>
            <div className="h-6 w-10 rounded-xl border" style={{ background: color }} aria-label="Primary color swatch" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border bg-white p-2">
            <div className="text-[11px] text-gray-500">Buttons</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-white"
                style={{ background: color }}
              >
                Primary
              </button>
              <button
                type="button"
                className="rounded-xl border px-3 py-1.5 text-xs font-medium text-gray-800 bg-white"
              >
                Secondary
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-2">
            <div className="text-[11px] text-gray-500">Favicon</div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl border bg-white overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {faviconSrc ? (
                  <img src={faviconSrc} alt="Favicon preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-[11px] text-gray-400">Icon</div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] text-gray-600">{faviconSrc ? 'Using favicon' : 'No favicon set'}</div>
                <div className="truncate text-[11px] text-gray-400">Tip: 256×256 PNG works well</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    faviconPreviewUrl,
    logoPreviewUrl,
    settings.brand.appName,
    settings.brand.faviconUrl,
    settings.brand.logoUrl,
    settings.brand.primaryColor,
    settings.brand.tagline,
  ]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading General Settings…
          </div>
          <div className="mt-2 text-xs text-gray-500">Fetching tenant identity, locale defaults, branding, and policy flags.</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-40 rounded bg-gray-100" />
              <div className="mt-3 space-y-2">
                <div className="h-9 w-full rounded-xl bg-gray-100" />
                <div className="h-9 w-full rounded-xl bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const wm = settings.pdfWatermark ?? DEFAULTS.pdfWatermark;
  const opacity = clamp(
    typeof wm.opacity === 'number' && Number.isFinite(wm.opacity) ? wm.opacity : DEFAULTS.pdfWatermark.opacity ?? 0.12,
    0.05,
    1
  );

  return (
    <div className="space-y-5">
      {banner ? <InlineBanner kind={banner.kind} title={banner.title} description={banner.description} /> : null}

      {/* Top meta / quick links */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">General Settings</div>
          <div className="mt-0.5 text-sm md:text-base font-semibold text-gray-900">Tenant identity, brand, locale & default policies</div>
          {metaLine ? <div className="mt-1 text-[11px] text-gray-500">{metaLine}</div> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/settings?tab=roles"
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Shield className="h-3.5 w-3.5" />
            RBAC / Roles
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
          <Link
            href="/settings?tab=devtools"
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Dev tools
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>

          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Load defaults
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Left: forms */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-5">
          <Section icon={<Building2 className="h-4 w-4 text-gray-800" />} title="Tenant identity" description="These values appear across admin panels, invoices, exports and system headers.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tenant display name" hint="Human-friendly" error={errors['tenant.displayName']}>
                <TextInput value={settings.tenant.displayName} onChange={(v) => setByPath('tenant.displayName', v)} placeholder="e.g., Ambulant+ South Africa" />
              </Field>

              <Field label="Tenant slug" hint="URL-safe" error={errors['tenant.slug']}>
                <TextInput value={settings.tenant.slug} onChange={(v) => setByPath('tenant.slug', v.toLowerCase())} placeholder="e.g., ambulant-za" />
              </Field>

              <div className="md:col-span-2">
                <Field label="Legal entity name" hint="For billing & compliance">
                  <TextInput value={settings.tenant.legalName} onChange={(v) => setByPath('tenant.legalName', v)} placeholder="e.g., Cloven Technology (Pty) Ltd" />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border bg-gray-50 p-3 md:p-4">
              <div className="text-xs font-semibold text-gray-800">Where this is used</div>
              <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Exports & audit headers
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Invoices / statements
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Default sender identity
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Multi-tenant routing
                </li>
              </ul>
            </div>
          </Section>

          <Section icon={<Globe2 className="h-4 w-4 text-gray-800" />} title="Locale & time" description="Controls how time, currency and calendars behave across modules (CarePort, MedReach, scheduling).">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Time zone" hint="Scheduling + reports" error={errors['locale.timeZone']}>
                <SelectInput value={settings.locale.timeZone} onChange={(v) => setByPath('locale.timeZone', v)} options={timeZoneOptions} />
              </Field>

              <Field label="Locale" hint="Dates & formatting" error={errors['locale.locale']}>
                <SelectInput value={settings.locale.locale} onChange={(v) => setByPath('locale.locale', v)} options={localeOptions} />
              </Field>

              <Field
                label="Tenant base currency"
                hint="Reporting & fallbacks (clinicians can price in local currency)"
                error={errors['locale.currency']}
              >
                <SelectInput value={settings.locale.currency} onChange={(v) => setByPath('locale.currency', v)} options={currencyOptions} />
              </Field>

              <Field label="Week starts on" hint="Calendars">
                <SelectInput
                  value={settings.locale.weekStartsOn}
                  onChange={(v) => setByPath('locale.weekStartsOn', v as WeekStartsOn)}
                  options={[
                    { value: 'monday', label: 'Monday' },
                    { value: 'sunday', label: 'Sunday' },
                  ]}
                />
              </Field>
            </div>

            <div className="rounded-2xl border bg-gray-50 p-3 md:p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                <Clock3 className="h-4 w-4" />
                Live preview
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-gray-600">
                <div className="rounded-xl border bg-white p-2">
                  <div className="text-gray-500">Time zone</div>
                  <div className="font-medium text-gray-900">{settings.locale.timeZone}</div>
                </div>
                <div className="rounded-xl border bg-white p-2">
                  <div className="text-gray-500">Base currency</div>
                  <div className="font-medium text-gray-900">{settings.locale.currency}</div>
                </div>
                <div className="rounded-xl border bg-white p-2">
                  <div className="text-gray-500">Week starts</div>
                  <div className="font-medium text-gray-900">{settings.locale.weekStartsOn === 'monday' ? 'Monday' : 'Sunday'}</div>
                </div>
              </div>
            </div>
          </Section>

          <Section icon={<Palette className="h-4 w-4 text-gray-800" />} title="Brand" description="Branding appears across admin dashboards, patient-facing web, and exports (where enabled).">
            {BrandPreview}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="App name" hint="UI headers" error={errors['brand.appName']}>
                <TextInput value={settings.brand.appName} onChange={(v) => setByPath('brand.appName', v)} placeholder="Ambulant+" />
              </Field>

              <Field label="Tagline" hint="Optional">
                <TextInput value={settings.brand.tagline} onChange={(v) => setByPath('brand.tagline', v)} placeholder="Contactless Medicine" />
              </Field>

              <Field label="Primary color" hint="Hex" error={errors['brand.primaryColor']}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-10 w-12 rounded-xl border"
                    style={{ background: isHexColor(settings.brand.primaryColor) ? settings.brand.primaryColor : '#ffffff' }}
                    aria-label="Primary color swatch"
                  />
                  <TextInput value={settings.brand.primaryColor} onChange={(v) => setByPath('brand.primaryColor', v)} placeholder="#0EA5A4" inputMode="text" />
                </div>
              </Field>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Logo URL" hint="http(s):// or /path" error={errors['brand.logoUrl']}>
                  <div className="flex items-center gap-2">
                    <div className="shrink-0 rounded-xl border bg-white p-2">
                      <Link2 className="h-4 w-4 text-gray-700" />
                    </div>
                    <TextInput value={settings.brand.logoUrl} onChange={(v) => setByPath('brand.logoUrl', v)} placeholder="https://…/logo.png" />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                      <Upload className="h-3.5 w-3.5" />
                      Upload logo
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePickLogo(e.target.files?.[0] ?? null)} />
                    </label>
                    {logoFile ? (
                      <span className="text-[11px] text-gray-500">
                        Selected: <span className="font-medium text-gray-800">{logoFile.name}</span>
                      </span>
                    ) : null}
                  </div>
                </Field>

                <Field label="Favicon URL" hint="http(s):// or /path" error={errors['brand.faviconUrl']}>
                  <div className="flex items-center gap-2">
                    <div className="shrink-0 rounded-xl border bg-white p-2">
                      <Link2 className="h-4 w-4 text-gray-700" />
                    </div>
                    <TextInput value={settings.brand.faviconUrl} onChange={(v) => setByPath('brand.faviconUrl', v)} placeholder="https://…/favicon.png" />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                      <Upload className="h-3.5 w-3.5" />
                      Upload favicon
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePickFavicon(e.target.files?.[0] ?? null)} />
                    </label>
                    {faviconFile ? (
                      <span className="text-[11px] text-gray-500">
                        Selected: <span className="font-medium text-gray-800">{faviconFile.name}</span>
                      </span>
                    ) : null}
                  </div>
                </Field>
              </div>

              {(logoFile || faviconFile) && (
                <InlineBanner
                  kind="info"
                  title="Uploads staged"
                  description="If /api/admin/assets/upload exists, assets will be uploaded during Save. Otherwise, keep using stable URLs or /public assets."
                />
              )}
            </div>
          </Section>

          {/* ✅ PDF Watermark (harmonized from Version C, styled like Version B) */}
          <Section icon={<Sparkles className="h-4 w-4 text-gray-800" />} title="PDF watermark" description="Applies to generated PDFs (CarePort, MedReach, exports). Use overrides to vary text per module.">
            {(errors['pdfWatermark.defaultText'] || errors['pdfWatermark.opacity']) && (
              <InlineBanner kind="warn" title="Watermark config needs attention" description={errors['pdfWatermark.defaultText'] || errors['pdfWatermark.opacity']} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900">Enable watermark</div>
                    <div className="mt-0.5 text-[11px] text-gray-600">Recommended for compliance and traceability (especially external viewer links).</div>
                  </div>
                  <Toggle checked={!!wm.enabled} onChange={(v) => setByPath('pdfWatermark.enabled', v)} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Default watermark text" hint="Required when enabled" error={errors['pdfWatermark.defaultText']}>
                    <TextInput
                      value={wm.defaultText ?? ''}
                      onChange={(v) => setByPath('pdfWatermark.defaultText', v)}
                      placeholder="e.g., AMBULANT+ • CONFIDENTIAL"
                      disabled={!wm.enabled}
                    />
                  </Field>

                  <Field label="Layout" hint="Renderer hint">
                    <SelectInput
                      value={wm.diagonal ? 'diagonal' : 'horizontal'}
                      onChange={(v) => setByPath('pdfWatermark.diagonal', v === 'diagonal')}
                      disabled={!wm.enabled}
                      options={[
                        { value: 'diagonal', label: 'Diagonal across page' },
                        { value: 'horizontal', label: 'Centered horizontally' },
                      ]}
                    />
                  </Field>

                  <Field label="CarePort override" hint="Optional">
                    <TextInput
                      value={wm.careportText ?? ''}
                      onChange={(v) => setByPath('pdfWatermark.careportText', v)}
                      placeholder="Optional override for pharmacy/eRx PDFs"
                      disabled={!wm.enabled}
                    />
                  </Field>

                  <Field label="MedReach override" hint="Optional">
                    <TextInput
                      value={wm.medreachText ?? ''}
                      onChange={(v) => setByPath('pdfWatermark.medreachText', v)}
                      placeholder="Optional override for lab/draw PDFs"
                      disabled={!wm.enabled}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Opacity" hint={`${Math.round(opacity * 100)}%`}>
                      <div className="flex items-center gap-3 rounded-2xl border bg-white p-3">
                        <input
                          type="range"
                          min={5}
                          max={40}
                          value={Math.round(opacity * 100)}
                          disabled={!wm.enabled}
                          onChange={(e) => {
                            const v = Number(e.target.value || 12);
                            setByPath('pdfWatermark.opacity', clamp(v / 100, 0.05, 1));
                          }}
                          className="w-full"
                        />
                        <div className="shrink-0 rounded-xl border bg-gray-50 px-2.5 py-1 text-[11px] text-gray-700">{Math.round(opacity * 100)}%</div>
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl border bg-gray-50 p-3 md:p-4">
                  <div className="text-xs font-semibold text-gray-800">Resolved text</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-xl border bg-white p-2">
                      <div className="text-gray-500">Default</div>
                      <div className="font-medium text-gray-900 truncate">{resolvedWatermark.defaultText}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-2">
                      <div className="text-gray-500">CarePort</div>
                      <div className="font-medium text-gray-900 truncate">{resolvedWatermark.careportText}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-2">
                      <div className="text-gray-500">MedReach</div>
                      <div className="font-medium text-gray-900 truncate">{resolvedWatermark.medreachText}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-900">Preview</div>
                  <div className="text-[11px] text-gray-500">{wm.diagonal ? 'Diagonal' : 'Centered'}</div>
                </div>

                <div className="relative h-48 rounded-2xl border bg-gray-50 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="px-6 py-2 text-[11px] font-semibold tracking-wide uppercase text-center"
                      style={{
                        opacity: wm.enabled ? opacity : 0.15,
                        transform: wm.diagonal ? 'rotate(-24deg)' : 'none',
                        border: wm.enabled ? '1px dashed rgba(0,0,0,0.25)' : 'none',
                        color: 'rgba(0,0,0,0.45)',
                      }}
                    >
                      {wm.enabled ? (resolvedWatermark.defaultText || 'WATERMARK') : 'Watermark disabled'}
                    </div>
                  </div>

                  <div className="absolute inset-x-4 bottom-3 text-[10px] text-gray-400">Visual approximation for operators only. Final PDF layout may differ slightly.</div>
                </div>

                <div className="rounded-2xl border bg-white p-3 text-[11px] text-gray-600">
                  <div className="inline-flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5" />
                    Applies to PDFs across modules (where enabled).
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section icon={<Mail className="h-4 w-4 text-gray-800" />} title="Support & contact" description="Used across patient and clinician experiences for help links, receipts and system notifications.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Support email" hint="Public-facing" error={errors['support.supportEmail']}>
                <TextInput value={settings.support.supportEmail} onChange={(v) => setByPath('support.supportEmail', v)} placeholder="support@yourdomain.com" inputMode="email" />
              </Field>

              <Field label="Reply-to email" hint="Outbound mail" error={errors['support.replyToEmail']}>
                <TextInput value={settings.support.replyToEmail} onChange={(v) => setByPath('support.replyToEmail', v)} placeholder="noreply@yourdomain.com" inputMode="email" />
              </Field>

              <Field label="Support phone" hint="Optional">
                <div className="flex items-center gap-2">
                  <div className="shrink-0 rounded-xl border bg-white p-2">
                    <Phone className="h-4 w-4 text-gray-700" />
                  </div>
                  <TextInput value={settings.support.supportPhone} onChange={(v) => setByPath('support.supportPhone', v)} placeholder="+27 …" inputMode="tel" />
                </div>
              </Field>

              <Field label="Address line" hint="Optional">
                <div className="flex items-center gap-2">
                  <div className="shrink-0 rounded-xl border bg-white p-2">
                    <MapPin className="h-4 w-4 text-gray-700" />
                  </div>
                  <TextInput
                    value={settings.support.addressLine}
                    onChange={(v) => setByPath('support.support.addressLine'.replace('support.support.', 'support.'), v)}
                    placeholder="Street, City, Region"
                  />
                </div>
              </Field>
            </div>
          </Section>

          <Section icon={<Shield className="h-4 w-4 text-gray-800" />} title="Default policies" description="Safe defaults that shape admin and clinical operations (RBAC and enforcement still applies).">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">Require MFA for admins</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">Recommended for production — reduces takeover risk on privileged accounts.</div>
                </div>
                <Toggle checked={settings.securityDefaults.requireMfaForAdmins} onChange={(v) => setByPath('securityDefaults.requireMfaForAdmins', v)} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">Require MFA for clinicians</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">Good for high-sensitivity workflows (eRx, results, billing).</div>
                </div>
                <Toggle checked={settings.securityDefaults.requireMfaForClinicians} onChange={(v) => setByPath('securityDefaults.requireMfaForClinicians', v)} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">Audit admin actions</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">Keeps an immutable trail for role changes, payout rules and exports.</div>
                </div>
                <Toggle checked={settings.securityDefaults.auditAdminActions} onChange={(v) => setByPath('securityDefaults.auditAdminActions', v)} />
              </div>
            </div>
          </Section>

          <Section icon={<SlidersHorizontal className="h-4 w-4 text-gray-800" />} title="Operations flags" description="Operational toggles used for controlled rollouts and maintenance windows.">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">Maintenance mode</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">Temporarily blocks non-admin access (recommended: show status + ETA).</div>
                </div>
                <Toggle checked={settings.ops.maintenanceMode} onChange={(v) => setByPath('ops.maintenanceMode', v)} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">Allow self-serve clinician signup</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">If enabled, clinicians can apply directly (still requires verification & approval).</div>
                </div>
                <Toggle checked={settings.ops.allowSelfServeClinicianSignup} onChange={(v) => setByPath('ops.allowSelfServeClinicianSignup', v)} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">Allow self-serve patient signup</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">If disabled, patient accounts must be provisioned by admin or enterprise SSO.</div>
                </div>
                <Toggle checked={settings.ops.allowSelfServePatientSignup} onChange={(v) => setByPath('ops.allowSelfServePatientSignup', v)} />
              </div>

              {settings.ops.maintenanceMode ? (
                <InlineBanner kind="warn" title="Maintenance mode is enabled" description="Make sure your patient/clinician apps show a friendly status screen and do not break core flows." />
              ) : null}
            </div>
          </Section>

          {/* ✅ NEW: Reports governance — lifecycle + permissions matrix (from Version C, in Version B aesthetic) */}
          <Section
            icon={<FileText className="h-4 w-4 text-gray-800" />}
            title="Reports governance"
            description="Lifecycle states and who can do what (documentation view). Enforce these rules via RBAC scopes + audit logging."
          >
            <InlineBanner
              kind="info"
              title="This section is a policy map"
              description="It does not change your backend by itself. Use it as the source-of-truth when defining roles/scopes on the RBAC page and enforcing permissions in APIs."
              actions={
                <Link href="/settings?tab=roles" className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  <Shield className="h-3.5 w-3.5" />
                  Configure RBAC
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </Link>
              }
            />

            {/* Lifecycle */}
            <div className="rounded-2xl border bg-gray-50 p-3 md:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Report lifecycle</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">Recommended flow for clinical, financial, and operational reports.</div>
                </div>
                <div className="flex items-center gap-2">
                  <PermBadge p="allow" />
                  <PermBadge p="cond" />
                  <PermBadge p="deny" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                {REPORT_LIFECYCLE.map((s) => (
                  <div key={s.key} className="rounded-2xl border bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <LifecyclePill tint={s.tint}>
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border bg-white">{s.icon}</span>
                        {s.title}
                      </LifecyclePill>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-600">{s.subtitle}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[11px] text-gray-600">
                Tip: make “Publish” and “Redact/Void” require <span className="font-medium text-gray-900">Compliance</span> (or Admin) approval and always write to an immutable audit log.
              </div>
            </div>

            {/* Permissions matrix */}
            <div className="rounded-2xl border bg-white p-3 md:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-gray-900">Permissions matrix</div>
                  <div className="mt-0.5 text-[11px] text-gray-600">
                    Scope should be enforced (tenant → org → practice → patient). “Conditional” means “allowed only within scope + extra rules.”
                  </div>
                </div>
              </div>

              <div className="mt-3 overflow-auto rounded-2xl border">
                <table className="min-w-[920px] w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left text-xs font-semibold text-gray-700 border-b w-[280px]">Action</th>
                      {REPORT_ROLES.map((r) => (
                        <th key={r} className="p-3 text-left text-xs font-semibold text-gray-700 border-b min-w-[110px]">
                          {r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {REPORT_MATRIX.map((row) => (
                      <tr key={row.action} className="odd:bg-white even:bg-gray-50/40">
                        <td className="p-3 border-b align-top">
                          <div className="text-xs font-semibold text-gray-900">{row.action}</div>
                          <div className="mt-0.5 text-[11px] text-gray-600">{row.desc}</div>
                        </td>
                        {REPORT_ROLES.map((r) => (
                          <td key={r} className="p-3 border-b align-top">
                            <PermCell p={row.perms[r]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-2xl border bg-gray-50 p-3 text-[11px] text-gray-600">
                  <div className="text-xs font-semibold text-gray-900">Share links</div>
                  Always: time-limited + watermarked + revocable. Tie to viewer identity where possible.
                </div>
                <div className="rounded-2xl border bg-gray-50 p-3 text-[11px] text-gray-600">
                  <div className="text-xs font-semibold text-gray-900">Exports</div>
                  Prefer “export events” in audit log (who exported what, when, reason).
                </div>
                <div className="rounded-2xl border bg-gray-50 p-3 text-[11px] text-gray-600">
                  <div className="text-xs font-semibold text-gray-900">Hard delete</div>
                  Treat as exceptional. Default to archive + retention policies.
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Right: summary / audit hints */}
        <div className="lg:col-span-1 space-y-4 lg:space-y-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-gray-500">Summary</div>
                <div className="mt-0.5 text-sm font-semibold text-gray-900 truncate">{settings.tenant.displayName}</div>
                <div className="mt-1 text-[11px] text-gray-600 truncate">
                  Slug: <span className="font-medium text-gray-900">{settings.tenant.slug}</span>
                </div>
              </div>
              <div className="shrink-0 rounded-xl border bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-700">{isDirty ? 'Unsaved' : 'Up to date'}</div>
            </div>

            <div className="mt-3 space-y-2 text-[11px] text-gray-600">
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <Globe2 className="h-3.5 w-3.5" />
                  Locale
                </span>
                <span className="font-medium text-gray-900">{settings.locale.locale}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5" />
                  Time zone
                </span>
                <span className="font-medium text-gray-900 truncate">{settings.locale.timeZone}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5" />
                  Primary
                </span>
                <span className="font-medium text-gray-900">{settings.brand.primaryColor}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-gray-50 px-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Watermark
                </span>
                <span className="font-medium text-gray-900">{wm.enabled ? `${Math.round(opacity * 100)}%` : 'Off'}</span>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-800">Operational notes</div>
              <ul className="mt-2 space-y-1 text-[11px] text-gray-600">
                <li className="flex items-center gap-2">
                  <span className={cx('h-1.5 w-1.5 rounded-full', settings.ops.maintenanceMode ? 'bg-amber-500' : 'bg-emerald-500')} />
                  Maintenance: {settings.ops.maintenanceMode ? 'ON' : 'OFF'}
                </li>
                <li className="flex items-center gap-2">
                  <span className={cx('h-1.5 w-1.5 rounded-full', settings.securityDefaults.requireMfaForAdmins ? 'bg-emerald-500' : 'bg-gray-300')} />
                  MFA (Admin): {settings.securityDefaults.requireMfaForAdmins ? 'Required' : 'Not required'}
                </li>
                <li className="flex items-center gap-2">
                  <span className={cx('h-1.5 w-1.5 rounded-full', settings.securityDefaults.auditAdminActions ? 'bg-emerald-500' : 'bg-gray-300')} />
                  Admin audit: {settings.securityDefaults.auditAdminActions ? 'Enabled' : 'Disabled'}
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-900">Recommended next steps</div>
            <div className="mt-2 space-y-2 text-[11px] text-gray-600">
              <div className="rounded-xl border bg-gray-50 p-3">Set RBAC roles & scopes for operators (Admin, Finance, Ops, Compliance).</div>
              <div className="rounded-xl border bg-gray-50 p-3">Confirm CarePort & MedReach defaults align with your payout rules.</div>
              <div className="rounded-xl border bg-gray-50 p-3">Ensure brand assets are hosted and stable for patient-facing and clinician-facing apps.</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-900">Developer note</div>
            <div className="mt-2 text-[11px] text-gray-600">
              This page expects:
              <div className="mt-2 rounded-xl border bg-gray-50 p-3 font-mono text-[10px] text-gray-700 whitespace-pre-wrap">
                GET /api/admin/settings/general → {'{ ok, data }'}
                {'\n'}
                PUT /api/admin/settings/general → {'{ ok, data }'}
                {'\n'}
                (optional) POST /api/admin/assets/upload → {'{ ok, url }'}
                {'\n'}
                data includes: tenant, locale, support, brand, securityDefaults, ops, pdfWatermark, meta
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border bg-white/90 backdrop-blur p-3 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <div className={cx('mt-0.5 h-2.5 w-2.5 rounded-full', isDirty ? 'bg-amber-500' : 'bg-emerald-500')} aria-hidden />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-900">{isDirty ? 'Unsaved changes' : 'All changes saved'}</div>
                  <div className="text-[11px] text-gray-600">
                    {isDirty ? 'Review and save to apply immediately for this tenant.' : 'You’re in sync with the latest tenant configuration.'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={revert}
                  disabled={!isDirty || saving}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
                    !isDirty || saving
                      ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revert
                </button>

                <button
                  type="button"
                  onClick={save}
                  disabled={!isDirty || saving}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold',
                    !isDirty || saving ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800'
                  )}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}
