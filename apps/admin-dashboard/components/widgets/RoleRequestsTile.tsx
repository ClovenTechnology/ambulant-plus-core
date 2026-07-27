'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  UserRoundCog,
} from 'lucide-react';

type RoleRequestItem = {
  id: string;
  email: string;
  name?: string | null;
  requestedRoles?: string[];
};

export default function RoleRequestsTile() {
  const [
    count,
    setCount,
  ] =
    useState<number | null>(
      null,
    );

  const [
    recent,
    setRecent,
  ] =
    useState<RoleRequestItem[]>(
      [],
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

          const items:
            RoleRequestItem[] =
            Array.isArray(
              data?.items,
            )
              ? data.items
              : [];

          if (active) {
            setCount(
              items.length,
            );

            setRecent(
              items.slice(
                0,
                3,
              ),
            );
          }
        }
        catch {
          if (active) {
            setError(true);
            setCount(null);
            setRecent([]);
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
          {count ?? '—'}
        </div>

        <div className="rounded-lg border bg-gray-50 p-2">
          <UserRoundCog className="h-5 w-5 text-gray-700" />
        </div>
      </div>

      <div className="text-xs text-gray-600">
        Pending Admin approvals
      </div>

      {error ? (
        <div className="text-xs text-rose-600">
          Approval data is unavailable.
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {recent.map(
            (request) => (
              <li
                key={request.id}
                className="text-sm"
              >
                <span className="font-medium">
                  {request.name ||
                    request.email}
                </span>

                {request
                  .requestedRoles
                  ?.length ? (
                  <span className="text-gray-600">
                    {' — '}
                    {request.requestedRoles.join(
                      ', ',
                    )}
                  </span>
                ) : null}
              </li>
            ),
          )}

          {count === 0 ? (
            <li className="text-sm text-gray-500">
              No pending applications.
            </li>
          ) : null}
        </ul>
      )}

      <div className="mt-2">
        <a
          href="/settings/people/role-requests"
          className="text-sm text-blue-600 hover:underline"
        >
          Review applications →
        </a>
      </div>
    </div>
  );
}