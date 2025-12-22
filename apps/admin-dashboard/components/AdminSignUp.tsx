//apps/admin-dashboard/components/AdminSignUp.tsx
'use client';

import { useState, useTransition } from 'react';
import { rolePresets } from '../lib/authz';
import { setProfile, setRole } from '../app/actions/authz';
import { useRouter } from 'next/navigation';

export default function AdminSignUp() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const roleKeys = Object.keys(rolePresets) as (keyof typeof rolePresets)[];
  const [role, setRoleState] = useState<keyof typeof rolePresets>('Admin');
  const [password, setPassword] = useState(''); // demo only

  const disabled = !name.trim() || !email.trim() || !role || !password.trim();

  return (
    <form
      className="max-w-md mx-auto rounded-2xl border bg-white p-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          // In a real app you'd create the user in your DB here.
          await setProfile(name.trim(), email.trim());
          await setRole(role);
          router.push('/');
          router.refresh();
        });
      }}
    >
      <h1 className="text-xl font-semibold">Create Admin Account</h1>
      <p className="text-sm text-gray-600">Choose a role to set initial access.</p>

      <label className="block text-sm">
        <span className="text-gray-700">Full name</span>
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-gray-700">Email</span>
        <input
          type="email"
          className="mt-1 w-full rounded border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-gray-700">Password</span>
        <input
          type="password"
          className="mt-1 w-full rounded border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </label>

      <label className="block text-sm">
        <span className="text-gray-700">Role</span>
        <select
          className="mt-1 w-full rounded border px-3 py-2"
          value={role}
          onChange={(e) => setRoleState(e.target.value as keyof typeof rolePresets)}
          required
        >
          {roleKeys.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="w-full px-4 py-2 rounded bg-black text-white hover:bg-black/90 disabled:opacity-50"
        disabled={pending || disabled}
      >
        {pending ? 'Creating…' : 'Create account'}
      </button>

      <p className="text-xs text-gray-500">
        By continuing you agree to the Admin Terms. (Demo signup sets cookies only.)
      </p>
    </form>
  );
}
