'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  Users,
} from 'lucide-react';

export default function PendingSignupsTile() {
  const [
    pendingApprovals,
    setPendingApprovals,
  ] =
    useState<number | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState(false);

  useEffect(() => {
    let active = true;

    void (
      async () => {
        try {
          const response =
            await fetch(
              '/api/roles/requests?status=pending',
              {
                credentials:
                  'include',
                cache:
                  'no-store',
              },
            );

          const data =
            await response
              .json()
              .catch(
                () => ({}),
              );

          if (!response.ok) {
            throw new Error(
              data?.error ||
              'request_failed',
            );
          }

          const count =
            Array.isArray(
              data?.items,
            )
              ? data.items.length
              : Number(
                  data?.count ||
                  0,
                );

          if (active) {
            setPendingApprovals(
              Number.isFinite(
                count,
              )
                ? count
                : 0,
            );
          }
        }
        catch {
          if (active) {
            setError(true);
            setPendingApprovals(
              null,
            );
          }
        }
      }
    )();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">
          {pendingApprovals ??
            '—'}
        </div>

        <div className="rounded-lg border bg-gray-50 p-2">
          <Users className="h-5 w-5 text-gray-700" />
        </div>
      </div>

      <div className="text-xs text-gray-600">
        {error ? (
          <span className="text-rose-600">
            Pending approvals are unavailable.
          </span>
        ) : (
          <span>
            New Admin accounts awaiting Super Admin review
          </span>
        )}
      </div>

      <div className="mt-2">
        <a
          href="/settings/people/role-requests"
          className="text-sm text-blue-600 hover:underline"
        >
          Review approvals →
        </a>
      </div>
    </div>
  );
}