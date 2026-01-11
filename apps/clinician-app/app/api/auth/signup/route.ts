// apps/clinician-app/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
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

function getBaseUrl(req: NextRequest) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.trim()) return envBase.trim().replace(/\/+$/, '');
  return req.nextUrl.origin;
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
    return { ok: false as const, error: String(err) as const };
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

    if (!name) return json({ ok: false, error: 'Full name required' }, 400);
    if (!email) return json({ ok: false, error: 'Email required' }, 400);
    if (!password || password.length < 8)
      return json({ ok: false, error: 'Password must be at least 8 characters' }, 400);
    if (!specialty) return json({ ok: false, error: 'Specialty required' }, 400);

    let profile: any = {};
    try {
      profile = JSON.parse(profileRaw || '{}');
    } catch {
      profile = {};
    }

    // Optional HPCSA upload
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
        // keep non-fatal: allow signup even if S3 not configured
        hpcsaFileMeta = {
          filename: hpcsaFile.name,
          size: Number(hpcsaFile.size || 0),
          mime: hpcsaFile.type || 'application/octet-stream',
          upload: 'skipped',
          reason: up.error,
        };
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
      email,
      phone,
      license: license || undefined,
      auth0UserId: auth0UserId || undefined,
      submittedAt,
    };

    // Map core regulator fields (best-effort; no guessing beyond what's provided)
    const regulatorBody = safeStr(profile?.regulatorBody) || safeStr(profile?.regulator) || (license ? 'HPCSA' : '');
    const regulatorRegistration = license || safeStr(profile?.regulatorRegistration) || safeStr(profile?.registrationNumber);

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
            phone: phone || null,

            // best-effort mapping (won’t break if empty)
            regulatorBody: regulatorBody || null,
            regulatorRegistration: regulatorRegistration || null,

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
                  status: regulatorBody && regulatorRegistration ? 'submitted' : 'missing',
                  submittedAt,
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

        return created;
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
      const subject = 'Ambulant+ Clinician Application Received — Next Steps';
      const html = `
        <p>Hi ${name || 'Clinician'},</p>
        <p>Your Ambulant+ clinician application has been received.</p>

        <p><strong>Mandatory onboarding:</strong></p>
        <ol>
          <li><strong>Training scheduling + payment</strong> (required)</li>
          <li><strong>Starter kit dispatch</strong> after payment confirmation</li>
          <li><strong>Admin certification</strong> — only then your profile becomes visible to patients</li>
        </ol>

        <p><a href="${onboardingLink}">👉 Sign in to continue onboarding</a></p>

        <p style="margin-top:12px;"><strong>Starter kit contents</strong> (sent after payment):</p>
        <ul>
          <li>All four IoMTs</li>
          <li>Clinician Handbook + consumables</li>
          <li>Merchandise: branded formal shirts (black &amp; white), mug, thermo bottle</li>
          <li>Smart ID with card holder + lanyard</li>
        </ul>

        <p>When the admin assigns courier + tracking, you will receive tracking details by email and SMS.</p>

        <p style="margin-top:12px;">If you didn’t request this, you can ignore this email.</p>
        <p>— Ambulant+ Team</p>
      `;
      sendEmail(email, subject, html).catch(console.error);
    }

    if (phone) {
      const sms =
        `Ambulant+ application received. Training is mandatory. Sign in to schedule & pay: ${onboardingLink} ` +
        `After payment, starter kit ships & tracking will be sent.`;
      sendSms(phone, sms).catch(console.error);
    }

    return json(
      {
        ok: true,
        clinician: {
          id: clinician.id,
          status: clinician.status,
          userId: clinician.userId,
          specialty: clinician.specialty,
        },
        redirectTo: '/auth/login?reason=signup_success',
      },
      201,
    );
  } catch (err: any) {
    console.error('signup POST error', err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}
