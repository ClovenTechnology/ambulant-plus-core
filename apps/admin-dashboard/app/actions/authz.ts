// apps/admin-dashboard/app/actions/authz.ts
'use server';

import { cookies } from 'next/headers';
import {
  NEXT_AUTHZ_COOKIE,
  NEXT_PROFILE_COOKIE,
  normalizeScopes,
  rolePresets,
} from '../../lib/authz';

type RoleKey = keyof typeof rolePresets;

const COOKIE_MAX_AGE = 60 * 60 * 12; // 12h

function safeRole(value: unknown): RoleKey {
  const role = String(value || '').trim() as RoleKey;

  if (role && Object.prototype.hasOwnProperty.call(rolePresets, role)) {
    return role;
  }

  return Object.keys(rolePresets)[0] as RoleKey;
}

function normaliseScopeInput(scopes: readonly string[] | string[] | Set<string>) {
  if (scopes instanceof Set) {
    return scopes;
  }

  return Array.from(scopes);
}

function setAuthzCookie(payload: {
  role: string;
  scopes: string[];
  ts: number;
}) {
  cookies().set(NEXT_AUTHZ_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function setRole(role: RoleKey) {
  const safe = safeRole(role);
  const preset = rolePresets[safe];

  const scopeSet = normalizeScopes(normaliseScopeInput(preset.scopes));

  setAuthzCookie({
    role: safe,
    scopes: Array.from(scopeSet).sort(),
    ts: Date.now(),
  });

  return { ok: true, role: safe, count: scopeSet.size };
}

export async function setRoleByForm(formData: FormData) {
  const role = safeRole(formData.get('role'));
  return setRole(role);
}

export async function setCustomScopes(
  scopes: readonly string[] | string[] | Set<string>,
  roleLabel = 'Custom',
) {
  const scopeSet = normalizeScopes(normaliseScopeInput(scopes));

  const role = String(roleLabel || 'Custom').trim() || 'Custom';

  setAuthzCookie({
    role,
    scopes: Array.from(scopeSet).sort(),
    ts: Date.now(),
  });

  return { ok: true, role, count: scopeSet.size };
}

export async function setCustomScopesByForm(formData: FormData) {
  const raw = String(formData.get('scopes') || '').trim();
  const role = String(formData.get('label') || 'Custom').trim() || 'Custom';

  const scopes = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  return setCustomScopes(scopes, role);
}

export async function setProfile(name: string, email: string) {
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();

  cookies().set(
    NEXT_PROFILE_COOKIE,
    JSON.stringify({
      name: cleanName,
      email: cleanEmail,
      createdAt: Date.now(),
    }),
    {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    },
  );

  return { ok: true, name: cleanName, email: cleanEmail };
}

export async function setProfileByForm(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();

  return setProfile(name, email);
}

export async function clearAuthz() {
  cookies().delete(NEXT_AUTHZ_COOKIE);
  return { ok: true };
}