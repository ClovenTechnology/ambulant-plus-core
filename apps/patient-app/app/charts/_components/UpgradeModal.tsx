'use client';

import React from 'react';
import { toast } from '@/components/ToastMount';

type UpgradeModalProps = {
  title: string;
  body: string;
  onClose: () => void;
};

export default function UpgradeModal(props: UpgradeModalProps) {
  const { title, body, onClose } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm leading-6 text-slate-700">{body}</div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
            type="button"
          >
            Not now
          </button>

          <button
            onClick={() => {
              onClose();
              toast('Upgrade flow placeholder. Wire this to your billing page.', 'info');
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            type="button"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}