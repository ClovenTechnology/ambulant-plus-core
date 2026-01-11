// apps/clinician-app/app/auth/signup/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  BadgeCheck,
  User,
  Mail,
  Lock,
  Phone,
  Stethoscope,
  FileUp,
  CalendarDays,
  MapPin,
  Truck,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';

type InsuranceSettings = {
  platformCoverEnabled?: boolean;
  platformInsurerName?: string;
  platformPolicyNumber?: string;
  platformCoversVirtual?: boolean;
};

type Qualification = { degree: string; institution: string; yearOfCompletion?: string };
type OtherQualification = { award: string; institution: string; yearOfCompletion?: string };

type TrainingPref = {
  mode: 'virtual' | 'in_person';
  city?: string;
  preferredDate?: string; // YYYY-MM-DD
  preferredSlot?: 'morning' | 'midday' | 'afternoon' | 'evening';
};

type ShippingInfo = {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
};

type SignupResponse = {
  ok?: boolean;
  clinician?: any;
  clinicianId?: string;
  error?: string;
  message?: string;
  redirectTo?: string;
  trainingLink?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function safeInternalPath(p: any, fallback: string) {
  const v = String(p || '').trim();
  if (!v) return fallback;
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  return fallback;
}

const COMM_CHANNELS = ['Email', 'Phone', 'SMS', 'WhatsApp'] as const;
const TRAINING_SLOTS: Array<{ label: string; value: TrainingPref['preferredSlot'] }> = [
  { label: 'Morning', value: 'morning' },
  { label: 'Midday', value: 'midday' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
];

export default function ClinicianSignupPage() {
  const router = useRouter();

  // Basic identity
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');

  // Professional
  const [specialty, setSpecialty] = useState('');
  const [license, setLicense] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [address, setAddress] = useState('');

  const [qualifications, setQualifications] = useState<Qualification[]>([
    { degree: '', institution: '', yearOfCompletion: '' },
  ]);
  const [otherQualifications, setOtherQualifications] = useState<OtherQualification[]>([
    { award: '', institution: '', yearOfCompletion: '' },
  ]);

  // Citizenship
  const [citizenship, setCitizenship] = useState<'south_african' | 'non_south_african' | ''>('');
  const [saIdNumber, setSaIdNumber] = useState('');
  const [citizenshipCountry, setCitizenshipCountry] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportIssuingAuthority, setPassportIssuingAuthority] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');

  // HPCSA
  const [hpcsaPracticeNumber, setHpcsaPracticeNumber] = useState('');
  const [hpcsaDocFile, setHpcsaDocFile] = useState<File | null>(null);
  const [nextRenewalDate, setNextRenewalDate] = useState('');

  // Insurance
  const [insuranceSettings, setInsuranceSettings] = useState<InsuranceSettings | null>(null);
  const platformCover = insuranceSettings?.platformCoverEnabled === true;

  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [insurerName, setInsurerName] = useState('');
  const [insuranceType, setInsuranceType] = useState('');
  const [insuranceCoversVirtual, setInsuranceCoversVirtual] = useState<'yes' | 'no' | ''>('');

  // Communication / languages
  const [preferredCommunication, setPreferredCommunication] = useState<string[]>([]);
  const [primaryLanguage, setPrimaryLanguage] = useState('');
  const [otherLanguages, setOtherLanguages] = useState('');
  const [hasTelemedicineExperience, setHasTelemedicineExperience] = useState<boolean | null>(null);

  // Mandatory onboarding data
  const [training, setTraining] = useState<TrainingPref>({
    mode: 'virtual',
    city: 'Johannesburg',
    preferredDate: '',
    preferredSlot: 'morning',
  });

  const [shipping, setShipping] = useState<ShippingInfo>({
    recipientName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'South Africa',
  });

  // UX state
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch insurance settings (local first; fallback to gateway if you later proxy)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/insurance', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json) setInsuranceSettings(json);
          return;
        }
      } catch {
        // ignore
      }
      // Keep silent; default is no platform cover
    })();
  }, []);

  const togglePreferredCommunication = (value: string) => {
    setPreferredCommunication((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const validateSaId = (id: string) => /^\d{13}$/.test(String(id || '').replace(/\s+/g, ''));

  const stepLabel = useMemo(() => {
    return ['Account', 'Professional', 'Compliance', 'Training & Starter Kit'][step];
  }, [step]);

  const canGoNext = useMemo(() => {
    if (step === 0) {
      return !!name.trim() && !!email.trim() && pw.length >= 8;
    }
    if (step === 1) {
      return !!specialty.trim();
    }
    if (step === 2) {
      if (citizenship === 'south_african' && !validateSaId(saIdNumber)) return false;
      if (citizenship === 'non_south_african' && !passportNumber.trim()) return false;
      // Consent is enforced on final submit, but we can block next too.
      return true;
    }
    return true;
  }, [step, name, email, pw, specialty, citizenship, saIdNumber, passportNumber]);

  function validateFinal(): string | null {
    if (!name.trim()) return 'Full name is required.';
    if (!email.trim()) return 'Email is required.';
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!specialty.trim()) return 'Specialty is required.';
    if (citizenship === 'south_african' && !validateSaId(saIdNumber)) return 'SA ID number must be 13 digits.';
    if (citizenship === 'non_south_african' && !passportNumber.trim()) return 'Passport number is required.';
    if (!platformCover) {
      if (hasInsurance === true && !insurerName.trim()) return 'Insurer name is required (or enable platform-wide cover).';
    }
    if (!consent) return 'You must agree to terms and privacy policy.';
    // training required (capture at least a date preference)
    if (!training.preferredDate) return 'Please select a preferred training date.';
    // shipping required (for starter kit post-payment)
    if (!shipping.recipientName.trim()) return 'Shipping recipient name is required.';
    if (!shipping.phone.trim()) return 'Shipping phone is required.';
    if (!shipping.addressLine1.trim() || !shipping.city.trim()) return 'Shipping address (line 1 + city) is required.';
    return null;
  }

  const updateQualification = (idx: number, patch: Partial<Qualification>) => {
    setQualifications((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const addQualification = () => setQualifications((prev) => [...prev, { degree: '', institution: '', yearOfCompletion: '' }]);
  const removeQualification = (idx: number) => setQualifications((prev) => prev.filter((_, i) => i !== idx));

  const updateOtherQualification = (idx: number, patch: Partial<OtherQualification>) => {
    setOtherQualifications((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const addOtherQualification = () =>
    setOtherQualifications((prev) => [...prev, { award: '', institution: '', yearOfCompletion: '' }]);
  const removeOtherQualification = (idx: number) => setOtherQualifications((prev) => prev.filter((_, i) => i !== idx));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setMsg(null);
    const err = validateFinal();
    if (err) {
      setMsg(`Error: ${err}`);
      setStep(3);
      return;
    }

    setLoading(true);
    try {
      const emailNorm = email.trim().toLowerCase();

      // Build a single “profile” blob (stored server-side in metadata.rawProfileJson)
      const profile = {
        dob: dob || undefined,
        gender: gender || undefined,
        address: address || undefined,

        qualifications: qualifications
          .filter((q) => q.degree || q.institution)
          .map((q) => ({
            degree: q.degree.trim(),
            institution: q.institution.trim(),
            yearOfCompletion: q.yearOfCompletion || undefined,
          })),
        otherQualifications: otherQualifications
          .filter((q) => q.award || q.institution)
          .map((q) => ({
            award: q.award.trim(),
            institution: q.institution.trim(),
            yearOfCompletion: q.yearOfCompletion || undefined,
          })),

        citizenship: citizenship || undefined,
        saIdNumber: citizenship === 'south_african' ? saIdNumber.replace(/\s+/g, '') : undefined,
        citizenshipCountry: citizenship === 'non_south_african' ? citizenshipCountry.trim() : undefined,
        passportNumber: citizenship === 'non_south_african' ? passportNumber.trim() : undefined,
        passportIssuingAuthority: citizenship === 'non_south_african' ? passportIssuingAuthority.trim() : undefined,
        passportExpiry: citizenship === 'non_south_african' ? passportExpiry || undefined : undefined,

        hpcsaPracticeNumber: hpcsaPracticeNumber.trim() || undefined,
        hpcsaNextRenewalDate: nextRenewalDate || undefined,

        // Insurance: if platform cover enabled, capture nothing here
        hasInsurance: platformCover ? undefined : typeof hasInsurance === 'boolean' ? hasInsurance : undefined,
        insurerName: platformCover ? undefined : hasInsurance ? insurerName.trim() : undefined,
        insuranceType: platformCover ? undefined : hasInsurance ? insuranceType.trim() : undefined,
        insuranceCoversVirtual: platformCover ? undefined : hasInsurance ? insuranceCoversVirtual === 'yes' : undefined,

        preferredCommunication,
        primaryLanguage: primaryLanguage.trim() || undefined,
        otherLanguages: otherLanguages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        hasTelemedicineExperience: typeof hasTelemedicineExperience === 'boolean' ? hasTelemedicineExperience : undefined,

        // Onboarding (mandatory)
        onboarding: {
          training: {
            ...training,
          },
          shipping: {
            ...shipping,
          },
          // NOTE: actual payment + shipping tracking is handled later by admin tools.
          payment: { status: 'pending' as const },
          starterKit: { status: 'pending' as const },
        },
      };

      // Prefer multipart (supports file upload)
      const fd = new FormData();
      fd.set('role', 'clinician');
      fd.set('name', name.trim());
      fd.set('email', emailNorm);
      fd.set('password', pw);
      fd.set('phone', phone.trim());
      fd.set('specialty', specialty.trim());
      if (license.trim()) fd.set('license', license.trim());
      fd.set('profile', JSON.stringify(profile));

      if (hpcsaDocFile) {
        fd.set('hpcsaDoc', hpcsaDocFile);
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      const data = (await res.json().catch(() => ({} as SignupResponse))) as SignupResponse;

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || data?.message || 'Signup failed');
      }

      setDone(true);

      // ✅ Redirect priority:
      // 1) server-supplied internal redirectTo
      // 2) server-supplied internal trainingLink
      // 3) default “premium” flow: training schedule (with clinicianId when available)
      const redirectTo = safeInternalPath(data?.redirectTo, '');
      if (redirectTo) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      const trainingLink = safeInternalPath((data as any)?.trainingLink, '');
      if (trainingLink) {
        router.push(trainingLink);
        router.refresh();
        return;
      }

      // PATCH: onboard -> training schedule (with clinicianId when possible)
      {
        const id = (data as any)?.clinician?.id || (data as any)?.clinicianId;
        if (id) router.push(`/training/schedule?clinicianId=${encodeURIComponent(String(id))}`);
        else router.push('/training/schedule');
      }
      router.refresh();
    } catch (er: any) {
      setMsg(`Error: ${er?.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(99,102,241,0.18),transparent_55%),radial-gradient(900px_circle_at_100%_0%,rgba(16,185,129,0.12),transparent_50%)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* Left: story / trust */}
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-black text-slate-700 backdrop-blur">
              <Sparkles className="h-4 w-4 text-indigo-700" />
              Ambulant+ · Clinician
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Join the Contactless
              <span className="block bg-gradient-to-r from-indigo-700 to-emerald-700 bg-clip-text text-transparent">
                Care Network
              </span>
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Training is mandatory. Once your training is scheduled and paid, your starter kit is dispatched, and you’ll
              be certified by an admin before your profile becomes visible to patients.
            </p>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
              <InfoCard
                icon={<ClipboardCheck className="h-4 w-4 text-indigo-700" />}
                title="Mandatory training"
                desc="Schedule + pay, then complete onboarding. Admin certifies you before patients can book you."
              />
              <InfoCard
                icon={<Truck className="h-4 w-4 text-emerald-700" />}
                title="Starter kit delivery"
                desc="After payment, kit ships. Admin adds courier + tracking, and you get email/SMS notifications."
              />
              <InfoCard
                icon={<ShieldCheck className="h-4 w-4 text-slate-800" />}
                title="Compliance-first"
                desc="HPCSA checks, insurance policy capture, and quality guardrails aligned to clinical workflows."
              />
              <InfoCard
                icon={<BadgeCheck className="h-4 w-4 text-slate-800" />}
                title="Verified visibility"
                desc="You can log in during onboarding, but are only listed to patients after certification."
              />
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Already onboard?{' '}
              <Link href="/auth/login" className="font-bold text-slate-800 hover:underline">
                Sign in
              </Link>
              .
            </div>
          </section>

          {/* Right: form */}
          <section>
            <div className="mx-auto w-full max-w-xl">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-500">Clinician Application</div>
                    <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">{stepLabel}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {step === 0 && 'Create your account credentials.'}
                      {step === 1 && 'Your professional profile details.'}
                      {step === 2 && 'Compliance and verification information.'}
                      {step === 3 && 'Training preference + starter kit shipping details.'}
                    </div>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-700" />
                    ) : (
                      <Stethoscope className="h-5 w-5 text-indigo-700" />
                    )}
                  </div>
                </div>

                <Stepper step={step} />

                {msg ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {msg}
                  </div>
                ) : null}

                {done ? (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    <div className="flex items-center gap-2 font-extrabold">
                      <CheckCircle2 className="h-4 w-4" />
                      Application submitted
                    </div>
                    <div className="mt-1 text-[12px] text-emerald-900/80">
                      Next: schedule your training slot and complete payment to unlock dispatch + certification.
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-5 space-y-5">
                  {step === 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Full name *" icon={<User className="h-4 w-4" />}>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={inputCls}
                          placeholder="Dr. Jane Doe"
                          required
                        />
                      </Field>

                      <Field label="Email *" icon={<Mail className="h-4 w-4" />}>
                        <input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={inputCls}
                          placeholder="name@example.com"
                          type="email"
                          autoComplete="email"
                          required
                        />
                      </Field>

                      <Field
                        label="Password * (min 8)"
                        icon={<Lock className="h-4 w-4" />}
                        right={
                          <button
                            type="button"
                            onClick={() => setShowPw((s) => !s)}
                            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                            aria-label={showPw ? 'Hide password' : 'Show password'}
                          >
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      >
                        <input
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          className={inputCls}
                          placeholder="••••••••"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                        />
                      </Field>

                      <Field label="Phone" icon={<Phone className="h-4 w-4" />}>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={inputCls}
                          placeholder="+27..."
                          type="tel"
                        />
                      </Field>
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Specialty *" icon={<Stethoscope className="h-4 w-4" />}>
                          <input
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className={inputCls}
                            placeholder="General Practice"
                            required
                          />
                        </Field>

                        <Field label="License / Reg. number (optional)" icon={<BadgeCheck className="h-4 w-4" />}>
                          <input
                            value={license}
                            onChange={(e) => setLicense(e.target.value)}
                            className={inputCls}
                            placeholder="HPCSA / Council reg."
                          />
                        </Field>

                        <Field label="Date of birth" icon={<CalendarDays className="h-4 w-4" />}>
                          <input value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} type="date" />
                        </Field>

                        <Field label="Gender" icon={<User className="h-4 w-4" />}>
                          <select value={gender} onChange={(e) => setGender(e.target.value as any)} className={selectCls}>
                            <option value="">Select</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>

                        <Field label="Address (optional)" icon={<MapPin className="h-4 w-4" />} className="sm:col-span-2">
                          <textarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className={textareaCls}
                            rows={3}
                            placeholder="Practice / billing address (optional)"
                          />
                        </Field>
                      </div>

                      <Section title="Education & Qualifications">
                        <div className="space-y-3">
                          {qualifications.map((q, idx) => (
                            <div key={`q-${idx}`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <MiniField label="Degree">
                                <input
                                  value={q.degree}
                                  onChange={(e) => updateQualification(idx, { degree: e.target.value })}
                                  className={inputCls}
                                  placeholder="MBChB"
                                />
                              </MiniField>
                              <MiniField label="Institution">
                                <input
                                  value={q.institution}
                                  onChange={(e) => updateQualification(idx, { institution: e.target.value })}
                                  className={inputCls}
                                  placeholder="University of ..."
                                />
                              </MiniField>
                              <MiniField label="Year">
                                <div className="flex gap-2">
                                  <input
                                    value={q.yearOfCompletion || ''}
                                    onChange={(e) => updateQualification(idx, { yearOfCompletion: e.target.value })}
                                    className={inputCls}
                                    placeholder="2017"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeQualification(idx)}
                                    className="rounded-2xl border border-slate-200 px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                                    aria-label="Remove qualification"
                                  >
                                    ×
                                  </button>
                                </div>
                              </MiniField>
                            </div>
                          ))}
                          <button type="button" onClick={addQualification} className="text-xs font-extrabold text-indigo-700 hover:underline">
                            + Add qualification
                          </button>
                        </div>

                        <div className="mt-5 space-y-3">
                          <div className="text-xs font-black text-slate-700">Other awards</div>
                          {otherQualifications.map((q, idx) => (
                            <div key={`oq-${idx}`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <MiniField label="Award">
                                <input
                                  value={q.award}
                                  onChange={(e) => updateOtherQualification(idx, { award: e.target.value })}
                                  className={inputCls}
                                  placeholder="Diploma / Award"
                                />
                              </MiniField>
                              <MiniField label="Institution">
                                <input
                                  value={q.institution}
                                  onChange={(e) => updateOtherQualification(idx, { institution: e.target.value })}
                                  className={inputCls}
                                  placeholder="College / Board"
                                />
                              </MiniField>
                              <MiniField label="Year">
                                <div className="flex gap-2">
                                  <input
                                    value={q.yearOfCompletion || ''}
                                    onChange={(e) => updateOtherQualification(idx, { yearOfCompletion: e.target.value })}
                                    className={inputCls}
                                    placeholder="2020"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeOtherQualification(idx)}
                                    className="rounded-2xl border border-slate-200 px-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                                    aria-label="Remove award"
                                  >
                                    ×
                                  </button>
                                </div>
                              </MiniField>
                            </div>
                          ))}
                          <button type="button" onClick={addOtherQualification} className="text-xs font-extrabold text-indigo-700 hover:underline">
                            + Add award
                          </button>
                        </div>
                      </Section>

                      <Section title="Communication & Languages">
                        <div className="flex flex-wrap gap-2">
                          {COMM_CHANNELS.map((mode) => (
                            <Pill
                              key={mode}
                              label={mode}
                              selected={preferredCommunication.includes(mode)}
                              onClick={() => togglePreferredCommunication(mode)}
                            />
                          ))}
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <MiniField label="Primary language">
                            <input
                              value={primaryLanguage}
                              onChange={(e) => setPrimaryLanguage(e.target.value)}
                              className={inputCls}
                              placeholder="English"
                            />
                          </MiniField>
                          <MiniField label="Other languages (comma separated)">
                            <input
                              value={otherLanguages}
                              onChange={(e) => setOtherLanguages(e.target.value)}
                              className={inputCls}
                              placeholder="Zulu, Afrikaans"
                            />
                          </MiniField>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-black text-slate-700">Telemedicine experience</div>
                          <div className="mt-2 flex gap-2">
                            <Pill label="Yes" selected={hasTelemedicineExperience === true} onClick={() => setHasTelemedicineExperience(true)} />
                            <Pill label="No" selected={hasTelemedicineExperience === false} onClick={() => setHasTelemedicineExperience(false)} />
                          </div>
                        </div>
                      </Section>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-5">
                      <Section title="Citizenship">
                        <div className="flex gap-2">
                          <Pill label="South African" selected={citizenship === 'south_african'} onClick={() => setCitizenship('south_african')} />
                          <Pill label="Non-South African" selected={citizenship === 'non_south_african'} onClick={() => setCitizenship('non_south_african')} />
                        </div>

                        {citizenship === 'south_african' ? (
                          <div className="mt-4">
                            <MiniField label="SA ID number (13 digits)">
                              <input value={saIdNumber} onChange={(e) => setSaIdNumber(e.target.value)} className={inputCls} placeholder="#########...." />
                            </MiniField>
                          </div>
                        ) : null}

                        {citizenship === 'non_south_african' ? (
                          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <MiniField label="Passport number">
                              <input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} className={inputCls} />
                            </MiniField>
                            <MiniField label="Country of citizenship">
                              <input value={citizenshipCountry} onChange={(e) => setCitizenshipCountry(e.target.value)} className={inputCls} />
                            </MiniField>
                            <MiniField label="Issuing authority">
                              <input value={passportIssuingAuthority} onChange={(e) => setPassportIssuingAuthority(e.target.value)} className={inputCls} />
                            </MiniField>
                            <MiniField label="Expiry date">
                              <input value={passportExpiry} onChange={(e) => setPassportExpiry(e.target.value)} className={inputCls} type="date" />
                            </MiniField>
                          </div>
                        ) : null}
                      </Section>

                      <Section title="HPCSA Registration">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <MiniField label="HPCSA practice number">
                            <input value={hpcsaPracticeNumber} onChange={(e) => setHpcsaPracticeNumber(e.target.value)} className={inputCls} />
                          </MiniField>

                          <MiniField label="Next renewal date">
                            <input value={nextRenewalDate} onChange={(e) => setNextRenewalDate(e.target.value)} className={inputCls} type="date" />
                          </MiniField>
                        </div>

                        <div className="mt-4">
                          <div className="text-xs font-black text-slate-700">Upload HPCSA certificate (optional now, recommended)</div>
                          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <FileUp className="h-4 w-4 text-slate-500" />
                              <span className="font-semibold">{hpcsaDocFile ? hpcsaDocFile.name : 'Choose a file'}</span>
                            </div>
                            <label className="cursor-pointer rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-slate-800">
                              Browse
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => setHpcsaDocFile(e.target.files?.[0] ?? null)}
                                accept=".pdf,image/*"
                              />
                            </label>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500">
                            This document helps admins verify you faster. If you skip it now, you can upload later.
                          </div>
                        </div>
                      </Section>

                      <Section title="Insurance">
                        {platformCover ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                            <div className="font-extrabold">Platform-wide cover is enabled</div>
                            <div className="mt-1 text-[12px] text-emerald-900/80">
                              Your consultations are covered under the platform policy (details may be reviewed on your profile after certification).
                            </div>
                            <ul className="mt-2 list-disc pl-5 text-[12px] text-emerald-900/80">
                              <li>Insurer: {insuranceSettings?.platformInsurerName || 'TBC'}</li>
                              <li>Policy: {insuranceSettings?.platformPolicyNumber || 'TBC'}</li>
                              <li>Virtual consults: {insuranceSettings?.platformCoversVirtual ? 'Included' : 'Check policy details'}</li>
                            </ul>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs font-black text-slate-700">Do you have your own cover?</div>
                            <div className="mt-2 flex gap-2">
                              <Pill label="Yes" selected={hasInsurance === true} onClick={() => setHasInsurance(true)} />
                              <Pill label="No" selected={hasInsurance === false} onClick={() => setHasInsurance(false)} />
                            </div>

                            {hasInsurance ? (
                              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <MiniField label="Insurer name">
                                  <input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} className={inputCls} />
                                </MiniField>
                                <MiniField label="Insurance type">
                                  <input value={insuranceType} onChange={(e) => setInsuranceType(e.target.value)} className={inputCls} />
                                </MiniField>

                                <div className="sm:col-span-2">
                                  <div className="text-xs font-black text-slate-700">Covers virtual consultations?</div>
                                  <div className="mt-2 flex gap-2">
                                    <Pill label="Yes" selected={insuranceCoversVirtual === 'yes'} onClick={() => setInsuranceCoversVirtual('yes')} />
                                    <Pill label="No" selected={insuranceCoversVirtual === 'no'} onClick={() => setInsuranceCoversVirtual('no')} />
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </Section>

                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <label className="flex items-start gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                          <span>
                            I agree to Ambulant+ terms of use and privacy policy <span className="font-extrabold">*</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-5">
                      <Section title="Training preference (mandatory)">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <MiniField label="Mode">
                            <select
                              value={training.mode}
                              onChange={(e) => setTraining((t) => ({ ...t, mode: e.target.value as any }))}
                              className={selectCls}
                            >
                              <option value="virtual">Virtual</option>
                              <option value="in_person">In-person</option>
                            </select>
                          </MiniField>

                          <MiniField label="City (for in-person)">
                            <input
                              value={training.city || ''}
                              onChange={(e) => setTraining((t) => ({ ...t, city: e.target.value }))}
                              className={inputCls}
                              placeholder="Johannesburg"
                            />
                          </MiniField>

                          <MiniField label="Preferred date *">
                            <input
                              value={training.preferredDate || ''}
                              onChange={(e) => setTraining((t) => ({ ...t, preferredDate: e.target.value }))}
                              className={inputCls}
                              type="date"
                              required
                            />
                          </MiniField>

                          <MiniField label="Preferred slot">
                            <select
                              value={training.preferredSlot || 'morning'}
                              onChange={(e) => setTraining((t) => ({ ...t, preferredSlot: e.target.value as any }))}
                              className={selectCls}
                            >
                              {TRAINING_SLOTS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </MiniField>
                        </div>

                        <div className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] text-indigo-900">
                          After you submit, you’ll be taken to <span className="font-extrabold">training scheduling + payment</span>.
                          Once payment is confirmed, your starter kit is dispatched.
                        </div>
                      </Section>

                      <Section title="Starter kit shipping details (used after payment)">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <MiniField label="Recipient name *">
                            <input
                              value={shipping.recipientName}
                              onChange={(e) => setShipping((s) => ({ ...s, recipientName: e.target.value }))}
                              className={inputCls}
                              placeholder="Dr. Jane Doe"
                              required
                            />
                          </MiniField>
                          <MiniField label="Phone *">
                            <input
                              value={shipping.phone}
                              onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                              className={inputCls}
                              placeholder="+27..."
                              required
                            />
                          </MiniField>

                          <MiniField label="Address line 1 *" className="sm:col-span-2">
                            <input
                              value={shipping.addressLine1}
                              onChange={(e) => setShipping((s) => ({ ...s, addressLine1: e.target.value }))}
                              className={inputCls}
                              placeholder="Street / complex / number"
                              required
                            />
                          </MiniField>

                          <MiniField label="Address line 2" className="sm:col-span-2">
                            <input
                              value={shipping.addressLine2 || ''}
                              onChange={(e) => setShipping((s) => ({ ...s, addressLine2: e.target.value }))}
                              className={inputCls}
                              placeholder="Suite / floor (optional)"
                            />
                          </MiniField>

                          <MiniField label="City *">
                            <input value={shipping.city} onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))} className={inputCls} required />
                          </MiniField>

                          <MiniField label="Province">
                            <input value={shipping.province || ''} onChange={(e) => setShipping((s) => ({ ...s, province: e.target.value }))} className={inputCls} />
                          </MiniField>

                          <MiniField label="Postal code">
                            <input value={shipping.postalCode || ''} onChange={(e) => setShipping((s) => ({ ...s, postalCode: e.target.value }))} className={inputCls} />
                          </MiniField>

                          <MiniField label="Country">
                            <input value={shipping.country || 'South Africa'} onChange={(e) => setShipping((s) => ({ ...s, country: e.target.value }))} className={inputCls} />
                          </MiniField>
                        </div>

                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[12px] text-slate-700">
                          <div className="font-extrabold">Starter kit contents (sent after payment)</div>
                          <ul className="mt-2 list-disc pl-5 text-slate-600">
                            <li>All four IoMTs</li>
                            <li>Clinician Handbook + consumables</li>
                            <li>Merch: branded formal shirts (black &amp; white), mug, thermo bottle</li>
                            <li>Smart ID with card holder + lanyard</li>
                          </ul>
                          <div className="mt-2 text-slate-500">
                            Tracking is added by admin (courier + tracking number + URL) and auto-sent to you by email + SMS.
                          </div>
                        </div>
                      </Section>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep((s) => (s > 0 ? ((s - 1) as any) : s))}
                      className={cx(
                        'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800',
                        step === 0 && 'opacity-50 pointer-events-none',
                      )}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>

                    <div className="flex gap-2">
                      {step < 3 ? (
                        <button
                          type="button"
                          onClick={() => setStep((s) => (s < 3 ? ((s + 1) as any) : s))}
                          disabled={!canGoNext}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-indigo-700',
                            !canGoNext && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          Next
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={loading}
                          className={cx(
                            'inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700',
                            loading && 'opacity-60 cursor-not-allowed',
                          )}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Submitting…
                            </>
                          ) : (
                            <>
                              Submit application
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 text-center text-[11px] text-slate-500">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="font-bold text-slate-800 hover:underline">
                      Sign in
                    </Link>
                  </div>
                </form>
              </Card>

              <div className="mt-4 text-center text-[11px] text-slate-500">
                By applying you agree to your clinic’s terms and privacy policy.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ---------------- UI bits (local) ---------------- */

const inputCls =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300';

const selectCls =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300';

const textareaCls =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
      {children}
    </div>
  );
}

function InfoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-[12px] text-slate-600">{desc}</div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const items = [
    { label: 'Account', icon: <User className="h-4 w-4" /> },
    { label: 'Professional', icon: <Stethoscope className="h-4 w-4" /> },
    { label: 'Compliance', icon: <ShieldCheck className="h-4 w-4" /> },
    { label: 'Training', icon: <CalendarDays className="h-4 w-4" /> },
  ];
  return (
    <div className="mt-5 grid grid-cols-4 gap-2">
      {items.map((it, idx) => {
        const active = idx === step;
        const done = idx < step;
        return (
          <div
            key={it.label}
            className={cx(
              'flex items-center justify-center gap-2 rounded-2xl border px-2 py-2 text-[11px] font-extrabold',
              done
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : active
                ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                : 'border-slate-200 bg-white text-slate-500',
            )}
          >
            {done ? <CheckCircle2 className="h-4 w-4" /> : it.icon}
            <span className="hidden sm:inline">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-black text-slate-900">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  icon,
  right,
  className,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cx('block', className)}>
      <div className="text-xs font-black text-slate-700">{label}</div>
      <div className="mt-1 relative">
        {icon ? <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div> : null}
        {right ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div> : null}
        <div className={cx(icon ? 'pl-7' : '', right ? 'pr-10' : '')}>{children}</div>
      </div>
    </label>
  );
}

function MiniField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cx('block', className)}>
      <div className="text-[11px] font-black text-slate-600">{label}</div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1.5 text-xs font-extrabold transition',
        selected ? 'border-indigo-200 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}
