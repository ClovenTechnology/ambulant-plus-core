// apps/admin-dashboard/app/settings/general/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';

type Perm = { view: boolean; download: boolean; print: boolean };

type PdfWatermark = {
  enabled: boolean;
  defaultText: string;
  careportText?: string;
  medreachText?: string;
  opacity?: number; // 0–1, optional
  diagonal?: boolean; // optional visual hint
};

type Settings = {
  reportAccessDays: number;
  reportPermissions: { premium: Perm; free: Perm };
  pdfWatermark: PdfWatermark;
  updatedAt?: string;
  updatedBy?: string; // optional, backend can ignore if not present
};

const API = '/api/settings/general';

/* ---------- Tiny UI helpers ---------- */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

function ToggleCheckbox(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
        {...props}
      />
    </label>
  );
}

/* ---------- Page ---------- */

export default function GeneralSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Settings;

      // Defensive defaults so the UI is robust if backend is missing fields
      setS({
        reportAccessDays:
          typeof data.reportAccessDays === 'number'
            ? data.reportAccessDays
            : 30,
        reportPermissions: data.reportPermissions ?? {
          premium: { view: true, download: true, print: true },
          free: { view: true, download: false, print: false },
        },
        pdfWatermark: {
          enabled: data.pdfWatermark?.enabled ?? true,
          defaultText: data.pdfWatermark?.defaultText ?? 'AMBULANT+ CONFIDENTIAL',
          careportText: data.pdfWatermark?.careportText ?? '',
          medreachText: data.pdfWatermark?.medreachText ?? '',
          opacity:
            typeof data.pdfWatermark?.opacity === 'number'
              ? data.pdfWatermark.opacity
              : 0.12,
          diagonal: data.pdfWatermark?.diagonal ?? true,
        },
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      });
    } catch (e: any) {
      console.error('load general settings error', e);
      setErr(e?.message || 'Unable to load current general settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!s) return;
    setMsg('');
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) {
        throw new Error(await res.text().catch(() => 'Save failed'));
      }
      setMsg('Saved ✓');
      await load();
    } catch (e: any) {
      console.error('save general settings error', e);
      setErr(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2500);
    }
  }

  function updatePerm(role: 'premium' | 'free', key: keyof Perm, value: boolean) {
    if (!s) return;
    setS({
      ...s,
      reportPermissions: {
        ...s.reportPermissions,
        [role]: {
          ...s.reportPermissions[role],
          [key]: value,
        },
      },
    });
    setMsg('');
  }

  function updateWatermark(patch: Partial<PdfWatermark>) {
    if (!s) return;
    setS({
      ...s,
      pdfWatermark: {
        ...s.pdfWatermark,
        ...patch,
      },
    });
    setMsg('');
  }

  const expirySummary = useMemo(() => {
    if (!s) return '';
    const days = Math.max(0, s.reportAccessDays || 0);
    if (days === 0) return 'Reports never expire (use with care).';
    if (days === 1) return 'Reports remain accessible for 1 day after creation.';
    if (days <= 7) return `Reports remain accessible for ${days} days (short window).`;
    if (days <= 30)
      return `Reports remain accessible for ${days} days (standard retention).`;
    return `Reports remain accessible for ${days} days (extended retention).`;
  }, [s]);

  if (loading || !s) {
    return (
      <main className="p-6 text-sm text-gray-600">
        Loading general settings…
      </main>
    );
  }

  const wm = s.pdfWatermark;
  const updatedMeta =
    s.updatedAt || s.updatedBy
      ? `Last updated ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}${
          s.updatedBy ? ` by ${s.updatedBy}` : ''
        }`
      : '';

  const watermarkPreviewText = wm.defaultText || 'AMBULANT+ CONFIDENTIAL';
  const opacity = wm.opacity ?? 0.12;

  return (
    <main className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-lg md:text-xl font-semibold">
          General Platform Settings
        </h1>
        <p className="text-sm text-gray-600">
          Control report lifecycle, viewer permissions and PDF watermarking for
          CarePort &amp; MedReach output. These rules apply across the tenant.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <Badge>Applies to all clinical &amp; lab reports</Badge>
          <Badge>Changes apply in real-time</Badge>
          {updatedMeta && <span className="text-gray-500">{updatedMeta}</span>}
        </div>
      </header>

      {/* Status messages */}
      {(msg || err) && (
        <div className="space-y-1 text-xs">
          {msg && (
            <div className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              {msg}
            </div>
          )}
          {err && (
            <div className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
              {err}
            </div>
          )}
        </div>
      )}

      {/* Report lifecycle */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Report lifecycle</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Define how long reports remain accessible in portals before
              expiring from patient and clinician views.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Badge>Applies to CarePort &amp; MedReach PDFs</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-start">
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-700">Report expiry (days)</span>
              <input
                type="number"
                min={0}
                className="border rounded px-2 py-1 w-24 text-sm"
                value={s.reportAccessDays}
                onChange={(e) => {
                  const raw = parseInt(e.target.value || '0', 10);
                  const next = Number.isFinite(raw) ? Math.max(0, raw) : 0;
                  setS({ ...s, reportAccessDays: next });
                  setMsg('');
                }}
              />
            </label>
            <p className="text-[11px] text-gray-500">{expirySummary}</p>
            <p className="text-[11px] text-gray-400">
              Tip: 30–90 days works well for most operators. Use 0 only if
              retention is managed elsewhere (e.g. external EHR).
            </p>
          </div>

          <div className="rounded-xl border bg-gray-50 p-3 text-[11px] text-gray-600 space-y-1">
            <div className="font-medium text-gray-700 mb-1">
              How expiry behaves
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                After expiry, links to the report stop working for patients and
                external recipients.
              </li>
              <li>
                Operators with back-office roles may still see the report in
                audit mode (based on your RBAC rules).
              </li>
              <li>
                Expiry does <span className="font-semibold">not</span> delete
                the underlying data — it just hides the rendered artefact.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Permissions matrix */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Report permissions</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Control whether different cohorts can view, download or print
              reports from their portals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
            <Badge>Premium vs Free patient tier</Badge>
            <Badge>Applies to report viewers, not operators</Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Segment</th>
                <th className="px-3 py-2 text-center font-medium">View</th>
                <th className="px-3 py-2 text-center font-medium">Download</th>
                <th className="px-3 py-2 text-center font-medium">Print</th>
                <th className="px-3 py-2 text-left font-medium">Hint</th>
              </tr>
            </thead>
            <tbody>
              {(['premium', 'free'] as const).map((role) => {
                const p = s.reportPermissions[role];
                return (
                  <tr key={role} className="border-t border-gray-200">
                    <td className="px-3 py-2 text-sm font-medium text-gray-800 capitalize">
                      {role}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ToggleCheckbox
                        checked={p.view}
                        onChange={(e) =>
                          updatePerm(role, 'view', e.target.checked)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ToggleCheckbox
                        checked={p.download}
                        onChange={(e) =>
                          updatePerm(role, 'download', e.target.checked)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ToggleCheckbox
                        checked={p.print}
                        onChange={(e) =>
                          updatePerm(role, 'print', e.target.checked)
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-[11px] text-gray-500">
                      {role === 'premium'
                        ? 'Typically full access: view + download + print.'
                        : 'Often restricted to view-only or view + download (no print).'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-gray-500">
          These rules apply to patient-facing and external viewer links.
          Admin/clinical staff permissions remain governed by your{' '}
          <span className="font-semibold">Roles</span> settings.
        </p>
      </section>

      {/* PDF watermark */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">PDF watermark defaults</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Configure default watermarks for all generated reports, with
              product-specific overrides for CarePort and MedReach.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
              checked={wm.enabled}
              onChange={(e) =>
                updateWatermark({ enabled: e.target.checked })
              }
            />
            <span className="text-gray-800">Enable watermark on PDFs</span>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          {/* Form side */}
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs">
                <div className="mb-1 text-gray-600">Default watermark text</div>
                <input
                  className="border rounded px-2 py-1 w-full text-sm"
                  value={wm.defaultText}
                  onChange={(e) =>
                    updateWatermark({ defaultText: e.target.value })
                  }
                  placeholder="e.g. AMBULANT+ • CONFIDENTIAL"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Used for all PDFs unless a product-specific override is
                  available.
                </p>
              </label>
              <div className="space-y-2 text-xs">
                <label className="block">
                  <div className="mb-1 text-gray-600">
                    CarePort-specific text (optional)
                  </div>
                  <input
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={wm.careportText ?? ''}
                    onChange={(e) =>
                      updateWatermark({ careportText: e.target.value })
                    }
                    placeholder="Override for pharmacy reports"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-gray-600">
                    MedReach-specific text (optional)
                  </div>
                  <input
                    className="border rounded px-2 py-1 w-full text-sm"
                    value={wm.medreachText ?? ''}
                    onChange={(e) =>
                      updateWatermark({ medreachText: e.target.value })
                    }
                    placeholder="Override for lab / draws"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-gray-600">Opacity</span>
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={Math.round((opacity || 0.12) * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value || 12);
                    const norm = Math.min(1, Math.max(0.05, v / 100));
                    updateWatermark({ opacity: norm });
                  }}
                />
                <span className="text-[11px] text-gray-500">
                  {Math.round((opacity || 0.12) * 100)}% coverage
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600">Layout</span>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={wm.diagonal ? 'diagonal' : 'horizontal'}
                  onChange={(e) =>
                    updateWatermark({ diagonal: e.target.value === 'diagonal' })
                  }
                >
                  <option value="diagonal">Diagonal across the page</option>
                  <option value="horizontal">Centered horizontally</option>
                </select>
                <span className="text-[11px] text-gray-500">
                  Layout hint for your PDF renderer.
                </span>
              </label>
              <div className="space-y-1 text-[11px] text-gray-500">
                <span className="text-gray-600">Behaviour</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Watermarks apply to both preview and downloads.</li>
                  <li>Operators with export rights may bypass this via code.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Preview side */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 font-medium">Preview</span>
              <span className="text-[11px] text-gray-500">
                Simulated {wm.diagonal ? 'diagonal' : 'centered'} watermark
              </span>
            </div>

            <div className="relative h-40 rounded-xl border bg-gray-50 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="px-6 py-2 text-[11px] font-semibold tracking-wide uppercase"
                  style={{
                    opacity: wm.enabled ? opacity : 0.15,
                    transform: wm.diagonal ? 'rotate(-24deg)' : 'none',
                    border: wm.enabled ? '1px dashed rgba(0,0,0,0.25)' : 'none',
                    color: 'rgba(0,0,0,0.45)',
                  }}
                >
                  {wm.enabled ? watermarkPreviewText || 'WATERMARK PREVIEW' : 'Watermark disabled'}
                </div>
              </div>
              <div className="absolute inset-x-4 bottom-3 text-[10px] text-gray-400">
                This is a visual approximation for operators only. Actual layout
                may differ slightly in the generated PDFs.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Save bar */}
      <div className="flex items-center gap-2">
        <button
          className="px-4 py-2 border rounded-xl bg-black text-white text-sm disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save general settings'}
        </button>
        {msg && (
          <span className="text-xs text-emerald-700">
            {msg}
          </span>
        )}
        {err && (
          <span className="text-xs text-rose-600">
            {err}
          </span>
        )}
      </div>
    </main>
  );
}
