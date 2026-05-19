'use client';

import React from 'react';

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageButtons: Array<number | '…'>;
  onPageChange: (page: number) => void;
};

export default function CliniciansPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageButtons,
  onPageChange,
}: Props) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap justify-between items-center gap-3 mt-5">
      <div className="text-sm text-gray-600">
        Showing {start}–{end} of {totalItems}
      </div>

      <nav className="flex items-center gap-2" aria-label="Pagination">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-2 py-1 text-sm rounded bg-white border disabled:opacity-50"
          disabled={page <= 1}
          aria-disabled={page <= 1}
          type="button"
        >
          Prev
        </button>

        {pageButtons.map((item, i) =>
          item === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={`page-${item}`}
              onClick={() => onPageChange(item)}
              className={`px-3 py-1.5 text-sm rounded-full border transition ${
              page === item
                ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                : 'bg-white/85 hover:bg-white border-slate-200 text-slate-700'
            }`}
              aria-current={page === item ? 'page' : undefined}
              type="button"
            >
              {item}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="px-2 py-1 text-sm rounded bg-white border disabled:opacity-50"
          disabled={page >= totalPages}
          aria-disabled={page >= totalPages}
          type="button"
        >
          Next
        </button>
      </nav>
    </div>
  );
}
