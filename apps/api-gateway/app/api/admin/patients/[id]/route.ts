import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { verifyAdminRequest } from '../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function safeMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdminRequest(req);
  if (!admin.ok) return admin.response;

  const id = decodeURIComponent(String(params.id || '')).trim();
  if (!id) return json({ ok: false, error: 'patient_id_required' }, 400);

  try {
    const profile = await prisma.patientProfile.findFirst({
      where: { OR: [{ id }, { userId: id }, { mrn: id }] },
    });

    if (!profile) return json({ ok: false, error: 'patient_not_found' }, 404);

    const keys = [profile.id, profile.userId].filter((value): value is string => Boolean(value));
    const [appointments, devices, medicalAidPolicies] = await Promise.all([
      prisma.appointment.findMany({
        where: { OR: [{ patientId: { in: keys } }, { subjectPatientId: { in: keys } }, { hostUserId: { in: keys } }] },
        select: {
          id: true, encounterId: true, clinicianId: true, patientId: true,
          subjectPatientId: true, roomId: true, reason: true, startsAt: true,
          endsAt: true, status: true, paymentStatus: true, paymentMethod: true,
          bookingSource: true, priceCents: true, amountMinor: true,
          totalMinor: true, patientCopayMinor: true, currency: true,
          createdAt: true, updatedAt: true,
        },
        orderBy: { startsAt: 'desc' },
        take: 100,
      }),
      prisma.device.findMany({
        where: { patientId: { in: keys } },
        select: { id: true, deviceId: true, patientId: true, vendor: true, category: true, model: true, roomId: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.medicalAidPolicy.findMany({
        where: { patientId: profile.id },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
      }),
    ]);

    const now = Date.now();
    const upcomingAppointments = appointments.filter((item) => item.startsAt.getTime() >= now).length;
    const pastAppointments = appointments.length - upcomingAppointments;
    const paymentPendingAppointments = appointments.filter((item) => String(item.paymentStatus).toLowerCase() === 'pending').length;
    const totalSpendMinor = appointments.reduce((sum, item) => sum + Number(item.totalMinor ?? item.amountMinor ?? item.priceCents ?? 0), 0);
    const meta = safeMeta(profile.profileMetadata);

    const patient = {
      ...profile,
      email: profile.contactEmail,
      avatarUrl: profile.photoUrl,
      totalAppointments: appointments.length,
      upcomingAppointments,
      pastAppointments,
      paymentPendingAppointments,
      lastSeenAt: appointments[0]?.startsAt ?? null,
      deviceCount: devices.length,
      hasDevices: devices.length > 0,
      deviceTypes: Array.from(new Set(devices.map((item) => item.category || item.model).filter(Boolean))),
      medicalAidCount: medicalAidPolicies.length,
      hasMedicalAid: medicalAidPolicies.length > 0,
      totalSpendMinor,
      currency: appointments[0]?.currency || 'ZAR',
      riskLevel: meta.riskLevel || meta.risk || 'low',
      appointments,
      devices,
      medicalAidPolicies,
    };

    return json({ ok: true, patient });
  } catch (error: any) {
    console.error('admin patient detail error', error);
    return json({ ok: false, error: error?.message || 'patient_detail_load_failed' }, 500);
  }
}
