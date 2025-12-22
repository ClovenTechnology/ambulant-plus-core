'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

type SignupPayload = {
  name: string;
  email: string;
  password?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  address?: string;
  emergencyContact?: { name?: string; phone?: string };
  bloodType?: string;
  allergies?: string[]; // freeform
  chronicConditions?: string[]; // freeform
  acceptTerms?: boolean;
  acceptData?: boolean;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ageFromDob(dobIso?: string) {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0..4
}

export default function PatientSignupForm({ redirectOnSuccess = '/welcome' }: { redirectOnSuccess?: string }) {
  const router = useRouter();

  const [form, setForm] = useState<SignupPayload>({
    name: '',
    email: '',
    dob: '',
    gender: '',
    phone: '',
    address: '',
    emergencyContact: {},
    bloodType: '',
    allergies: [],
    chronicConditions: [],
    acceptTerms: false,
    acceptData: false,
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // simple tag input helpers for allergies & conditions
  function addTag(field: 'allergies' | 'chronicConditions', tag: string) {
    if (!tag) return;
    setForm((prev: any) => {
      const arr = Array.isArray(prev[field]) ? [...prev[field]] : [];
      if (!arr.includes(tag.trim())) arr.push(tag.trim());
      return { ...prev, [field]: arr };
    });
  }
  function removeTag(field: 'allergies' | 'chronicConditions', tag: string) {
    setForm((prev: any) => ({ ...prev, [field]: (prev[field] || []).filter((t: string) => t !== tag) }));
  }

  // avatar preview
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // derived validations
  const emailValid = useMemo(() => emailRegex.test(form.email || ''), [form.email]);
  const age = useMemo(() => ageFromDob(form.dob as string), [form.dob]);
  const pwStrength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && password === confirm;

  const canSubmit =
    !loading &&
    form.name.trim().length > 2 &&
    emailValid &&
    password.length >= 8 &&
    passwordsMatch &&
    !!form.acceptTerms &&
    !!form.acceptData &&
    (age === null || age >= 13); // example min age rule

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    // basic client checks
    if (!emailValid) {
      setServerError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setServerError('Password must be at least 8 characters.');
      return;
    }
    if (!passwordsMatch) {
      setServerError('Passwords do not match.');
      return;
    }
    if (!form.acceptTerms || !form.acceptData) {
      setServerError('Please accept Terms and Data policy to continue.');
      return;
    }
    if (age !== null && age < 13) {
      setServerError('You must be at least 13 years old to create an account.');
      return;
    }

    setLoading(true);
    try {
      // If avatar file exists, use FormData so we can upload file
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('payload', JSON.stringify({ ...form, password }));
        const res = await fetch('/api/auth/signup', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Signup failed');
      } else {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, password }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Signup failed');
      }

      // success -> redirect or show success view
      router.push(redirectOnSuccess);
    } catch (err: any) {
      console.error('Signup failed', err);
      setServerError(err?.message || 'Signup failed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Create your Ambulant+ account</h2>

      {serverError && <div className="mb-4 text-sm text-red-700 bg-red-50 p-3 rounded">{serverError}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column: avatar + name/email */}
        <div className="space-y-3">
          <label className="block text-sm font-medium">Profile photo</label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden grid place-items-center">
              {avatarPreview ? <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">Upload</span>}
            </div>
            <div className="flex-1">
              <input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files ? e.target.files[0] : null)}
                className="text-sm"
              />
              <div className="text-xs text-gray-500 mt-1">Optional. Use a clear headshot for clinician/ID views.</div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Full name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" required />
          </div>

          <div>
            <label className="text-sm font-medium">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={clsx('mt-1 block w-full border rounded px-3 py-2', emailValid ? '' : 'ring-1 ring-red-300')} required />
            {!emailValid && form.email.length > 0 && <div className="text-xs text-red-600 mt-1">Invalid email</div>}
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" required />
            <div className="flex items-center gap-2 mt-1">
              <div className="text-xs text-gray-500">Strength:</div>
              <div className="flex-1 bg-gray-100 rounded h-2 overflow-hidden">
                <div className={clsx('h-2', pwStrength >= 4 ? 'w-full bg-emerald-500' : pwStrength === 3 ? 'w-3/4 bg-amber-400' : pwStrength === 2 ? 'w-1/2 bg-yellow-400' : 'w-1/4 bg-red-400')} />
              </div>
              <div className="text-xs text-gray-500 w-16 text-right">{pwStrength}/4</div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={clsx('mt-1 block w-full border rounded px-3 py-2', passwordsMatch || confirm.length === 0 ? '' : 'ring-1 ring-red-300')} required />
            {!passwordsMatch && confirm.length > 0 && <div className="text-xs text-red-600 mt-1">Passwords do not match</div>}
          </div>
        </div>

        {/* Middle column: personal & contact */}
        <div className="md:col-span-2 grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Date of birth</label>
              <input type="date" value={form.dob as string} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" />
              {age !== null && <div className="text-xs text-gray-500 mt-1">Age: {age}</div>}
            </div>
            <div>
              <label className="text-sm font-medium">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2">
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="nonbinary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Mobile phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" placeholder="+27 71 000 0000" />
            </div>
            <div>
              <label className="text-sm font-medium">Blood type</label>
              <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2">
                <option value="">Unknown</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Emergency contact name</label>
              <input value={form.emergencyContact?.name} onChange={(e) => setForm({ ...form, emergencyContact: { ...(form.emergencyContact || {}), name: e.target.value } })} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Emergency contact phone</label>
              <input value={form.emergencyContact?.phone} onChange={(e) => setForm({ ...form, emergencyContact: { ...(form.emergencyContact || {}), phone: e.target.value } })} className="mt-1 block w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Allergies</label>
            <TagInput value={form.allergies || []} onAdd={(t) => addTag('allergies', t)} onRemove={(t) => removeTag('allergies', t)} placeholder="e.g. Penicillin" />
          </div>

          <div>
            <label className="text-sm font-medium">Chronic conditions</label>
            <TagInput value={form.chronicConditions || []} onAdd={(t) => addTag('chronicConditions', t)} onRemove={(t) => removeTag('chronicConditions', t)} placeholder="e.g. Hypertension" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
          <span className="text-sm">I agree to the <a className="text-indigo-600" href="/terms" target="_blank" rel="noopener">Terms of Service</a>.</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.acceptData} onChange={(e) => setForm({ ...form, acceptData: e.target.checked })} />
          <span className="text-sm">I consent to processing my health data as described in the <a className="text-indigo-600" href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span>
        </label>
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-500">By signing up you confirm you are the account owner and consent to clinical messages.</div>
        <button disabled={!canSubmit} type="submit" className={clsx('px-4 py-2 rounded shadow text-white', canSubmit ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed')}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </div>
    </form>
  );
}

/* ---------- Small TagInput subcomponent ---------- */
function TagInput({ value = [], onAdd, onRemove, placeholder = '' }: { value?: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void; placeholder?: string; }) {
  const [text, setText] = useState('');
  return (
    <div>
      <div className="flex gap-2 flex-wrap">
        {(value || []).map((t) => (
          <div key={t} className="flex items-center gap-2 bg-gray-100 px-2 py-1 rounded text-sm">
            <span>{t}</span>
            <button type="button" onClick={() => onRemove(t)} className="text-xs text-gray-500">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(''); } } }} placeholder={placeholder} className="flex-1 border rounded px-3 py-2" />
        <button type="button" onClick={() => { if (text.trim()) { onAdd(text.trim()); setText(''); } }} className="px-3 py-2 bg-sky-600 text-white rounded">Add</button>
      </div>
    </div>
  );
}
