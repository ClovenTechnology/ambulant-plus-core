// file: apps/clinician-app/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import formidable from 'formidable';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { prisma } from '@/src/lib/prisma';
import { sendEmail, sendSms } from '@/src/lib/mailer';

// --- runtime settings ---
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Auth0 helper ---
async function createAuth0User(email: string, name?: string, password?: string) {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) return { ok: false, error: 'missing_auth0' };

  try {
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
    if (!tokenRes.ok) return { ok: false, error: 'token_fetch_failed' };
    const tokenData = await tokenRes.json();
    const mgmtToken = tokenData.access_token;

    const createRes = await fetch(`https://${domain}/api/v2/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mgmtToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        connection: 'Username-Password-Authentication',
        email,
        name,
        password: password ?? `${Math.random().toString(36).slice(2)}A!1`,
        email_verified: false,
      }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => '');
      return { ok: false, error: `create_failed:${createRes.status}`, info: txt };
    }

    const data = await createRes.json();
    return { ok: true, user: data };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}

// --- S3 upload setup ---
const s3client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

async function uploadFileToS3Stream(filePath: string, destKey: string, contentType?: string) {
  const fs = await import('fs');
  const stream = fs.createReadStream(filePath);
  const upload = new Upload({
    client: s3client,
    params: {
      Bucket: process.env.S3_BUCKET!,
      Key: destKey,
      Body: stream,
      ContentType: contentType || 'application/octet-stream',
      ACL: 'private',
    },
  });
  return await upload.done();
}

// --- POST handler ---
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // ✅ multipart: handle file upload
    if (contentType.includes('multipart/form-data')) {
      const form = new formidable.IncomingForm({
        keepExtensions: true,
        multiples: false,
        maxFileSize: 30 * 1024 * 1024,
      });

      // Parse formdata into fields/files
      const parsed: any = await new Promise((resolve, reject) => {
        req.arrayBuffer().then((buf) => {
          const buffer = Buffer.from(buf);
          const { Readable } = require('stream');
          const stream = new Readable();
          stream.push(buffer);
          stream.push(null);
          form.on('error', reject);
          form.parse(stream as any, (err, fields, files) => {
            if (err) reject(err);
            else resolve({ fields, files });
          });
        }).catch(reject);
      });

      const fields = parsed.fields || {};
      const files = parsed.files || {};
      const name = fields.name ?? '';
      const email = fields.email ?? '';
      const password = fields.password ?? '';
      const phone = fields.phone ?? '';
      const specialty = fields.specialty ?? '';
      const profile = fields.profile ? JSON.parse(fields.profile) : {};

      // upload optional HPCSA document
      let hpcsaS3Key: string | null = null;
      let hpcsaFileMeta: any = null;
      if (files.hpcsaDoc) {
        const f = files.hpcsaDoc;
        const originalFilename = f.originalFilename || f.name || `upload-${Date.now()}`;
        const safeName = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const key = `uploads/hpcsa/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
        await uploadFileToS3Stream(f.filepath || f.path || f.file, key, f.mimetype || f.type);
        hpcsaS3Key = key;
        hpcsaFileMeta = {
          filename: originalFilename,
          size: Number(f.size || 0),
          mime: f.mimetype || f.type || 'application/octet-stream',
          s3Key: key,
        };
      }

      // create Auth0 user
      let auth0UserId: string | undefined;
      if (email) {
        const authRes = await createAuth0User(String(email), String(name), String(password));
        if (authRes.ok && authRes.user?.user_id) auth0UserId = authRes.user.user_id;
        else console.warn('Auth0 create failed', authRes);
      }

      // persist to Prisma
      let rec: any = null;
      try {
        const p = await prisma.clinicianProfile.create({
          data: {
            userId: auth0UserId ?? (email || phone || `anon-${Date.now()}`),
            displayName: String(name),
            specialty: String(specialty || profile.specialty || ''),
            status: 'pending',
            metadata: {
              create: {
                rawProfileJson: JSON.stringify(profile),
                hpcsaS3Key,
                hpcsaFileMeta: hpcsaFileMeta ? JSON.stringify(hpcsaFileMeta) : undefined,
                hpcsaNextRenewalDate: profile?.hpcsaNextRenewalDate || null,
                insurerName: profile?.insurerName || null,
                insuranceType: profile?.insuranceType || null,
              },
            },
          },
          include: { metadata: true },
        });
        rec = p;
      } catch (err) {
        console.warn('Prisma create failed, fallback record', err);
        const id = `c-${Math.random().toString(36).slice(2)}`;
        rec = { id, userId: email ?? id, displayName: name, specialty, status: 'pending' };
      }

      // ✅ Send training invite
      const trainingLink = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/training/schedule?clinicianId=${encodeURIComponent(rec.id ?? rec.userId ?? '')}`;
      if (email) {
        const subject = 'Ambulant+ Registration Successful — Welcome onboard!';
        const html = `
          <p>Hi ${name || ''},</p>
          <p>Thanks for signing up. Please complete your mandatory training to start practicing on Ambulant+.</p>
          <p><a href="${trainingLink}">👉 Schedule your training session</a></p>
          <p>If you have any issues, contact support.</p>
        `;
        sendEmail(email, subject, html).catch(console.error);
      }
      if (phone) {
        const sms = `Welcome to Ambulant+. Schedule training: ${trainingLink}`;
        sendSms(phone, sms).catch(console.error);
      }

      return NextResponse.json({ ok: true, clinician: rec }, { status: 201 });
    }

    // ✅ JSON fallback (no file upload)
    const json = await req.json().catch(() => ({}));
    const name = (json.name || '').trim();
    const email = (json.email || '').trim();
    const phone = (json.phone || '').trim();
    const specialty = (json.specialty || '').trim();

    let auth0UserId = json.auth0UserId;
    if (!auth0UserId && email) {
      const authRes = await createAuth0User(email, name, json.password);
      if (authRes.ok && authRes.user?.user_id) auth0UserId = authRes.user.user_id;
    }

    const p = await prisma.clinicianProfile.create({
      data: {
        userId: auth0UserId ?? (email || phone || `anon-${Date.now()}`),
        displayName: name,
        specialty,
        status: 'pending',
      },
    });

    // Send training invite
    const trainingLink = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/training/schedule?clinicianId=${encodeURIComponent(p.id ?? p.userId ?? '')}`;
    if (email) {
      const subject = 'Ambulant+ Registration Successful — Welcome onboard!';
      const html = `
        <p>Hi ${name || ''},</p>
        <p>Thanks for signing up. Please complete your mandatory training.</p>
        <p><a href="${trainingLink}">👉 Schedule training</a></p>
      `;
      sendEmail(email, subject, html).catch(console.error);
    }
    if (phone) {
      const sms = `Welcome to Ambulant+. Schedule training: ${trainingLink}`;
      sendSms(phone, sms).catch(console.error);
    }

    return NextResponse.json({ ok: true, clinician: p }, { status: 201 });
  } catch (err: any) {
    console.error('signup POST error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
