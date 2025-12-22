//apps/admin-dashboard/app/actions/authz.ts
'use server';

import { cookies } from 'next/headers';
import { NEXT_AUTHZ_COOKIE, NEXT_PROFILE_COOKIE, rolePresets, normalizeScopes } from '../../lib/authz';

type RoleKey = keyof typeof rolePresets;

const COOKIE_MAX_AGE = 60 * 60 * 12; // 12h

export async function setRole(role: RoleKey) {
  const preset = rolePresets[role];
  const scopeSet = normalizeScopes(preset.scopes);

  cookies().set(NEXT_AUTHZ_COOKIE, JSON.stringify({
    role,
    scopes: Array.from(scopeSet).sort(),
    ts: Date.now(),
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true, role, count: scopeSet.size };
}

export async function setRoleByForm(formData: FormData) {
  const role = formData.get('role') as RoleKey;
  return setRole(role);
}

export async function setCustomScopes(scopes: string[], roleLabel = 'Custom') {
  const scopeSet = normalizeScopes(scopes);

  cookies().set(NEXT_AUTHZ_COOKIE, JSON.stringify({
    role: roleLabel,
    scopes: Array.from(scopeSet).sort(),
    ts: Date.now(),
  }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true, role: roleLabel, count: scopeSet.size };
}

export async function setCustomScopesByForm(formData: FormData) {
  const raw = String(formData.get('scopes') || '').trim();
  const role = String(formData.get('label') || 'Custom').trim() || 'Custom';
  const scopes = raw
    .split(/[\s,]+/g)
    .map(s => s.trim())
    .filter(Boolean);
  return setCustomScopes(scopes, role);
}

export async function setProfile(name: string, email: string) {
  cookies().set(NEXT_PROFILE_COOKIE, JSON.stringify({
    name,
    email,
    createdAt: Date.now(),
  }), {
    httpOnly: false, // allow client read for UI (no secrets here)
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return { ok: true, name, email };
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
