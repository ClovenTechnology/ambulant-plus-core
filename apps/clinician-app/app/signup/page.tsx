'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClinicianSignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [fee, setFee] = useState(650);
  const [license, setLicense] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const payload = {
        role: 'clinician',
        name,
        email,
        password,
        specialty,
        feeZAR: Number(fee),
        license,
        phone,
      };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error || 'failed'}`);
      } else {
        setMsg(`✅ Signed up as clinician ${data.userId || data.domainId || 'OK'}`);
        // optionally redirect to clinician onboarding or dashboard
        router.push('/clinician/onboard');
      }
    } catch (err: any) {
      setMsg(`Error: ${err?.message ?? 'network error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Clinician Signup</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="w-full border p-2 rounded" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full border p-2 rounded" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="w-full border p-2 rounded" required />
        <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Specialty" className="w-full border p-2 rounded" required />
        <input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="License / Reg. number (optional)" className="w-full border p-2 rounded" />
        <input type="number" value={fee} onChange={(e) => setFee(Number(e.target.value))} placeholder="Consult Fee (R)" className="w-full border p-2 rounded" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-full border p-2 rounded" />

        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded" disabled={loading}>
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>

          <button type="button" onClick={() => router.push('/auth/login')} className="px-4 py-2 rounded border">
            Already have account
          </button>
        </div>
      </form>
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </main>
  );
}
