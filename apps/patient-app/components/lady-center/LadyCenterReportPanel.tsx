'use client';

import { ChevronDown, Download, FileText } from 'lucide-react';

export default function LadyCenterReportPanel(props: {
  show: boolean;
  onToggle: () => void;
  pdfUrl: string | null;
  pdfLoading: boolean;
  onGenerate: () => void | Promise<void>;
  onDownload: () => void;
  sensitiveHidden: boolean;
  onReveal: () => void;
}) {
  const { show, onToggle, pdfUrl, pdfLoading, onGenerate, onDownload, sensitiveHidden, onReveal } = props;

  return (
    <div id="lady-report" className="mt-4">
      <button
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition ${show ? 'rotate-0' : '-rotate-90'}`} />
          <span className="text-sm font-semibold text-slate-900">Report preview</span>
          <span className="text-xs text-slate-500">PDF</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={async (e) => {
              e.stopPropagation();
              if (!pdfUrl) await onGenerate();
              else onDownload();
            }}
            disabled={pdfLoading}
            title={pdfUrl ? 'Download' : 'Generate'}
          >
            <Download className="mr-2 inline-block h-4 w-4" />
            {pdfLoading ? 'Preparing…' : pdfUrl ? 'Download' : 'Generate'}
          </button>
        </div>
      </button>

      {show ? (
        <div className={`relative mt-3 rounded-2xl border border-slate-200 bg-white p-4 ${sensitiveHidden ? 'blur-sm select-none' : ''}`}>
          {!pdfUrl ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
              Generate a PDF report to preview here.
              <div className="mt-3">
                <button
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  onClick={onGenerate}
                  disabled={pdfLoading}
                >
                  <FileText className="mr-2 inline-block h-4 w-4" />
                  {pdfLoading ? 'Generating…' : 'Generate report'}
                </button>
              </div>
            </div>
          ) : (
            <iframe src={pdfUrl} className="h-[65vh] w-full rounded-xl border" title="Lady Center Report" />
          )}

          {sensitiveHidden ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                onClick={onReveal}
              >
                Tap to reveal
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}