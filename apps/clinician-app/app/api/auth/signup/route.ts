// apps/clinician-app/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { PresenceActorType } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import { sendEmail, sendSms } from '@/src/lib/mailer';

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function normEmail(v: any) {
  return String(v || '').trim().toLowerCase();
}

function safeStr(v: any) {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

function safeCurrency(v: any) {
  const s = String(v ?? 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : 'ZAR';
}

function feeZarToCents(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

function digitsOnly(v: any) {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizeSpaces(v: any) {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

function normalizePhone(v: any) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return `+${digitsOnly(s)}`;
  return digitsOnly(s);
}

function emailLooksValid(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(v));
}

function passwordLooksStrong(v: string) {
  const value = String(v || '');
  return (
    value.length >= 10 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function phoneLooksValid(value: string) {
  const normalized = normalizePhone(value);
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return false;
  if (normalized.startsWith('+27')) return /^\+27\d{9}$/.test(normalized);
  return true;
}

function parseDateInput(value: any) {
  const v = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function ageOnToday(value: any) {
  const d = parseDateInput(value);
  if (!d) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

function isFutureDate(value: any) {
  const d = parseDateInput(value);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() > today.getTime();
}

function isTodayOrFuture(value: any) {
  const d = parseDateInput(value);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

function qualificationYearLooksValid(year: any) {
  const y = Number(year);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(y) && y >= 1940 && y <= currentYear - 1;
}

function hpcsaRegistrationLooksValid(value: any) {
  const v = safeStr(value).toUpperCase().replace(/\s+/g, '');
  return /^MP\d{6,8}$/.test(v);
}

function practiceNumberLooksValid(value: any) {
  return /^\d{13}$/.test(digitsOnly(value));
}

function passportNumberLooksValid(value: any) {
  return /^[A-Z0-9]{5,20}$/i.test(safeStr(value).replace(/\s+/g, ''));
}

function luhnLooksValid(value: any) {
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

function validateSaIdDetailed(id: any, dob: any, gender: any) {
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
  const g = safeStr(gender).toLowerCase();

  if (g === 'female' && serial >= 5000) return 'SA ID gender block indicates male, but Female was selected.';
  if (g === 'male' && serial < 5000) return 'SA ID gender block indicates female, but Male was selected.';

  const citizenshipDigit = v[10];
  if (!['0', '1'].includes(citizenshipDigit)) return 'SA ID citizenship digit must be 0 or 1.';

  if (!luhnLooksValid(v)) return 'SA ID checksum failed. Please check the number.';
  return null;
}

function primaryQualificationFrom(profile: any) {
  const direct = {
    degree: safeStr(profile?.qualification),
    institution: safeStr(profile?.qualificationInstitution),
    yearOfCompletion: safeStr(profile?.qualificationYear),
  };

  if (direct.degree || direct.institution || direct.yearOfCompletion) return direct;

  const first = Array.isArray(profile?.qualifications) ? profile.qualifications[0] : null;
  return {
    degree: safeStr(first?.degree),
    institution: safeStr(first?.institution),
    yearOfCompletion: safeStr(first?.yearOfCompletion),
  };
}

function badRequest(error: string, field?: string) {
  return json({ ok: false, error, field }, 400);
}


function getBaseUrl(req: NextRequest) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim().replace(/\/+$/, '');
  return req.nextUrl.origin;
}


function bufferToBase64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function hashPasswordScrypt(password: string) {
  const salt = crypto.randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const keyLen = 64;

  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, keyLen, { N, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt${N}${r}${p}${bufferToBase64url(salt)}${bufferToBase64url(hash)}`;
}

function generatePatientMrnCandidate(now = new Date()) {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const suffix = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  return `AMB-${yy}${mm}-${suffix}`;
}

async function generateUniquePatientMrn(tx: any) {
  for (let i = 0; i < 12; i += 1) {
    const mrn = generatePatientMrnCandidate();
    const existing = await tx.patientProfile
      .findUnique({ where: { mrn }, select: { id: true } })
      .catch(() => null);

    if (!existing) return mrn;
  }

  throw new Error('Unable to allocate a unique patient MRN.');
}

function dateStringToUtcDate(value: any) {
  const raw = safeStr(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

function normalizePatientGender(value: any) {
  const raw = safeStr(value).toLowerCase();
  if (['male', 'female', 'other'].includes(raw)) return raw;
  return raw || null;
}

function patientAddressFromClinicianProfile(profile: any, shipping: any) {
  const home = profile?.homeAddress || {};
  const billing = profile?.billingAddress || {};
  const practice = profile?.practiceAddress || {};

  const addressLine1 =
    normalizeSpaces(home.line1 || billing.line1 || shipping?.addressLine1 || practice.line1 || profile?.address || '') ||
    'Address pending confirmation';

  const addressLine2 =
    normalizeSpaces(home.line2 || billing.line2 || shipping?.addressLine2 || practice.line2 || '') || null;

  const city =
    normalizeSpaces(home.city || billing.city || shipping?.city || practice.city || '') ||
    'City pending confirmation';

  const postalCode =
    normalizeSpaces(home.postalCode || billing.postalCode || shipping?.postalCode || practice.postalCode || '') || null;

  return { addressLine1, addressLine2, city, postalCode };
}

async function ensurePatientAccountForClinician(
  tx: any,
  args: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    dob?: string;
    gender?: string;
    idNumber?: string;
    profile?: any;
    shipping?: any;
    submittedAt?: string;
  },
) {
  const email = normEmail(args.email);
  if (!email) return { linked: false, reason: 'missing_email' };

  const orgId = process.env.DEFAULT_ORG_ID || 'org-default';

  let cred = await tx.authCredential
    .findUnique({
      where: { email },
      select: { id: true, email: true, actorType: true, disabled: true, orgId: true },
    })
    .catch(() => null);

  if (cred && cred.actorType !== PresenceActorType.PATIENT) {
    return {
      linked: false,
      reason: 'email_reserved_by_non_patient_credential',
      userId: cred.id,
    };
  }

  if (!cred) {
    const passwordHash = await hashPasswordScrypt(args.password);

    cred = await tx.authCredential.create({
      data: {
        email,
        passwordHash,
        actorType: PresenceActorType.PATIENT,
        disabled: false,
        orgId,
      },
      select: { id: true, email: true, actorType: true, disabled: true, orgId: true },
    });
  }

  const existingProfile = await tx.patientProfile
    .findFirst({
      where: {
        OR: [{ userId: cred.id }, { contactEmail: email }],
      },
      select: { id: true, userId: true, mrn: true },
    })
    .catch(() => null);

  if (existingProfile) {
    return {
      linked: true,
      created: false,
      userId: cred.id,
      patientId: existingProfile.id,
      mrn: existingProfile.mrn,
    };
  }

  const mrn = await generateUniquePatientMrn(tx);
  const address = patientAddressFromClinicianProfile(args.profile || {}, args.shipping || {});
  const dobDate = dateStringToUtcDate(args.dob);

  const patientProfile = await tx.patientProfile.create({
    data: {
      userId: cred.id,
      mrn,
      name: args.name || email,
      contactEmail: email,
      phone: args.phone || undefined,
      dob: dobDate || undefined,
      gender: normalizePatientGender(args.gender) || undefined,
      idNumber: args.idNumber || undefined,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || undefined,
      city: address.city,
      postalCode: address.postalCode || undefined,
      allergies: undefined,
    },
    select: { id: true, userId: true, mrn: true },
  });

  return {
    linked: true,
    created: true,
    userId: cred.id,
    patientId: patientProfile.id,
    mrn: patientProfile.mrn,
  };
}

/** ---------------- Auth0 (Mgmt) helper ----------------
 * NOTE: This is for user creation and password updates (admin context),
 * not for end-user login.
 */
async function getAuth0MgmtToken() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) return null;

  const tokenRes = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenRes.ok) return null;
  const tokenData = await tokenRes.json().catch(() => null);
  return tokenData?.access_token ? String(tokenData.access_token) : null;
}

async function createAuth0User(email: string, name?: string, password?: string) {
  const domain = process.env.AUTH0_DOMAIN;
  const mgmtToken = await getAuth0MgmtToken();
  if (!domain || !mgmtToken) return { ok: false as const, error: 'missing_auth0_mgmt' as const };

  try {
    const createRes = await fetch(`https://${domain}/api/v2/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        connection: process.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication',
        email,
        name,
        password: password ?? `${Math.random().toString(36).slice(2)}A!1`,
        email_verified: false,
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => '');
      return { ok: false as const, error: `create_failed:${createRes.status}` as const, info: txt };
    }

    const data = await createRes.json().catch(() => null);
    return { ok: true as const, user: data };
  } catch (err: any) {
    return { ok: false as const, error: String(err) };
  }
}

/** ---------------- S3 helper ---------------- */
function s3Maybe() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) return null;

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

async function uploadToS3(file: File, key: string) {
  const s3 = s3Maybe();
  if (!s3) return { ok: false as const, error: 's3_not_configured' as const };

  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = new Upload({
    client: s3.client,
    params: {
      Bucket: s3.bucket,
      Key: key,
      Body: bytes,
      ContentType: file.type || 'application/octet-stream',
      ACL: 'private',
    },
  });
  await upload.done();
  return { ok: true as const };
}

function uploadedFileLooksUsable(file: File | null) {
  if (!file) return false;
  const size = Number((file as any).size || 0);
  if (!Number.isFinite(size) || size <= 0) return false;
  // 10 MB launch limit: enough for PDF/JPG/PNG registration certificate scans.
  if (size > 10 * 1024 * 1024) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';

    let name = '';
    let email = '';
    let password = '';
    let phone = '';
    let specialty = '';
    let license = '';
    let profileRaw = '{}';
    let hpcsaFile: File | null = null;

    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      name = safeStr(fd.get('name'));
      email = normEmail(fd.get('email'));
      password = String(fd.get('password') || '');
      phone = safeStr(fd.get('phone'));
      specialty = safeStr(fd.get('specialty'));
      license = safeStr(fd.get('license'));
      profileRaw = String(fd.get('profile') || '{}');
      const f = fd.get('hpcsaDoc');
      if (f && typeof f === 'object' && 'arrayBuffer' in f) hpcsaFile = f as File;
    } else {
      // JSON fallback
      const body = await req.json().catch(() => ({}));
      name = safeStr(body?.name);
      email = normEmail(body?.email);
      password = String(body?.password || '');
      phone = safeStr(body?.phone);
      specialty = safeStr(body?.specialty);
      license = safeStr(body?.license);
      profileRaw = JSON.stringify(body?.profile ?? {});
    }

    let profile: any = {};
    try {
      profile = JSON.parse(profileRaw || '{}');
    } catch {
      profile = {};
    }

    const firstName = normalizeSpaces(profile?.firstName);
    const middleName = normalizeSpaces(profile?.middleName);
    const lastName = normalizeSpaces(profile?.lastName || profile?.surname);

    if (!name) {
      name = [firstName, middleName, lastName].filter(Boolean).join(' ');
    }

    const normalizedPhone = normalizePhone(phone || profile?.phone);
    const dob = safeStr(profile?.dob || profile?.dateOfBirth);
    const gender = safeStr(profile?.gender).toLowerCase();
    const citizenship = safeStr(profile?.citizenship);
    const idNumber = digitsOnly(profile?.idNumber || profile?.saIdNumber);
    const citizenshipCountry = normalizeSpaces(profile?.citizenshipCountry);
    const passportNumber = safeStr(profile?.passportNumber).toUpperCase().replace(/\s+/g, '');
    const passportIssuingAuthority = normalizeSpaces(profile?.passportIssuingAuthority);
    const passportExpiry = safeStr(profile?.passportExpiry);
    const hpcsaRegistrationNumber = safeStr(
      license || profile?.hpcsaRegistrationNumber || profile?.regulatorRegistration || profile?.registrationNumber,
    )
      .toUpperCase()
      .replace(/\s+/g, '');
    const specialtyKey = safeStr(profile?.specialtyKey || profile?.workspaceKey);
    const practiceNumber = digitsOnly(profile?.practiceNumber || profile?.bhfPracticeNumber || profile?.pcnsPracticeNumber);
    const practiceNumberRenewalDate = safeStr(
      profile?.practiceNumberRenewalDate || profile?.bhfNextRenewalDate || profile?.pcnsNextRenewalDate,
    );
    const hpcsaNextRenewalDate = safeStr(profile?.hpcsaNextRenewalDate || profile?.nextRenewalDate);
    const primaryQualification = primaryQualificationFrom(profile);
    const qualificationYear = Number(primaryQualification.yearOfCompletion);
    const onboarding = profile?.onboarding || {};
    const training = onboarding?.training || {};
    const shipping = onboarding?.shipping || {};
    const shippingPhone = normalizePhone(shipping?.phone);
    const hasInsurance = profile?.hasInsurance;
    const platformCoverEnabled = profile?.platformCoverEnabled === true;
    const declarations = profile?.declarations || {};

    if (!firstName) return badRequest('First name is required', 'firstName');
    if (!lastName) return badRequest('Last name / surname is required', 'lastName');
    if (!name) return badRequest('Full name required', 'name');
    if (!emailLooksValid(email)) return badRequest('Valid email required', 'email');
    if (!passwordLooksStrong(password)) {
      return badRequest('Password must be at least 10 characters and include uppercase, lowercase, number, and special character', 'password');
    }
    if (!phoneLooksValid(normalizedPhone)) return badRequest('Valid mobile number with country code required', 'phone');
    if (!specialty) return badRequest('Select your clinical specialty/workspace', 'specialty');

    if (!dob || (ageOnToday(dob) ?? 0) < 18) return badRequest('Clinician must be at least 18 years old', 'dob');
    if (!['male', 'female', 'other'].includes(gender)) return badRequest('Gender required', 'gender');

    if (!primaryQualification.degree) return badRequest('Primary qualification degree required', 'qualification');
    if (!primaryQualification.institution) return badRequest('Primary qualification institution required', 'qualificationInstitution');
    if (!qualificationYearLooksValid(qualificationYear)) {
      return badRequest('Qualification year must be complete and at least 1 year ago', 'qualificationYear');
    }

    if (!hpcsaRegistrationLooksValid(hpcsaRegistrationNumber)) {
      return badRequest('HPCSA registration number must look like MP1111111', 'hpcsaRegistrationNumber');
    }

    if (!hpcsaNextRenewalDate || !isTodayOrFuture(hpcsaNextRenewalDate)) {
      return badRequest('HPCSA next renewal date is required and must not be expired', 'hpcsaNextRenewalDate');
    }

    if (practiceNumber && !practiceNumberLooksValid(practiceNumber)) {
      return badRequest('BHF/PCNS practice number must contain exactly 13 digits', 'practiceNumber');
    }

    if (practiceNumber && (!practiceNumberRenewalDate || !isTodayOrFuture(practiceNumberRenewalDate))) {
      return badRequest('BHF/PCNS next renewal date is required when a practice number is entered', 'practiceNumberRenewalDate');
    }

    if (citizenship === 'south_african') {
      const idError = validateSaIdDetailed(idNumber, dob, gender);
      if (idError) return badRequest(idError, 'saIdNumber');
    } else if (citizenship === 'non_south_african') {
      if (!passportNumberLooksValid(passportNumber)) return badRequest('Passport number must be 5Ã¢â‚¬â€œ20 letters/numbers', 'passportNumber');
      if (!citizenshipCountry) return badRequest('Country of citizenship required', 'citizenshipCountry');
      if (!passportIssuingAuthority) return badRequest('Passport issuing authority required', 'passportIssuingAuthority');
      if (!isFutureDate(passportExpiry)) return badRequest('Passport expiry must be in the future', 'passportExpiry');
    } else {
      return badRequest('Citizenship status required', 'citizenship');
    }

    if (!platformCoverEnabled && typeof hasInsurance !== 'boolean') {
      return badRequest('Professional indemnity cover answer required', 'hasInsurance');
    }

    if (!platformCoverEnabled && hasInsurance === true) {
      if (!safeStr(profile?.insurerName)) return badRequest('Insurer name required', 'insurerName');
      if (!safeStr(profile?.insuranceType)) return badRequest('Insurance type required', 'insuranceType');
      if (typeof profile?.insuranceCoversVirtual !== 'boolean') {
        return badRequest('Virtual consultation cover answer required', 'insuranceCoversVirtual');
      }
    }

    if (declarations?.termsAccepted !== true) return badRequest('Terms and privacy consent required', 'declarations.termsAccepted');

    if (!isTodayOrFuture(training?.preferredDate)) return badRequest('Training preferred date must be today or a future date', 'training.preferredDate');
    if (!normalizeSpaces(shipping?.recipientName)) return badRequest('Shipping recipient name required', 'shipping.recipientName');
    if (!phoneLooksValid(shippingPhone)) return badRequest('Valid shipping phone with country code required', 'shipping.phone');
    if (!normalizeSpaces(shipping?.addressLine1)) return badRequest('Shipping address line 1 required', 'shipping.addressLine1');
    if (!normalizeSpaces(shipping?.city)) return badRequest('Shipping city required', 'shipping.city');


    if (!uploadedFileLooksUsable(hpcsaFile)) {
      return badRequest('Upload a valid HPCSA registration document or certificate. Maximum file size is 10 MB.', 'hpcsaDoc');
    }

    // Mandatory HPCSA upload
    let hpcsaS3Key: string | null = null;
    let hpcsaFileMeta: any = null;

    if (hpcsaFile) {
      const safeName = String(hpcsaFile.name || `hpcsa-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const key = `uploads/hpcsa/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

      const up = await uploadToS3(hpcsaFile, key);
      if (up.ok) {
        hpcsaS3Key = key;
        hpcsaFileMeta = {
          filename: hpcsaFile.name,
          size: Number(hpcsaFile.size || 0),
          mime: hpcsaFile.type || 'application/octet-stream',
          s3Key: key,
        };
      } else {
        return badRequest(
          'Secure HPCSA document upload is not configured right now. Please contact Ambulant+ support before submitting.',
          'hpcsaDoc',
        );
      }
    }

    // Create Auth0 user (if configured)
    let auth0UserId: string | undefined;
    const authRes = await createAuth0User(email, name, password);
    if (authRes.ok && authRes.user?.user_id) auth0UserId = String(authRes.user.user_id);

    // Merge profile payload (store in ClinicianProfile.meta)
    const submittedAt = new Date().toISOString();
    const mergedProfile = {
      ...profile,
      firstName,
      middleName: middleName || undefined,
      lastName,
      surname: lastName,
      email,
      phone: normalizedPhone,
      license: hpcsaRegistrationNumber,
      idNumber: citizenship === 'south_african' ? idNumber : undefined,
      qualification: primaryQualification.degree,
      qualificationInstitution: primaryQualification.institution,
      qualificationYear,
      practiceNumber: practiceNumber || undefined,
      practiceNumberType: practiceNumber ? 'BHF_PCNS' : undefined,
      practiceNumberRenewalDate: practiceNumber ? practiceNumberRenewalDate : undefined,
      hpcsaNextRenewalDate,
      specialtyKey: specialtyKey || undefined,
      regulatorBody: 'HPCSA',
      regulatorRegistration: hpcsaRegistrationNumber,
      auth0UserId: auth0UserId || undefined,
      submittedAt,
    };

    // Map core regulator fields
    const regulatorBody = 'HPCSA';
    const regulatorRegistration = hpcsaRegistrationNumber;

    // Optional price fields (if UI passed them)
    const currency = safeCurrency(profile?.currency || 'ZAR');
    const feeCents = profile?.feeCents != null ? Math.max(0, Math.round(Number(profile.feeCents) || 0)) : feeZarToCents(profile?.feeZAR);

    // Create ClinicianProfile + ClinicianOnboarding in one transaction
    let clinician: any;
    try {
      clinician = await prisma.$transaction(async (tx) => {
        const created = await tx.clinicianProfile.create({
          data: {
            userId: email, // keep consistent with your current login convention
            displayName: name,
            specialty,
            email,
            phone: normalizedPhone || null,
            gender: gender || null,

            idNumber: citizenship === 'south_african' ? idNumber : passportNumber || null,
            idIssuingCountry: citizenship === 'south_african' ? 'ZA' : citizenshipCountry || null,
            idExpiry: citizenship === 'non_south_african' && passportExpiry ? new Date(`${passportExpiry}T00:00:00`) : null,

            qualification: primaryQualification.degree || null,
            qualificationYear: Number.isFinite(qualificationYear) ? qualificationYear : null,
            qualificationInstitution: primaryQualification.institution || null,
            otherQualifications: Array.isArray(profile?.otherQualifications)
              ? JSON.stringify(profile.otherQualifications)
              : null,

            addressLine1:
              normalizeSpaces(profile?.practiceAddress?.line1 || profile?.billingAddress?.line1 || shipping?.addressLine1 || profile?.address || '') ||
              null,
            addressLine2: normalizeSpaces(profile?.practiceAddress?.line2 || profile?.billingAddress?.line2 || shipping?.addressLine2 || '') || null,
            city: normalizeSpaces(profile?.practiceAddress?.city || profile?.billingAddress?.city || shipping?.city || '') || null,
            postalCode:
              normalizeSpaces(profile?.practiceAddress?.postalCode || profile?.billingAddress?.postalCode || shipping?.postalCode || '') || null,
            country:
              normalizeSpaces(
                profile?.practiceAddress?.country ||
                  profile?.billingAddress?.country ||
                  shipping?.country ||
                  (citizenship === 'south_african' ? 'South Africa' : citizenshipCountry),
              ) || null,

            practiceNumber: practiceNumber || null,
            regulatorBody: regulatorBody || null,
            regulatorRegistration: regulatorRegistration || null,

            piInsuranceProvider: !platformCoverEnabled && hasInsurance === true ? normalizeSpaces(profile?.insurerName) || null : null,
            piInsurancePolicyName: !platformCoverEnabled && hasInsurance === true ? normalizeSpaces(profile?.insuranceType) || null : null,
            piInsuranceCoverType:
              !platformCoverEnabled && hasInsurance === true
                ? profile?.insuranceCoversVirtual === true
                  ? 'virtual_and_in_person'
                  : 'in_person_only'
                : null,

            trainingScheduledAt: training?.preferredDate ? new Date(`${training.preferredDate}T09:00:00`) : null,

            // optional legacy fee fields
            feeCents: feeCents || 0,
            currency,

            status: 'pending',
            trainingCompleted: false,
            disabled: false,
            archived: false,

            meta: {
              rawProfile: mergedProfile, // store as object (Prisma Json)
              uploads: {
                hpcsa: hpcsaS3Key
                  ? { s3Key: hpcsaS3Key, ...hpcsaFileMeta }
                  : hpcsaFileMeta
                    ? { ...hpcsaFileMeta }
                    : null,
              },
              compliance: {
                regulator: {
                  status: regulatorBody && regulatorRegistration && hpcsaFileMeta ? 'submitted' : 'missing',
                  submittedAt,
                  hpcsaNextRenewalDate,
                  practiceNumber: practiceNumber || null,
                  practiceNumberRenewalDate: practiceNumber ? practiceNumberRenewalDate : null,
                },
                insurance: {
                  status: mergedProfile?.piInsuranceNumber || mergedProfile?.insurerName ? 'submitted' : 'missing',
                  submittedAt,
                },
                kyc: {
                  status: mergedProfile?.idNumber ? 'submitted' : 'missing',
                  submittedAt,
                },
                dueDiligence: { status: 'pending', submittedAt },
                training: { status: 'pending', submittedAt },
              },
            },
          },
          select: {
            id: true,
            userId: true,
            displayName: true,
            specialty: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        });

        // Ensure onboarding row exists for onboarding-board/dispatch/training flows
        await tx.clinicianOnboarding.upsert({
          where: { clinicianId: created.id },
          update: {},
          create: {
            clinicianId: created.id,
            status: 'pending',
            depositPaid: false,
          },
        });

        const patientAccount = await ensurePatientAccountForClinician(tx, {
          email,
          password,
          name,
          phone: normalizedPhone,
          dob,
          gender,
          idNumber: citizenship === 'south_african' ? idNumber : undefined,
          profile: mergedProfile,
          shipping,
          submittedAt,
        });

        return { ...created, patientAccount };
      });
    } catch (e: any) {
      // Prisma unique constraint (userId/email already exists)
      if (e?.code === 'P2002') {
        return json(
          { ok: false, error: 'Clinician already exists for this email', field: e?.meta?.target ?? 'userId' },
          409,
        );
      }
      throw e;
    }

    // Next steps
    const baseUrl = getBaseUrl(req);
    const onboardingLink = `${baseUrl}/auth/login?reason=training_required&next=${encodeURIComponent('/')}`;

    // Email + SMS: clearly explain the workflow (training -> payment -> ship -> certify)
    if (email) {
      const subject = 'Ambulant+ Clinician Application Received Ã¢â‚¬â€ Next Steps';
      const html = `
        <p>Hi ${name || 'Clinician'},</p>
        <p>Your Ambulant+ clinician application has been received.</p>

        <p><strong>Mandatory onboarding:</strong></p>
        <ol>
          <li><strong>Training scheduling + payment</strong> (required)</li>
          <li><strong>Starter kit dispatch</strong> after payment confirmation</li>
          <li><strong>Admin certification</strong> Ã¢â‚¬â€ only then your profile becomes visible to patients</li>
        </ol>

        <p><a href="${onboardingLink}">Ã°Å¸â€˜â€° Sign in to continue onboarding</a></p>

        <p style="margin-top:12px;"><strong>Starter kit contents</strong> (sent after payment):</p>
        <ul>
          <li>All four IoMTs</li>
          <li>Clinician Handbook + consumables</li>
          <li>Merchandise: branded formal shirts (black &amp; white), mug, thermo bottle</li>
          <li>Smart ID with card holder + lanyard</li>
        </ul>

        <p>When the admin assigns courier + tracking, you will receive tracking details by email and SMS.</p>

        <p style="margin-top:12px;">If you didnÃ¢â‚¬â„¢t request this, you can ignore this email.</p>
        <p>Ã¢â‚¬â€ Ambulant+ Team</p>
      `;
      sendEmail(email, subject, html).catch(console.error);
    }

    if (normalizedPhone) {
      const sms =
        `Ambulant+ application received. Training is mandatory. Sign in to schedule & pay: ${onboardingLink} ` +
        `After payment, starter kit ships & tracking will be sent.`;
      sendSms(normalizedPhone, sms).catch(console.error);
    }

    return json(
      {
        ok: true,
        clinician: {
          id: clinician.id,
          status: clinician.status,
          userId: clinician.userId,
          specialty: clinician.specialty,
          patientAccount: clinician.patientAccount ?? null,
        },
        redirectTo: '/auth/login?reason=signup_success',
      },
      201,
    );
  } catch (err: any) {
    console.error('signup POST error', err);
    return json({ ok: false, error: 'Unable to process your clinician application right now. Please try again shortly.' }, 500);
  }
}


