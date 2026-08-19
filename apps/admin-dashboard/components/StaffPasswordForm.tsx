'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  errorText,
  userFacingApiError,
} from '@/lib/admin-error';

function passwordPolicyError(password: string) {
  if (password.length < 12) {
    return 'Use at least 12 characters for your new password.';
  }
  if (password.length > 128) {
    return 'Use no more than 128 characters for your new password.';
  }
  if (/\s/.test(password)) {
    return 'Do not use spaces in your new password.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Include at least one lowercase letter in your new password.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Include at least one uppercase letter in your new password.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Include at least one number in your new password.';
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Include at least one symbol in your new password.';
  }
  return '';
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-700">
        {label}
      </span>
      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="w-full rounded-xl border px-3 py-2 pr-11 text-sm"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 grid w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </span>
    </label>
  );
}

export function StaffPasswordForm() {
  const [currentPassword, setCurrentPassword] =
    useState('');
  const [newPassword, setNewPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [showCurrent, setShowCurrent] =
    useState(false);
  const [showNew, setShowNew] =
    useState(false);
  const [showConfirm, setShowConfirm] =
    useState(false);
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

    const policyError =
      passwordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    if (newPassword === currentPassword) {
      setError(
        'Choose a new password that is different from your current password.',
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        'The new password confirmation does not match.',
      );
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
      const json = await response
        .json()
        .catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(
          errorText(
            userFacingApiError({
              response,
              json,
              fallback:
                'Unable to change your password.',
            }),
          ),
        );
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setNotice(
        'Your password was changed successfully. Use the new password the next time you sign in.',
      );
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

      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        Use 12-128 characters with uppercase and lowercase letters,
        at least one number and one symbol. Spaces are not allowed.
      </div>

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
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          visible={showCurrent}
          onToggle={() =>
            setShowCurrent((value) => !value)
          }
        />

        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          visible={showNew}
          onToggle={() =>
            setShowNew((value) => !value)
          }
        />

        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          visible={showConfirm}
          onToggle={() =>
            setShowConfirm((value) => !value)
          }
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy
          ? 'Changing password...'
          : 'Change password'}
      </button>
    </section>
  );
}
