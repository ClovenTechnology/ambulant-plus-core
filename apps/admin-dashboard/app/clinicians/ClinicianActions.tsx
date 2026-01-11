// apps/admin-dashboard/app/clinicians/ClinicianActions.tsx
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Mode = 'pending' | 'active';
type ActionKey = 'approve' | 'reject' | 'disable' | 'discipline' | 'archive' | null;

export default function ClinicianActions({
  clinicianId,
  mode,
}: {
  clinicianId: string;
  mode: Mode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<ActionKey>(null);
  const [err, setErr] = useState<string | null>(null);

  const idEnc = useMemo(() => encodeURIComponent(clinicianId), [clinicianId]);

  // Two “view” destinations
  const viewHref = `/clinicians/${idEnc}`;
  const adminHref = `/admin/clinicians/${idEnc}`;

  const post = useCallback(
    async (endpoint: string, action: Exclude<ActionKey, null>) => {
      if (busy) return;
      setErr(null);
      setBusy(action);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: clinicianId }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          setErr(txt || `Request failed (${res.status})`);
          return;
        }

        // ✅ Next 13/14 “instant” refresh
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || 'Network error');
      } finally {
        setBusy(null);
      }
    },
    [busy, clinicianId, router]
  );

  const Btn = ({
    children,
    tone,
    onClick,
    action,
  }: {
    children: React.ReactNode;
    tone: 'emerald' | 'rose' | 'amber' | 'slate';
    onClick: () => void;
    action: Exclude<ActionKey, null>;
  }) => {
    const is = busy === action;
    const toneCls: Record<typeof tone, string> = {
      emerald: 'bg-emerald-600 hover:bg-emerald-700',
      rose: 'bg-rose-600 hover:bg-rose-700',
      amber: 'bg-amber-600 hover:bg-amber-700',
      slate: 'bg-slate-600 hover:bg-slate-700',
    };

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!!busy}
        aria-busy={is}
        className={[
          'px-3 py-1 text-sm rounded text-white transition inline-flex items-center gap-2',
          toneCls[tone],
          busy ? 'opacity-60 cursor-not-allowed' : '',
        ].join(' ')}
      >
        {is ? (
          <span
            className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </button>
    );
  };

  const LinkBtn = ({
    href,
    children,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    title?: string;
  }) => (
    <Link
      href={href}
      title={title}
      className="px-3 py-1 rounded border text-sm hover:bg-black/5 transition"
    >
      {children}
    </Link>
  );

  if (mode === 'pending') {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap justify-end gap-2">
          <Btn
            tone="emerald"
            action="approve"
            onClick={() => post('/api/admin/clinicians/approve', 'approve')}
          >
            Approve
          </Btn>

          <Btn
            tone="rose"
            action="reject"
            onClick={() => post('/api/admin/clinicians/reject', 'reject')}
          >
            Reject
          </Btn>

          {/* ✅ Both routes */}
          <LinkBtn href={viewHref} title="View clinician (public admin view)">
            View
          </LinkBtn>
          <LinkBtn href={adminHref} title="Open admin clinician detail page">
            Admin
          </LinkBtn>
        </div>

        {err ? (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1 max-w-[320px] text-right">
            {err}
          </div>
        ) : null}
      </div>
    );
  }

  // active
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Btn
          tone="amber"
          action="disable"
          onClick={() => post('/api/admin/clinicians/disable', 'disable')}
        >
          Disable
        </Btn>

        <Btn
          tone="rose"
          action="discipline"
          onClick={() => post('/api/admin/clinicians/discipline', 'discipline')}
        >
          Disciplinary
        </Btn>

        <Btn
          tone="slate"
          action="archive"
          onClick={() => post('/api/admin/clinicians/archive', 'archive')}
        >
          Archive
        </Btn>

        {/* ✅ Both routes */}
        <LinkBtn href={viewHref} title="View clinician (public admin view)">
          View
        </LinkBtn>
        <LinkBtn href={adminHref} title="Open admin clinician detail page">
          Admin
        </LinkBtn>
      </div>

      {err ? (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1 max-w-[320px] text-right">
          {err}
        </div>
      ) : null}
    </div>
  );
}
