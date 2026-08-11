// apps/clinician-app/app/auth/signup/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
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

type SignupPresentation = {
  heroHeading: string;
  heroIntroduction: string;
  noticeHeading: string;
  noticeBody: string;
  noticeSecondary: string;
  noticeCtaLabel: string;
  noticeCtaHref: string;
  optionalKitTitle: string;
  optionalKitDescription: string;
  successHeading: string;
  successBody: string;
  successSecondary: string;
  successCtaLabel: string;
};

const DEFAULT_SIGNUP_PRESENTATION: SignupPresentation = {
  heroHeading: 'Join the Contactless Care Network',
  heroIntroduction:
    'Complete your application and required training. Once verified, trained and approved, your profile can go live and you can start consulting on Ambulant+. No upfront onboarding payment is required.',
  noticeHeading: 'Start now - no mandatory upfront payment',
  noticeBody:
    'Training is required, but payment is not. Complete your Ambulant+ training and, once your credentials are verified and your profile is approved, you can start consulting and earning on Ambulant+ without purchasing a C-Med Kit.',
  noticeSecondary:
    'The Contactless Medicine Kit (C-Med Kit) is optional. If you choose one, clinicians receive discounted pricing with flexible payment options and tracked delivery.',
  noticeCtaLabel: 'View C-Med Kit & payment options',
  noticeCtaHref: '/clinicians/c-med-options',
  optionalKitTitle: 'Optional C-Med Kit',
  optionalKitDescription:
    "Add a discounted C-Med Kit if you want one, with flexible payment options and tracked delivery. Qualifying C-Med options also include access to Ambulant+'s platform-wide Professional Indemnity / Medical Malpractice cover, subject to eligibility and policy terms.",
  successHeading: 'Application submitted successfully',
  successBody:
    'Your Ambulant+ clinician account has been created. Sign in to choose an available Ambulant+ training programme and complete your onboarding.',
  successSecondary:
    'No upfront onboarding payment is required to continue. You can choose a discounted C-Med Kit with flexible payment options during the next step.',
  successCtaLabel: 'Sign in & continue to training',
};

type Qualification = { degree: string; institution: string; yearOfCompletion?: string };
type OtherQualification = { award: string; institution: string; yearOfCompletion?: string };


type SignupResponse = {
  ok?: boolean;
  clinician?: any;
  clinicianId?: string;
  error?: string;
  message?: string;
  redirectTo?: string;
  trainingLink?: string;
};

type ValidationFailure = {
  step: 0 | 1 | 2;
  message: string;
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

const PHONE_COUNTRY_CODES = [
  { code: '+27', label: 'South Africa +27' },
  { code: '+234', label: 'Nigeria +234' },
  { code: '+44', label: 'United Kingdom +44' },
  { code: '+1', label: 'US/Canada +1' },
  { code: '+91', label: 'India +91' },
  { code: '+263', label: 'Zimbabwe +263' },
  { code: '+266', label: 'Lesotho +266' },
  { code: '+268', label: 'Eswatini +268' },
  { code: '+264', label: 'Namibia +264' },
  { code: '+267', label: 'Botswana +267' },
] as const;


const CLINICAL_SPECIALTIES = [
  { key: 'general-practice', label: 'General Practice', professionKey: 'gp' },
  { key: 'cardiology', label: 'Cardiology', professionKey: 'specialist' },
  { key: 'dental', label: 'Dental', professionKey: 'dentist' },
  { key: 'dermatology', label: 'Dermatology', professionKey: 'specialist' },
  { key: 'endocrinology', label: 'Endocrinology', professionKey: 'specialist' },
  { key: 'ent', label: 'ENT', professionKey: 'specialist' },
  { key: 'fertility', label: 'Fertility', professionKey: 'specialist' },
  { key: 'neurology', label: 'Neurology', professionKey: 'specialist' },
  { key: 'obgyn', label: 'Obstetrics & Gynaecology', professionKey: 'specialist' },
  { key: 'oncology', label: 'Oncology', professionKey: 'specialist' },
  { key: 'optometry', label: 'Optometry', professionKey: 'optometrist' },
  { key: 'paediatric', label: 'Paediatric Care', professionKey: 'specialist' },
  { key: 'physio', label: 'Physiotherapy', professionKey: 'physiotherapist' },
  { key: 'psychiatry', label: 'Psychiatry', professionKey: 'specialist' },
  { key: 'psychology', label: 'Psychology', professionKey: 'psychologist' },
  { key: 'radiology', label: 'Radiology', professionKey: 'specialist' },
  { key: 'speech-therapy', label: 'Speech Therapy', professionKey: 'speech_therapist' },
  { key: 'surgery', label: 'Surgery', professionKey: 'specialist' },
  { key: 'urology', label: 'Urology', professionKey: 'specialist' },
] as const;

const ZA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
] as const;

const LANGUAGE_OPTIONS = [
  'Afrikaans',
  'English',
  'isiNdebele',
  'isiXhosa',
  'isiZulu',
  'Sepedi',
  'Sesotho',
  'Setswana',
  'siSwati',
  'Tshivenda',
  'XiTsonga',
  'South African Sign Language',
  'Arabic',
  'Chinese',
  'French',
  'German',
  'Hindi',
  'Italian',
  'Portuguese',
  'Spanish',
  'Swahili',
  'Yoruba',
] as const;

const CURRENT_YEAR = new Date().getFullYear();

function digitsOnly(v: string) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeSpaces(v: string) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(v: string) {
  return String(v || '').trim().toLowerCase();
}

function emailLooksValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(v));
}

function passwordLooksStrong(v: string) {
  return String(v || '').length >= 8 && !/\s/.test(String(v || ''));
}

function composePhone(countryCode: string, local: string) {
  const cc = String(countryCode || '+27').trim();
  const raw = String(local || '').trim();

  if (raw.startsWith('+')) return `+${digitsOnly(raw)}`;

  const localDigits = digitsOnly(raw).replace(/^0+/, '');
  if (!localDigits) return '';

  return `${cc}${localDigits}`;
}

function phoneLooksValid(value: string) {
  const normalized = String(value || '').trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return false;

  // South Africa: +27 followed by 9 national digits.
  if (normalized.startsWith('+27')) {
    return /^\+27\d{9}$/.test(normalized);
  }

  return true;
}

function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function ageOnToday(value: string) {
  const d = parseDateInput(value);
  if (!d) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age -= 1;
  }

  return age;
}

function isPastOrToday(value: string) {
  const d = parseDateInput(value);
  if (!d) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() <= today.getTime();
}

function isTodayOrFuture(value: string) {
  const d = parseDateInput(value);
  if (!d) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

function isFutureDate(value: string) {
  const d = parseDateInput(value);
  if (!d) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
}

function qualificationYearLooksValid(year: string) {
  const y = Number(String(year || '').trim());
  return Number.isInteger(y) && y >= 1940 && y <= CURRENT_YEAR - 1;
}

function hpcsaRegistrationLooksValid(value: string) {
  const v = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return /^MP\d{6,8}$/.test(v);
}

function practiceNumberLooksValid(value: string) {
  return digitsOnly(value).length > 0;
}

function passportNumberLooksValid(value: string) {
  return /^[A-Z0-9]{5,20}$/i.test(String(value || '').trim().replace(/\s+/g, ''));
}

function luhnLooksValid(value: string) {
  const digits = digitsOnly(value);
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);

    if (shouldDouble) {
      n *= 2;
      if (n > 9) n -= 9;
    }

    sum += n;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function validateSaIdDetailed(id: string, dob: string, gender: string): string | null {
  const v = digitsOnly(id);

  if (!/^\d{13}$/.test(v)) return 'SA ID number must contain exactly 13 digits.';

  const dobDate = parseDateInput(dob);
  if (!dobDate) return 'Date of birth is required before SA ID can be verified.';

  const yyMMdd = `${String(dobDate.getFullYear()).slice(-2)}${String(dobDate.getMonth() + 1).padStart(2, '0')}${String(
    dobDate.getDate(),
  ).padStart(2, '0')}`;

  if (v.slice(0, 6) !== yyMMdd) {
    return 'SA ID first 6 digits must match the selected date of birth.';
  }

  const serial = Number(v.slice(6, 10));

  if (gender === 'female' && serial >= 5000) {
    return 'SA ID gender block indicates male, but Female was selected.';
  }

  if (gender === 'male' && serial < 5000) {
    return 'SA ID gender block indicates female, but Male was selected.';
  }

  const citizenshipDigit = v[10];
  if (!['0', '1'].includes(citizenshipDigit)) {
    return 'SA ID citizenship digit must be 0 or 1.';
  }

  if (!luhnLooksValid(v)) {
    return 'SA ID checksum failed. Please check the number.';
  }

  return null;
}


export default function ClinicianSignupPage() {
  // Basic identity
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+27');

  // Professional
  const [specialty, setSpecialty] = useState('');
  const [license, setLicense] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [practiceAddressLine1, setPracticeAddressLine1] = useState('');
  const [practiceAddressLine2, setPracticeAddressLine2] = useState('');
  const [practiceSuburbTown, setPracticeSuburbTown] = useState('');
  const [practiceCity, setPracticeCity] = useState('');
  const [practiceProvince, setPracticeProvince] = useState('Gauteng');
  const [practicePostalCode, setPracticePostalCode] = useState('');
  const [practiceCountry, setPracticeCountry] = useState('South Africa');

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
  const [practiceNumber, setPracticeNumber] = useState('');
  const [bhfPcnsRenewalDate, setBhfPcnsRenewalDate] = useState('');
  const [bhfPcnsDocFile, setBhfPcnsDocFile] = useState<File | null>(null);
  const [hpcsaDocFile, setHpcsaDocFile] = useState<File | null>(null);
  const [nextRenewalDate, setNextRenewalDate] = useState('');

  // Insurance
  const [insuranceSettings, setInsuranceSettings] = useState<InsuranceSettings | null>(null);
  const platformCover = insuranceSettings?.platformCoverEnabled === true;

  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [insurerName, setInsurerName] = useState('');
  const [insuranceType, setInsuranceType] = useState('');
  const [insurancePolicyName, setInsurancePolicyName] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceRenewalDate, setInsuranceRenewalDate] = useState('');
  const [insuranceCoversVirtual, setInsuranceCoversVirtual] = useState<'yes' | 'no' | ''>('');

  // Communication / languages
  const [preferredCommunication, setPreferredCommunication] = useState<string[]>([]);
  const [primaryLanguage, setPrimaryLanguage] = useState('');
  const [otherLanguages, setOtherLanguages] = useState<string[]>([]);
  const [hasTelemedicineExperience, setHasTelemedicineExperience] = useState<boolean | null>(null);


  // UX state
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [signupPresentation, setSignupPresentation] = useState<SignupPresentation>(DEFAULT_SIGNUP_PRESENTATION);

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

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/training/public-options', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        const incoming = payload?.offer?.signupPresentation;
        if (response.ok && payload?.ok && incoming && typeof incoming === 'object') {
          setSignupPresentation({
            ...DEFAULT_SIGNUP_PRESENTATION,
            ...incoming,
          });
        }
      } catch {
        // The approved defaults remain visible if commercial presentation is temporarily unavailable.
      }
    })();
  }, []);

  const togglePreferredCommunication = (value: string) => {
    setPreferredCommunication((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };


  const passwordQuality = useMemo(() => {
    const value = pw || '';
    const checks = {
      len8: value.length >= 8,
      lower: /[a-z]/.test(value),
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value),
      noSpaces: !/\s/.test(value),
    };

    const score = [
      checks.len8,
      checks.lower,
      checks.upper,
      checks.number,
      checks.symbol,
      checks.noSpaces,
    ].filter(Boolean).length;

    return { checks, score };
  }, [pw]);

  const passwordStrengthLabel = useMemo(() => {
    if (!pw) return 'Not started';
    if (passwordQuality.score <= 2) return 'Weak';
    if (passwordQuality.score <= 4) return 'Fair';
    if (passwordQuality.score === 5) return 'Good';
    return 'Strong';
  }, [passwordQuality.score, pw]);

  const normalizedPhone = useMemo(() => composePhone(phoneCountryCode, phone), [phoneCountryCode, phone]);

  const primaryQualification = useMemo(() => {
    return qualifications.find((q) => q.degree.trim() || q.institution.trim() || String(q.yearOfCompletion || '').trim()) || qualifications[0];
  }, [qualifications]);

  const saIdValidationMessage = useMemo(() => {
    if (citizenship !== 'south_african' || !saIdNumber.trim()) return null;
    return validateSaIdDetailed(saIdNumber, dob, gender);
  }, [citizenship, saIdNumber, dob, gender]);

  const qualificationYear = String(primaryQualification?.yearOfCompletion || '').trim();

  const stepLabel = useMemo(() => {
    return ['Account', 'Professional', 'Compliance'][step];
  }, [step]);

  const canGoNext = useMemo(() => {
    if (step === 0) {
      return (
        !!normalizeSpaces(firstName) &&
        !!normalizeSpaces(lastName) &&
        emailLooksValid(email) &&
        passwordLooksStrong(pw) &&
        !!confirmPw &&
        pw === confirmPw &&
        phoneLooksValid(normalizedPhone)
      );
    }

    if (step === 1) {
      return (
        !!specialty.trim() &&
        !!dob &&
        isPastOrToday(dob) &&
        (ageOnToday(dob) ?? 0) >= 18 &&
        !!gender &&
        !!primaryQualification?.degree?.trim() &&
        !!primaryQualification?.institution?.trim() &&
        qualificationYearLooksValid(qualificationYear) &&
        hpcsaRegistrationLooksValid(license) &&
        !!nextRenewalDate &&
        isTodayOrFuture(nextRenewalDate) &&
        !!hpcsaDocFile &&
        preferredCommunication.length > 0 &&
        !!primaryLanguage
      );
    }

    if (step === 2) {
      if (!citizenship) return false;
      if (citizenship === 'south_african' && validateSaIdDetailed(saIdNumber, dob, gender)) return false;
      if (
        citizenship === 'non_south_african' &&
        (!passportNumberLooksValid(passportNumber) ||
          !citizenshipCountry.trim() ||
          !passportIssuingAuthority.trim() ||
          !isFutureDate(passportExpiry))
      ) {
        return false;
      }
      if (practiceNumber) {
        if (!practiceNumberLooksValid(practiceNumber)) return false;
        if (!bhfPcnsRenewalDate || !isTodayOrFuture(bhfPcnsRenewalDate)) return false;
        if (!bhfPcnsDocFile) return false;
      }
      if (!platformCover && hasInsurance === null) return false;
      if (!platformCover && hasInsurance === true && (!insurerName.trim() || !insurancePolicyNumber.trim() || !insuranceRenewalDate || !insuranceCoversVirtual)) {
        return false;
      }
      return consent;
    }

    return false;
  }, [
    step,
    firstName,
    middleName,
    lastName,
    email,
    pw,
    confirmPw,
    phone,
    phoneCountryCode,
    normalizedPhone,
    specialty,
    dob,
    gender,
    primaryQualification,
    qualificationYear,
    license,
    preferredCommunication,
    primaryLanguage,
    hpcsaDocFile,
    citizenship,
    saIdNumber,
    passportNumber,
    citizenshipCountry,
    passportIssuingAuthority,
    passportExpiry,
    practiceNumber,
    bhfPcnsRenewalDate,
    bhfPcnsDocFile,
    nextRenewalDate,
    platformCover,
    hasInsurance,
    insurerName,
    insuranceType,
    insurancePolicyName,
    insurancePolicyNumber,
    insuranceRenewalDate,
    insuranceCoversVirtual,
    consent,
  ]);


  const stepBlockerHint = useMemo(() => {
    if (canGoNext) return null;

    if (step === 0) {
      if (!normalizeSpaces(firstName)) return 'Enter the clinician first name.';
      if (!normalizeSpaces(lastName)) return 'Enter the clinician last name / surname.';
      if (!emailLooksValid(email)) return 'Enter a valid email address.';
      if (!passwordLooksStrong(pw)) return 'Password must be at least 8 characters and must not contain spaces.';
      if (!confirmPw || pw !== confirmPw) return 'Confirm password must match the password.';
      if (!phoneLooksValid(normalizedPhone)) return 'Enter a valid mobile number with country code.';
    }

    if (step === 1) {
      if (!specialty.trim()) return 'Select a specialty.';
      if (!hpcsaRegistrationLooksValid(license)) return 'Enter a valid HPCSA registration number, for example MP1111111.';
      if (!nextRenewalDate || !isTodayOrFuture(nextRenewalDate)) return 'Enter a current or future HPCSA renewal date.';
      if (!hpcsaDocFile) return 'Upload the HPCSA registration certificate/document.';
      if (!dob || !isPastOrToday(dob) || (ageOnToday(dob) ?? 0) < 18) return 'Enter a valid date of birth for a clinician aged at least 18.';
      if (!gender) return 'Select gender for identity checks.';
      if (!primaryQualification?.degree?.trim()) return 'Enter the primary qualification.';
      if (!primaryQualification?.institution?.trim()) return 'Enter the qualification institution.';
      if (!qualificationYearLooksValid(qualificationYear)) return 'Enter a valid qualification year.';
      if (preferredCommunication.length === 0) return 'Select at least one communication option.';
      if (!primaryLanguage) return 'Select a primary language.';
    }

    if (step === 2) {
      if (!citizenship) return 'Select citizenship status.';
      if (citizenship === 'south_african' && validateSaIdDetailed(saIdNumber, dob, gender)) return validateSaIdDetailed(saIdNumber, dob, gender);
      if (citizenship === 'non_south_african') {
        if (!passportNumberLooksValid(passportNumber)) return 'Enter a valid passport number.';
        if (!citizenshipCountry.trim()) return 'Enter country of citizenship.';
        if (!passportIssuingAuthority.trim()) return 'Enter passport issuing authority.';
        if (!isFutureDate(passportExpiry)) return 'Enter a future passport expiry date.';
      }
      if (practiceNumber && !practiceNumberLooksValid(practiceNumber)) return 'Enter a valid BHF/PCNS practice number.';
      if (practiceNumber && (!bhfPcnsRenewalDate || !isTodayOrFuture(bhfPcnsRenewalDate))) return 'Enter the BHF/PCNS expiry or next renewal date.';
      if (practiceNumber && !bhfPcnsDocFile) return 'Upload BHF/PCNS proof for the supplied practice number.';
      if (!platformCover && hasInsurance === null) return 'Confirm whether you have professional indemnity cover.';
      if (!platformCover && hasInsurance === true && !insurerName.trim()) return 'Enter insurer name.';
      if (!platformCover && hasInsurance === true && !insurancePolicyNumber.trim()) return 'Enter insurance policy number.';
      if (!platformCover && hasInsurance === true && !insuranceRenewalDate) return 'Enter insurance expiry / next renewal date.';
      if (!platformCover && hasInsurance === true && !insuranceCoversVirtual) return 'Confirm whether cover includes virtual consultations.';
      if (!consent) return 'Accept the Ambulant+ terms and privacy policy.';
    }

    return 'Complete the required fields on this step.';
  }, [
    canGoNext,
    step,
    firstName,
    lastName,
    email,
    pw,
    confirmPw,
    normalizedPhone,
    specialty,
    license,
    nextRenewalDate,
    hpcsaDocFile,
    dob,
    gender,
    primaryQualification,
    qualificationYear,
    preferredCommunication,
    primaryLanguage,
    citizenship,
    saIdNumber,
    passportNumber,
    citizenshipCountry,
    passportIssuingAuthority,
    passportExpiry,
    practiceNumber,
    bhfPcnsRenewalDate,
    bhfPcnsDocFile,
    platformCover,
    hasInsurance,
    insurerName,
    insurancePolicyNumber,
    insuranceRenewalDate,
    insuranceCoversVirtual,
    consent,
  ]);

  function fail(stepNo: 0 | 1 | 2, message: string): ValidationFailure {
    return { step: stepNo, message };
  }

  function validateFinal(): ValidationFailure | null {
    if (!normalizeSpaces(firstName)) return fail(0, 'First name is required.');
    if (!normalizeSpaces(lastName)) return fail(0, 'Last name / surname is required.');
    if (!emailLooksValid(email)) return fail(0, 'Enter a valid email address.');
    if (!passwordLooksStrong(pw)) return fail(0, 'Password must be at least 8 characters and must not contain spaces.');
    if (!confirmPw || pw !== confirmPw) return fail(0, 'Passwords do not match.');
    if (!phoneLooksValid(normalizedPhone)) return fail(0, 'Enter a valid mobile number with country code, for example +27821234567.');

    if (!specialty.trim()) return fail(1, 'Specialty is required.');
    if (!dob || !isPastOrToday(dob)) return fail(1, 'Enter a valid date of birth.');
    if ((ageOnToday(dob) ?? 0) < 18) return fail(1, 'Clinician must be at least 18 years old.');
    if (!gender) return fail(1, 'Gender is required for identity checks.');
    if (!primaryQualification?.degree?.trim()) return fail(1, 'Primary qualification degree is required.');
    if (!primaryQualification?.institution?.trim()) return fail(1, 'Primary qualification institution is required.');
    if (!qualificationYearLooksValid(qualificationYear)) {
      return fail(1, `Qualification year must be between 1940 and ${CURRENT_YEAR - 1}.`);
    }
    if (!hpcsaRegistrationLooksValid(license)) return fail(1, 'HPCSA registration must look like MP1111111.');
    if (!nextRenewalDate || !isTodayOrFuture(nextRenewalDate)) return fail(1, 'HPCSA next renewal date is required and must not be expired.');
    if (!hpcsaDocFile) return fail(1, 'Upload your HPCSA registration certificate/document.');
    if (preferredCommunication.length === 0) return fail(1, 'Select at least one communication option.');
    if (!primaryLanguage) return fail(1, 'Primary language is required.');

    if (!citizenship) return fail(2, 'Citizenship status is required.');
    if (citizenship === 'south_african') {
      const idErr = validateSaIdDetailed(saIdNumber, dob, gender);
      if (idErr) return fail(2, idErr);
    }
    if (citizenship === 'non_south_african') {
      if (!passportNumberLooksValid(passportNumber)) return fail(2, 'Passport number must be 5-20 letters/numbers.');
      if (!citizenshipCountry.trim()) return fail(2, 'Country of citizenship is required.');
      if (!passportIssuingAuthority.trim()) return fail(2, 'Passport issuing authority is required.');
      if (!isFutureDate(passportExpiry)) return fail(2, 'Passport expiry must be a future date.');
    }
    if (practiceNumber && !practiceNumberLooksValid(practiceNumber)) return fail(2, 'Enter a valid BHF/PCNS practice number.');
    if (practiceNumber && (!bhfPcnsRenewalDate || !isTodayOrFuture(bhfPcnsRenewalDate))) {
      return fail(2, 'BHF/PCNS expiry or next renewal date is required when BHF/PCNS number is supplied.');
    }
    if (practiceNumber && !bhfPcnsDocFile) return fail(2, 'Upload BHF/PCNS proof when BHF/PCNS number is supplied.');
    if (!platformCover && hasInsurance === null) return fail(2, 'Please confirm whether you have professional indemnity cover.');
    if (!platformCover && hasInsurance === true && !insurerName.trim()) return fail(2, 'Insurer name is required.');
    if (!platformCover && hasInsurance === true && !insurancePolicyNumber.trim()) return fail(2, 'Insurance policy number is required.');
    if (!platformCover && hasInsurance === true && !insuranceRenewalDate) return fail(2, 'Insurance expiry / next renewal date is required.');
    if (!platformCover && hasInsurance === true && !insuranceCoversVirtual) {
      return fail(2, 'Please confirm whether your cover includes virtual consultations.');
    }
    if (!consent) return fail(2, 'You must agree to the terms and privacy policy.');


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

  function handleNextStep() {
    const err = validateFinal();

    if (err && err.step <= step) {
      setMsg(`Error: ${err.message}`);
      setStep(err.step);
      return;
    }

    setMsg(null);
    setStep((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s));
  }



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setMsg(null);
    const err = validateFinal();
    if (err) {
      setMsg(`Error: ${err.message}`);
      setStep(err.step);
      return;
    }

    setLoading(true);
    try {
      const emailNorm = normalizeEmail(email);
      const primary = {
        degree: normalizeSpaces(primaryQualification?.degree || ''),
        institution: normalizeSpaces(primaryQualification?.institution || ''),
        yearOfCompletion: String(primaryQualification?.yearOfCompletion || '').trim(),
      };

      const normalizedHpcsaRegistration = String(license || '').trim().toUpperCase().replace(/\s+/g, '');
      const normalizedPracticeNumber = digitsOnly(practiceNumber);
      const normalizedSaId = digitsOnly(saIdNumber);
      const finalFirstName = normalizeSpaces(firstName);
      const finalMiddleName = normalizeSpaces(middleName);
      const finalLastName = normalizeSpaces(lastName);
      const finalFullName = normalizeSpaces([finalFirstName, finalMiddleName, finalLastName].filter(Boolean).join(' '));

      // Build a single "profile" blob (stored server-side in metadata.rawProfileJson)
      const profile = {
        firstName: finalFirstName,
        middleName: finalMiddleName || undefined,
        lastName: finalLastName,
        surname: finalLastName,
        fullName: finalFullName,
        displayName: finalFullName,

        dob: dob || undefined,
        dateOfBirth: dob || undefined,
        gender: gender || undefined,
        address: [practiceAddressLine1, practiceAddressLine2, practiceSuburbTown, practiceCity, practiceProvince, practicePostalCode, practiceCountry].filter(Boolean).join(', ') || undefined,
        practiceAddress: {
          line1: normalizeSpaces(practiceAddressLine1) || undefined,
          line2: normalizeSpaces(practiceAddressLine2) || undefined,
          suburbTown: normalizeSpaces(practiceSuburbTown) || undefined,
          city: normalizeSpaces(practiceCity) || undefined,
          province: normalizeSpaces(practiceProvince) || undefined,
          postalCode: normalizeSpaces(practicePostalCode) || undefined,
          country: normalizeSpaces(practiceCountry || 'South Africa'),
        },

        phone: normalizedPhone,
        phoneCountryCode,

        qualification: primary.degree,
        qualificationInstitution: primary.institution,
        qualificationYear: Number(primary.yearOfCompletion),

        qualifications: qualifications
          .filter((q) => q.degree || q.institution)
          .map((q) => ({
            degree: normalizeSpaces(q.degree),
            institution: normalizeSpaces(q.institution),
            yearOfCompletion: String(q.yearOfCompletion || '').trim() || undefined,
          })),
        otherQualifications: otherQualifications
          .filter((q) => q.award || q.institution)
          .map((q) => ({
            award: normalizeSpaces(q.award),
            institution: normalizeSpaces(q.institution),
            yearOfCompletion: String(q.yearOfCompletion || '').trim() || undefined,
          })),

        citizenship: citizenship || undefined,
        idNumber: citizenship === 'south_african' ? normalizedSaId : undefined,
        saIdNumber: citizenship === 'south_african' ? normalizedSaId : undefined,
        citizenshipCountry: citizenship === 'non_south_african' ? normalizeSpaces(citizenshipCountry) : undefined,
        passportNumber: citizenship === 'non_south_african' ? normalizeSpaces(passportNumber).toUpperCase() : undefined,
        passportIssuingAuthority: citizenship === 'non_south_african' ? normalizeSpaces(passportIssuingAuthority) : undefined,
        passportExpiry: citizenship === 'non_south_african' ? passportExpiry || undefined : undefined,

        regulatorBody: 'HPCSA',
        regulatorRegistration: normalizedHpcsaRegistration,
        hpcsaRegistrationNumber: normalizedHpcsaRegistration,
        hpcsaNextRenewalDate: nextRenewalDate || undefined,

        practiceNumber: normalizedPracticeNumber || undefined,
        bhfPracticeNumber: normalizedPracticeNumber || undefined,
        pcnsPracticeNumber: normalizedPracticeNumber || undefined,
        practiceNumberType: normalizedPracticeNumber ? 'BHF_PCNS' : undefined,
        practiceNumberRenewalDate: normalizedPracticeNumber ? (bhfPcnsRenewalDate || undefined) : undefined,
        bhfPcnsNextRenewalDate: normalizedPracticeNumber ? (bhfPcnsRenewalDate || undefined) : undefined,
        bhfPcnsProofSubmitted: !!(normalizedPracticeNumber && bhfPcnsDocFile),

        // Insurance: if platform cover enabled, capture nothing here
        platformCoverEnabled: platformCover,
        hasInsurance: platformCover ? undefined : typeof hasInsurance === 'boolean' ? hasInsurance : undefined,
        insurerName: platformCover ? undefined : hasInsurance ? normalizeSpaces(insurerName) : undefined,
        insuranceType: platformCover ? undefined : hasInsurance ? normalizeSpaces(insuranceType) : undefined,
        insurancePolicyName: platformCover ? undefined : hasInsurance ? normalizeSpaces(insurancePolicyName) : undefined,
        insurancePolicyNumber: platformCover ? undefined : hasInsurance ? normalizeSpaces(insurancePolicyNumber) : undefined,
        insuranceRenewalDate: platformCover ? undefined : hasInsurance ? insuranceRenewalDate || undefined : undefined,
        insuranceCoversVirtual: platformCover ? undefined : hasInsurance ? insuranceCoversVirtual === 'yes' : undefined,

        preferredCommunication,
        primaryLanguage: normalizeSpaces(primaryLanguage) || undefined,
        otherLanguages,
        hasTelemedicineExperience: typeof hasTelemedicineExperience === 'boolean' ? hasTelemedicineExperience : undefined,

        declarations: {
          termsAccepted: consent,
          clinicianConfirmsInformationAccurate: consent,
          trainingRequiredAcknowledged: true,
          patientVisibilityRequiresCertification: true,
        },

      };

      // Prefer multipart (supports file upload)
      const fd = new FormData();
      fd.set('role', 'clinician');
      fd.set('name', finalFullName);
      fd.set('email', emailNorm);
      fd.set('password', pw);
      fd.set('phone', normalizedPhone);
      fd.set('specialty', specialty.trim());
      if (normalizedHpcsaRegistration) fd.set('license', normalizedHpcsaRegistration);
      fd.set('profile', JSON.stringify(profile));

      if (hpcsaDocFile) {
        fd.set('hpcsaDoc', hpcsaDocFile);
      }

      if (normalizedPracticeNumber && bhfPcnsDocFile) {
        fd.set('bhfPcnsDoc', bhfPcnsDocFile);
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
      setMsg(null);
    } catch (er: any) {
      setMsg(`Error: ${er?.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* Left: story / trust */}
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-black text-slate-700 backdrop-blur">
              Ambulant+ Clinician
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              {signupPresentation.heroHeading}
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              {signupPresentation.heroIntroduction}
            </p>

            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
              <InfoCard
                icon={<ClipboardCheck className="h-4 w-4 text-indigo-700" />}
                title="Required training"
                desc="Choose a real Admin-published programme after signing in. No upfront onboarding payment is required for the direct pathway."
              />
              <InfoCard
                icon={<Truck className="h-4 w-4 text-emerald-700" />}
                title={signupPresentation.optionalKitTitle}
                desc={signupPresentation.optionalKitDescription}
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
                  <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-emerald-100 p-2">
                        <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                      </div>
                      <div>
                        <div className="text-xl font-black">{signupPresentation.successHeading}</div>
                        <p className="mt-2 text-sm leading-relaxed text-emerald-900">{signupPresentation.successBody}</p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-800">{signupPresentation.successSecondary}</p>
                      </div>
                    </div>
                    <Link
                      href="/auth/login?reason=signup_success&next=%2Ftraining%2Fschedule"
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800"
                    >
                      {signupPresentation.successCtaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className={cx('mt-5 space-y-5', done && 'hidden')}>
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                    <div className="font-extrabold">{signupPresentation.noticeHeading}</div>
                    <div className="mt-2 space-y-2 text-[13px] leading-6">
                      <p>{signupPresentation.noticeBody}</p>
                      <p><strong>{signupPresentation.noticeSecondary}</strong></p>
                      <p>
                        <Link
                          href={safeInternalPath(signupPresentation.noticeCtaHref, '/clinicians/c-med-options')}
                          target="_blank"
                          rel="noreferrer"
                          className="font-extrabold text-emerald-800 hover:underline"
                        >
                          {signupPresentation.noticeCtaLabel}
                        </Link>
                      </p>
                    </div>
                  </div>


                  {step === 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="First name *" icon={<User className="h-4 w-4" />}>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="Jane" autoComplete="given-name" required />
                      </Field>

                      <Field label="Middle name / other names" icon={<User className="h-4 w-4" />}>
                        <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputCls} placeholder="Optional" autoComplete="additional-name" />
                      </Field>

                      <Field label="Last name / surname *" icon={<User className="h-4 w-4" />}>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="Doe" autoComplete="family-name" required />
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
                        label="Password *"
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
                          placeholder="Create password"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                        />
                        <div className="mt-1 text-[11px] text-slate-500">Use at least 8 characters. Add uppercase, lowercase, numbers, and symbols for stronger security.</div>
                        <div className="mt-1 text-[11px] font-bold text-slate-600">Password strength: {passwordStrengthLabel}</div>
                      </Field>

                      <Field label="Confirm password *" icon={<Lock className="h-4 w-4" />}>
                        <input
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          className={inputCls}
                          placeholder="Re-enter password"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                        />
                        {confirmPw && pw !== confirmPw ? (
                          <div className="mt-1 text-[11px] font-bold text-rose-600">Passwords do not match.</div>
                        ) : null}
                      </Field>

                      <Field label="Mobile number *" icon={<Phone className="h-4 w-4" />}>
                        <div className="flex gap-2">
                          <select
                            value={phoneCountryCode}
                            onChange={(e) => setPhoneCountryCode(e.target.value)}
                            className="w-32 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                            aria-label="Phone country code"
                          >
                            {PHONE_COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code}
                              </option>
                            ))}
                          </select>
                          <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={inputCls}
                            placeholder="82 123 4567"
                            type="tel"
                            inputMode="tel"
                            required
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">Use a reachable mobile number. Example: +27821234567.</div>
                      </Field>
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Specialty *" icon={<Stethoscope className="h-4 w-4" />}>
                          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className={selectCls} required>
                            <option value="">Select specialty</option>
                            {CLINICAL_SPECIALTIES.map((s) => (
                              <option key={s.key} value={s.label}>{s.label}</option>
                            ))}
                          </select>
                          <div className="mt-1 text-[11px] text-slate-500">Specialty is controlled so patients can search and filter accurately.</div>
                        </Field>

                        <Field label="HPCSA registration number *" icon={<BadgeCheck className="h-4 w-4" />}>
                          <input
                            value={license}
                            onChange={(e) => setLicense(e.target.value.toUpperCase())}
                            className={inputCls}
                            placeholder="MP1111111"
                            required
                          />
                          <div className="mt-1 text-[11px] text-slate-500">Format: MP followed by 6-8 digits.</div>
                        </Field>


                        <Field label="HPCSA next renewal date *" icon={<CalendarDays className="h-4 w-4" />}>
                          <input value={nextRenewalDate} onChange={(e) => setNextRenewalDate(e.target.value)} className={inputCls} type="date" required />
                          <div className="mt-1 text-[11px] text-slate-500">Required for regulatory verification. Must be today or a future date.</div>
                        </Field>

                        <div className="sm:col-span-2">
                          <div className="text-xs font-black text-slate-700">Professional registration proof *</div>
                          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <FileUp className="h-4 w-4 text-slate-500" />
                              <span className="font-semibold">{hpcsaDocFile ? hpcsaDocFile.name : 'Upload current HPCSA certificate/document'}</span>
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
                            Upload a PDF, JPG or PNG copy of current HPCSA registration evidence.
                          </div>
                        </div>

                        <Field label="Date of birth *" icon={<CalendarDays className="h-4 w-4" />}>
                          <input value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} type="date" required />
                          <div className="mt-1 text-[11px] text-slate-500">Clinician must be at least 18 years old.</div>
                        </Field>

                        <Field label="Gender *" icon={<User className="h-4 w-4" />}>
                          <select value={gender} onChange={(e) => setGender(e.target.value as any)} className={selectCls} required>
                            <option value="">Select</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="other">Other</option>
                          </select>
                        </Field>

                        <Field label="Street address 1" icon={<MapPin className="h-4 w-4" />} className="sm:col-span-2">
                          <input value={practiceAddressLine1} onChange={(e) => setPracticeAddressLine1(e.target.value)} className={inputCls} placeholder="Street number, complex or building" />
                        </Field>
                        <Field label="Street address 2" icon={<MapPin className="h-4 w-4" />} className="sm:col-span-2">
                          <input value={practiceAddressLine2} onChange={(e) => setPracticeAddressLine2(e.target.value)} className={inputCls} placeholder="Suite, floor or unit (optional)" />
                        </Field>
                        <Field label="Suburb / town" icon={<MapPin className="h-4 w-4" />}>
                          <input value={practiceSuburbTown} onChange={(e) => setPracticeSuburbTown(e.target.value)} className={inputCls} placeholder="Sandton, Honeydew, Sea Point" />
                        </Field>
                        <Field label="City" icon={<MapPin className="h-4 w-4" />}>
                          <input value={practiceCity} onChange={(e) => setPracticeCity(e.target.value)} className={inputCls} placeholder="Johannesburg" />
                        </Field>
                        <Field label="Province" icon={<MapPin className="h-4 w-4" />}>
                          <select value={practiceProvince} onChange={(e) => setPracticeProvince(e.target.value)} className={selectCls}>
                            {ZA_PROVINCES.map((p) => (<option key={p} value={p}>{p}</option>))}
                          </select>
                        </Field>
                        <Field label="Postal code" icon={<MapPin className="h-4 w-4" />}>
                          <input value={practicePostalCode} onChange={(e) => setPracticePostalCode(e.target.value)} className={inputCls} placeholder="2196" inputMode="numeric" />
                        </Field>
                        <Field label="Country" icon={<MapPin className="h-4 w-4" />}>
                          <select value={practiceCountry} onChange={(e) => setPracticeCountry(e.target.value)} className={selectCls}>
                            <option value="South Africa">South Africa</option>
                            <option value="Botswana">Botswana</option>
                            <option value="Lesotho">Lesotho</option>
                            <option value="Namibia">Namibia</option>
                            <option value="Nigeria">Nigeria</option>
                            <option value="United Kingdom">United Kingdom</option>
                          </select>
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
                                    —
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
                                    —
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
                          <MiniField label="Primary language *">
                            <select value={primaryLanguage} onChange={(e) => setPrimaryLanguage(e.target.value)} className={selectCls} required>
                              <option value="">Select primary language</option>
                              {LANGUAGE_OPTIONS.map((x) => (
                                <option key={x} value={x}>{x}</option>
                              ))}
                            </select>
                          </MiniField>
                          <MiniField label="Other languages">
                            <select
                              value=""
                              onChange={(e) => {
                                const value = e.target.value;
                                if (!value) return;
                                setOtherLanguages((prev) => (prev.includes(value) ? prev : [...prev, value]));
                              }}
                              className={selectCls}
                            >
                              <option value="">Add another language</option>
                              {LANGUAGE_OPTIONS.filter((x) => x !== primaryLanguage && !otherLanguages.includes(x)).map((x) => (
                                <option key={x} value={x}>{x}</option>
                              ))}
                            </select>
                            {otherLanguages.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {otherLanguages.map((lang) => (
                                  <button
                                    key={lang}
                                    type="button"
                                    onClick={() => setOtherLanguages((prev) => prev.filter((x) => x !== lang))}
                                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700"
                                  >
                                    {lang} ×
                                  </button>
                                ))}
                              </div>
                            ) : null}
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
                            <MiniField label="SA ID number *">
                              <input
                                value={saIdNumber}
                                onChange={(e) => setSaIdNumber(digitsOnly(e.target.value).slice(0, 13))}
                                className={inputCls}
                                placeholder="YYMMDD#######"
                                inputMode="numeric"
                                maxLength={13}
                              />
                              <div className={cx('mt-1 text-[11px]', saIdValidationMessage ? 'text-rose-700' : 'text-slate-500')}>
                                {saIdValidationMessage || 'Must be 13 digits, match DOB, match gender block, and pass checksum.'}
                              </div>
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

                      <Section title="Practice billing credential (optional)">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <MiniField label="BHF / PCNS practice number">
                            <input
                              value={practiceNumber}
                              onChange={(e) => {
                                const next = digitsOnly(e.target.value);
                                setPracticeNumber(next);
                                if (!next) {
                                  setBhfPcnsRenewalDate('');
                                  setBhfPcnsDocFile(null);
                                }
                              }}
                              className={inputCls}
                              placeholder="BHF/PCNS practice number"
                              inputMode="numeric"
                            />
                            <div className="mt-1 text-[11px] text-slate-500">
                              Optional. Required only if you want a billing/practice credential recorded.
                            </div>
                          </MiniField>

                          {practiceNumber ? (
                            <MiniField label="BHF / PCNS expiry or next renewal date *">
                              <input
                                value={bhfPcnsRenewalDate}
                                onChange={(e) => setBhfPcnsRenewalDate(e.target.value)}
                                className={inputCls}
                                type="date"
                              />
                            </MiniField>
                          ) : null}
                        </div>

                        {practiceNumber ? (
                          <div className="mt-4">
                            <div className="text-xs font-black text-slate-700">Upload BHF/PCNS proof *</div>
                            <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                <FileUp className="h-4 w-4 text-slate-500" />
                                <span className="font-semibold">{bhfPcnsDocFile ? bhfPcnsDocFile.name : 'Choose a BHF/PCNS document'}</span>
                              </div>
                              <label className="cursor-pointer rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-slate-800">
                                Browse
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => setBhfPcnsDocFile(e.target.files?.[0] ?? null)}
                                  accept=".pdf,image/*"
                                />
                              </label>
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500">
                              Required only when a BHF/PCNS practice number is supplied.
                            </div>
                          </div>
                        ) : null}
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
                            <div className="text-xs font-black text-slate-700">Do you have your own professional indemnity cover? *</div>
                            <div className="mt-2 flex gap-2">
                              <Pill label="Yes" selected={hasInsurance === true} onClick={() => setHasInsurance(true)} />
                              <Pill label="No" selected={hasInsurance === false} onClick={() => setHasInsurance(false)} />
                            </div>

                            {hasInsurance ? (
                              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <MiniField label="Insurer name *">
                                  <input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} className={inputCls} />
                                </MiniField>
                                <MiniField label="Policy number *">
                                  <input value={insurancePolicyNumber} onChange={(e) => setInsurancePolicyNumber(e.target.value)} className={inputCls} />
                                </MiniField>
                                <MiniField label="Policy name">
                                  <input value={insurancePolicyName} onChange={(e) => setInsurancePolicyName(e.target.value)} className={inputCls} />
                                </MiniField>
                                <MiniField label="Expiry / next renewal date *">
                                  <input value={insuranceRenewalDate} onChange={(e) => setInsuranceRenewalDate(e.target.value)} className={inputCls} type="date" />
                                </MiniField>

                                <div className="sm:col-span-2">
                                  <div className="text-xs font-black text-slate-700">Does it cover virtual consultations using IoMT-supported remote assessment? *</div>
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
                            I agree to Ambulant+ <Link href="/terms" target="_blank" className="font-extrabold text-indigo-700 hover:underline">terms of use</Link> and <Link href="/privacy" target="_blank" className="font-extrabold text-indigo-700 hover:underline">privacy policy</Link> <span className="font-extrabold">*</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : null}


                  {stepBlockerHint ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                      {stepBlockerHint}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : s))}
                      className={cx(
                        'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800',
                        step === 0 && 'opacity-50 pointer-events-none',
                      )}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>

                    <div className="flex gap-2">
                      {step < 2 ? (
                        <button
                          type="button"
                          onClick={handleNextStep}
                          aria-disabled={!canGoNext}
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
                              Submitting...
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
                By applying, you agree to Ambulant+ <Link href="/terms" target="_blank" className="font-bold text-slate-700 hover:underline">terms</Link> and <Link href="/privacy" target="_blank" className="font-bold text-slate-700 hover:underline">privacy policy</Link>.
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
  ];
  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
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
