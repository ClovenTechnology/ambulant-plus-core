'use client';

import { useState } from 'react';
import {
  errorText,
  userFacingApiError,
} from '@/lib/admin-error';

export function StaffPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    setError('');
    setNotice('');

    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }

    if (!newPassword) {
      setError('Enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The new password confirmation does not match.');
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        '/api/admin/auth/password',
        {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(
          errorText(
            userFacingApiError({
              response,
              json,
              fallback: 'Unable to change your password.',
            }),
          ),
        );
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Your password was changed successfully.');
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to change your password.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-4">
      <h2 className="text-base font-semibold">
        Security
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Change the password used for your Ambulant+ Staff sign-in.
      </p>

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) =>
            setCurrentPassword(
              event.target.value,
            )
          }
          placeholder="Current password"
          className="rounded-xl border px-3 py-2 text-sm"
        />

        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) =>
            setNewPassword(
              event.target.value,
            )
          }
          placeholder="New password"
          className="rounded-xl border px-3 py-2 text-sm"
        />

        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(
              event.target.value,
            )
          }
          placeholder="Confirm new password"
          className="rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy
          ? 'Changing password…'
          : 'Change password'}
      </button>
    </section>
  );
}
