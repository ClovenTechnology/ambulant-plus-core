// file: apps/clinician-app/app/auth/signup/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus } from 'react-icons/fi';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';

type InsuranceSettings = {
  platformCoverEnabled?: boolean;
  platformInsurerName?: string;
  platformPolicyNumber?: string;
  platformCoversVirtual?: boolean;
};

type Qualification = { degree: string; institution: string; yearOfCompletion?: string };
type OtherQualification = { award: string; institution: string; yearOfCompletion?: string };

export default function ClinicianSignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [address, setAddress] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [license, setLicense] = useState('');
  const [qualifications, setQualifications] = useState<Qualification[]>([
    { degree: '', institution: '', yearOfCompletion: '' },
  ]);
  const [otherQualifications, setOtherQualifications] = useState<OtherQualification[]>([
    { award: '', institution: '', yearOfCompletion: '' },
  ]);
  const [citizenship, setCitizenship] = useState<'south_african' | 'non_south_african' | ''>('');
  const [saIdNumber, setSaIdNumber] = useState('');
  const [citizenshipCountry, setCitizenshipCountry] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportIssuingAuthority, setPassportIssuingAuthority] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [hpcsaPracticeNumber, setHpcsaPracticeNumber] = useState('');
  const [hpcsaDocFile, setHpcsaDocFile] = useState<File | null>(null);
  const [hpcsaDocBase64, setHpcsaDocBase64] = useState<string | null>(null);
  const [nextRenewalDate, setNextRenewalDate] = useState('');
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [insurerName, setInsurerName] = useState('');
  const [insuranceType, setInsuranceType] = useState('');
  const [insuranceCoversVirtual, setInsuranceCoversVirtual] = useState<'yes' | 'no' | ''>('');
  const [preferredCommunication, setPreferredCommunication] = useState<string[]>([]);
  const [primaryLanguage, setPrimaryLanguage] = useState('');
  const [otherLanguages, setOtherLanguages] = useState('');
  const [hasTelemedicineExperience, setHasTelemedicineExperience] = useState<boolean | null>(null);
  const [auth0UserId, setAuth0UserId] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  const [insuranceSettings, setInsuranceSettings] = useState<InsuranceSettings | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!GATEWAY) return;
        const res = await fetch(`${GATEWAY}/api/settings/insurance`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        setInsuranceSettings(json);
      } catch {
        // ignore – default is "no platform cover"
      }
    })();
  }, []);

  // --- Handlers ---
  const updateQualification = (idx: number, patch: Partial<Qualification>) => {
    setQualifications((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const addQualification = () =>
    setQualifications((prev) => [...prev, { degree: '', institution: '', yearOfCompletion: '' }]);
  const removeQualification = (idx: number) =>
    setQualifications((prev) => prev.filter((_, i) => i !== idx));

  const updateOtherQualification = (idx: number, patch: Partial<OtherQualification>) => {
    setOtherQualifications((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };
  const addOtherQualification = () =>
    setOtherQualifications((prev) => [...prev, { award: '', institution: '', yearOfCompletion: '' }]);
  const removeOtherQualification = (idx: number) =>
    setOtherQualifications((prev) => prev.filter((_, i) => i !== idx));

  const togglePreferredCommunication = (value: string) => {
    setPreferredCommunication((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onHpcsaFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setHpcsaDocFile(f);
    if (f) {
      try {
        setHpcsaDocBase64(await fileToBase64(f));
      } catch {
        setHpcsaDocBase64(null);
      }
    } else {
      setHpcsaDocBase64(null);
    }
  };

  const validateSaId = (id: string) => /^\d{13}$/.test(id);

  const validateForm = () => {
    if (!name.trim()) return 'Full Name required';
    if (!email.trim()) return 'Email required';
    if (!password) return 'Password required';
    if (!specialty.trim()) return 'Specialty required';
    if (citizenship === 'south_african' && !validateSaId(saIdNumber)) return 'SA ID number must be 13 digits';
    if (citizenship === 'non_south_african' && !passportNumber.trim()) return 'Passport number required';

    const platformCover = insuranceSettings?.platformCoverEnabled === true;

    if (!platformCover) {
      // only enforce insurer if there is no platform-wide cover
      if (hasInsurance === true && !insurerName.trim()) return 'Insurer name required';
    }

    if (!consent) return 'You must agree to terms and privacy policy';
    if (hpcsaDocFile && !hpcsaDocBase64) return 'HPCSA document processing failed';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const validationError = validateForm();
    if (validationError) {
      setMsg(`Error: ${validationError}`);
      return;
    }

    setLoading(true);
    try {
      const platformCover = insuranceSettings?.platformCoverEnabled === true;

      const payload: any = {
        role: 'clinician',
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        specialty: specialty.trim(),
        license: license.trim() || undefined,
        profile: {
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
          passportIssuingAuthority:
            citizenship === 'non_south_african' ? passportIssuingAuthority.trim() : undefined,
          passportExpiry: citizenship === 'non_south_african' ? passportExpiry || undefined : undefined,
          hpcsaPracticeNumber: hpcsaPracticeNumber.trim() || undefined,
          hpcsaDoc: hpcsaDocBase64 || undefined,
          hpcsaNextRenewalDate: nextRenewalDate || undefined,

          // If platform cover is enabled, don't force individual insurer capture
          hasInsurance: platformCover ? undefined : typeof hasInsurance === 'boolean' ? hasInsurance : undefined,
          insurerName: platformCover ? undefined : hasInsurance ? insurerName.trim() : undefined,
          insuranceType: platformCover ? undefined : hasInsurance ? insuranceType.trim() : undefined,
          insuranceCoversVirtual:
            platformCover ? undefined : hasInsurance ? insuranceCoversVirtual === 'yes' : undefined,

          preferredCommunication,
          primaryLanguage: primaryLanguage.trim() || undefined,
          otherLanguages: otherLanguages.split(',').map((s) => s.trim()).filter(Boolean),
          hasTelemedicineExperience:
            typeof hasTelemedicineExperience === 'boolean' ? hasTelemedicineExperience : undefined,
          auth0UserId: auth0UserId || undefined,
        },
      };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) setMsg(`Error: ${data.error || data.message || 'signup failed'}`);
      else router.push('/clinician/onboard');
    } catch (err: any) {
      setMsg(`Error: ${err?.message ?? 'network error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Clinician Signup</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Clinician Bio */}
        <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
          <legend className="font-semibold text-lg">Clinician Bio</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full Name *" value={name} onChange={setName} />
            <Input label="Email *" value={email} onChange={setEmail} type="email" />
            <Input label="Password *" value={password} onChange={setPassword} type="password" />
            <Input label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="+27..." />
            <Input label="Date of Birth" value={dob} onChange={setDob} type="date" />
            <Select
              label="Gender"
              value={gender}
              onChange={setGender}
              options={[
                { label: 'Select', value: '' },
                { label: 'Female', value: 'female' },
                { label: 'Male', value: 'male' },
                { label: 'Other', value: 'other' },
              ]}
            />
            <Input label="Specialty *" value={specialty} onChange={setSpecialty} className="md:col-span-2" />
            <Textarea label="Address" value={address} onChange={setAddress} className="md:col-span-2" />
            <Input
              label="License / Reg. Number (Optional)"
              value={license}
              onChange={setLicense}
              className="md:col-span-2"
            />
          </div>
        </fieldset>

        {/* Education & Qualifications */}
        <QualificationsSection
          qualifications={qualifications}
          otherQualifications={otherQualifications}
          updateQualification={updateQualification}
          addQualification={addQualification}
          removeQualification={removeQualification}
          updateOtherQualification={updateOtherQualification}
          addOtherQualification={addOtherQualification}
          removeOtherQualification={removeOtherQualification}
        />

        {/* Citizenship */}
        <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
          <legend className="font-semibold text-lg">Citizenship</legend>
          <div className="flex gap-4">
            <Toggle
              label="South African"
              selected={citizenship === 'south_african'}
              onClick={() => setCitizenship('south_african')}
            />
            <Toggle
              label="Non-South African"
              selected={citizenship === 'non_south_african'}
              onClick={() => setCitizenship('non_south_african')}
            />
          </div>
          {citizenship === 'south_african' && (
            <Input label="SA ID Number" value={saIdNumber} onChange={setSaIdNumber} />
          )}
          {citizenship === 'non_south_african' && (
            <>
              <Input label="Passport Number" value={passportNumber} onChange={setPassportNumber} />
              <Input label="Issuing Authority" value={passportIssuingAuthority} onChange={setPassportIssuingAuthority} />
              <Input label="Expiry Date" value={passportExpiry} onChange={setPassportExpiry} type="date" />
              <Input label="Country of Citizenship" value={citizenshipCountry} onChange={setCitizenshipCountry} />
            </>
          )}
        </fieldset>

        {/* HPCSA Registration */}
        <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
          <legend className="font-semibold text-lg">HPCSA Registration</legend>
          <Input label="HPCSA Practice Number" value={hpcsaPracticeNumber} onChange={setHpcsaPracticeNumber} />
          <div>
            <label className="block font-medium mb-1">Upload HPCSA Certificate</label>
            <input type="file" onChange={onHpcsaFileChange} className="border p-2 rounded w-full" />
            {hpcsaDocFile && <p className="text-sm text-gray-600 mt-1">{hpcsaDocFile.name}</p>}
          </div>
          <Input label="Next Renewal Date" value={nextRenewalDate} onChange={setNextRenewalDate} type="date" />
        </fieldset>

        {/* Insurance */}
        {!insuranceSettings?.platformCoverEnabled && (
          <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
            <legend className="font-semibold text-lg">Insurance</legend>
            <div className="flex gap-4">
              <Toggle label="Yes" selected={hasInsurance === true} onClick={() => setHasInsurance(true)} />
              <Toggle label="No" selected={hasInsurance === false} onClick={() => setHasInsurance(false)} />
            </div>
            {hasInsurance && (
              <>
                <Input label="Insurer Name" value={insurerName} onChange={setInsurerName} />
                <Input label="Insurance Type" value={insuranceType} onChange={setInsuranceType} />
                <div className="flex gap-4">
                  <Toggle
                    label="Covers Virtual Consults"
                    selected={insuranceCoversVirtual === 'yes'}
                    onClick={() => setInsuranceCoversVirtual('yes')}
                  />
                  <Toggle
                    label="Does Not Cover Virtual"
                    selected={insuranceCoversVirtual === 'no'}
                    onClick={() => setInsuranceCoversVirtual('no')}
                  />
                </div>
              </>
            )}
          </fieldset>
        )}

        {insuranceSettings?.platformCoverEnabled && (
          <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-2 text-sm">
            <legend className="font-semibold text-lg">Insurance</legend>
            <p className="text-gray-700">
              Ambulant+ currently provides <strong>platform-wide malpractice cover.</strong> Your consultations are
              covered under the platform policy:
            </p>
            <ul className="text-xs text-gray-600 list-disc ml-5">
              <li>Insurer: {insuranceSettings.platformInsurerName || 'TBC'}</li>
              <li>Policy: {insuranceSettings.platformPolicyNumber || 'TBC'}</li>
              <li>Virtual consults: {insuranceSettings.platformCoversVirtual ? 'Included' : 'Check policy details'}</li>
            </ul>
          </fieldset>
        )}

        {/* Preferred Communication */}
        <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
          <legend className="font-semibold text-lg">Preferred Communication</legend>
          {['Email', 'Phone', 'SMS', 'WhatsApp'].map((mode) => (
            <Pill
              key={mode}
              label={mode}
              selected={preferredCommunication.includes(mode)}
              onClick={() => togglePreferredCommunication(mode)}
            />
          ))}
          <Input label="Primary Language" value={primaryLanguage} onChange={setPrimaryLanguage} />
          <Input label="Other Languages (comma separated)" value={otherLanguages} onChange={setOtherLanguages} />
        </fieldset>

        {/* Telemedicine Experience */}
        <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
          <legend className="font-semibold text-lg">Telemedicine Experience</legend>
          <div className="flex gap-4">
            <Toggle label="Yes" selected={hasTelemedicineExperience === true} onClick={() => setHasTelemedicineExperience(true)} />
            <Toggle label="No" selected={hasTelemedicineExperience === false} onClick={() => setHasTelemedicineExperience(false)} />
          </div>
        </fieldset>

        {/* Consent */}
        <fieldset className="border p-6 rounded-lg shadow-sm bg-white flex items-center gap-2">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <label>I agree to Ambulant+ terms of use and privacy policy *</label>
        </fieldset>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg transition"
            disabled={loading}
          >
            {loading ? 'Submitting…' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="px-6 py-3 rounded-lg border hover:bg-gray-100 transition"
          >
            Already have an account
          </button>
        </div>

        {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}
      </form>

      {/* Submission Modal */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <p className="font-semibold mb-2">SUBMITTING…</p>
              <p>Hang on tight. Your Ambulant+ application is being submitted and processed. Your journey is about to begin.</p>
              <p className="mt-2 text-sm text-gray-600">You will receive Email and SMS confirmation with next steps. Good luck!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// --- Reusable Components ---
function Input({ label, value, onChange, type = 'text', placeholder = '', className = '' }: any) {
  return (
    <div className={className}>
      <label className="block font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border p-2 rounded w-full"
      />
    </div>
  );
}
function Textarea({ label, value, onChange, className = '' }: any) {
  return (
    <div className={className}>
      <label className="block font-medium mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="border p-2 rounded w-full" rows={3} />
    </div>
  );
}
function Select({ label, value, onChange, options, className = '' }: any) {
  return (
    <div className={className}>
      <label className="block font-medium mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border p-2 rounded w-full">
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function Toggle({ label, selected, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg border transition ${
        selected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}
function Pill({ label, selected, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full border transition ${
        selected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );
}
function QualificationsSection(props: any) {
  const {
    qualifications,
    otherQualifications,
    updateQualification,
    addQualification,
    removeQualification,
    updateOtherQualification,
    addOtherQualification,
    removeOtherQualification,
  } = props;

  return (
    <fieldset className="border p-6 rounded-lg shadow-sm bg-white space-y-4">
      <legend className="font-semibold text-lg">Education & Qualifications</legend>

      {/* Standard Qualifications */}
      <div className="space-y-3">
        {qualifications.map((q: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <Input label="Degree" value={q.degree} onChange={(v: any) => updateQualification(idx, { degree: v })} />
            <Input
              label="Institution"
              value={q.institution}
              onChange={(v: any) => updateQualification(idx, { institution: v })}
            />
            <div className="flex gap-2">
              <Input label="Year" value={q.yearOfCompletion} onChange={(v: any) => updateQualification(idx, { yearOfCompletion: v })} />
              <button type="button" onClick={() => removeQualification(idx)} className="text-red-600 font-bold text-xl">
                ×
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addQualification} className="flex items-center gap-1 text-indigo-600 font-medium">
          <FiPlus /> Add Qualification
        </button>
      </div>

      {/* Other Qualifications */}
      <div className="space-y-3 mt-4">
        <h3 className="font-medium text-gray-700">Other Awards</h3>
        {otherQualifications.map((q: any, idx: number) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <Input label="Award" value={q.award} onChange={(v: any) => updateOtherQualification(idx, { award: v })} />
            <Input
              label="Institution"
              value={q.institution}
              onChange={(v: any) => updateOtherQualification(idx, { institution: v })}
            />
            <div className="flex gap-2">
              <Input label="Year" value={q.yearOfCompletion} onChange={(v: any) => updateOtherQualification(idx, { yearOfCompletion: v })} />
              <button type="button" onClick={() => removeOtherQualification(idx)} className="text-red-600 font-bold text-xl">
                ×
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addOtherQualification} className="flex items-center gap-1 text-indigo-600 font-medium">
          <FiPlus /> Add Other Award
        </button>
      </div>
    </fieldset>
  );
}
