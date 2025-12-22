// apps/clinician-app/app/api/uploads/scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/src/lib/prisma';
import { authorizeAdminFromHeaders } from '@/src/lib/auth';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

export const runtime = 'nodejs';

async function downloadS3ToFile(key: string, outPath: string) {
  const cmd = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
  const res = await s3.send(cmd);
  const stream = (res.Body as any);
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outPath);
    stream.pipe(writeStream);
    stream.on('error', reject);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

function runClamScan(filePath: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // run clamscan with --no-summary to get concise output
    const proc = spawn('clamscan', ['--no-summary', filePath]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => resolve({ exitCode: code ?? 0, stdout, stderr }));
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeAdminFromHeaders(req.headers);
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const body = await req.json().catch(() => ({} as any));
    const key = body?.key ?? body?.s3Key;
    if (!key) return NextResponse.json({ ok: false, error: 'key required' }, { status: 400 });

    // Mark scanStatus = SCANNING in DB if record exists
    try {
      await prisma.clinicianFile.updateMany({ where: { s3Key: key }, data: { scanStatus: 'SCANNING' as any } });
    } catch (e) {
      console.warn('scan: updateMany failed', e);
    }

    // Download object
    const tmpDir = process.env.TMPDIR || '/tmp';
    const outPath = path.join(tmpDir, `scan-${Date.now()}-${Math.random().toString(36).slice(2,6)}`);
    await downloadS3ToFile(key, outPath);

    // Run clamscan (must be installed). If not available, mark FAILED.
    try {
      const result = await runClamScan(outPath);
      // Parse result: clamscan prints "<file>: OK" or "<file>: <virusname> FOUND"
      const stdout = result.stdout || '';
      let scanStatus: any = 'FAILED';
      let report: any = { stdout, stderr: result.stderr || '', exitCode: result.exitCode };

      if (/OK$/m.test(stdout)) {
        scanStatus = 'CLEAN';
      } else if (/FOUND$/m.test(stdout)) {
        scanStatus = 'INFECTED';
      } else {
        scanStatus = 'FAILED';
      }

      // update DB
      try {
        await prisma.clinicianFile.updateMany({
          where: { s3Key: key },
          data: { scanStatus, scanReport: report, verified: scanStatus === 'CLEAN' },
        });
      } catch (e) {
        console.warn('scan: prisma update failed', e);
      }

      // cleanup
      try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }

      return NextResponse.json({ ok: true, s3Key: key, scanStatus, report });
    } catch (scanErr: any) {
      console.error('scan error', scanErr);
      try {
        await prisma.clinicianFile.updateMany({ where: { s3Key: key }, data: { scanStatus: 'FAILED', scanReport: { error: String(scanErr) } } });
      } catch (e) { /* ignore */ }
      try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
      return NextResponse.json({ ok: false, error: 'scan_failed', details: String(scanErr) }, { status: 500 });
    }
  } catch (err: any) {
    console.error('uploads/scan error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
