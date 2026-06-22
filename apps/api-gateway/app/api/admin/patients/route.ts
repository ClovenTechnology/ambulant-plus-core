
// apps/api-gateway/app/api/admin/patients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZES = new Set([10, 20, 50, 100, 200]);

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-admin-key,x-role,x-uid,x-org-id,x-ambulant-identity',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-admin-key,x-role,x-uid,x-org-id,x-ambulant-identity',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function toPosInt(value: string | null, fallback: number) {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function toPageSize(value: string | null, fallback = 50) {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  return PAGE_SIZES.has(n) ? n : fallback;
}

function iso(value: any) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

function daysSince(value: any) {
  const t = Date.parse(String(value || ''));
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function safeMeta(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.map((v) => clean(v)).filter(Boolean)));
}

function hasText(haystack: unknown, needle: string) {
  if (!needle) return true;
  return String(haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

function patientKeys(p: any) {
  return unique([p?.id, p?.userId]);
}

function appointmentKeys(a: any) {
  return unique([a?.patientId, a?.subjectPatientId, a?.hostUserId]);
}

function isSimulationAppointment(a: any) {
  const meta = safeMeta(a?.meta);
  const ids = [a?.id, a?.patientId, a?.subjectPatientId, a?.hostUserId, a?.roomId, a?.encounterId];
  if (ids.some((v) => String(v || '').startsWith('sim-') || String(v || '').startsWith('simulation-'))) return true;

  const source = String(a?.bookingSource || meta.source || '').toLowerCase();
  if (source.includes('simulation')) return true;
  if (meta.simulation === true) return true;

  const reason = String(a?.reason || '').toLowerCase();
  return reason.includes('simulation');
}

function isPaymentPending(a: any) {
  const status = String(a?.status || '').toLowerCase();
  const paymentStatus = String(a?.paymentStatus || '').toLowerCase();
  return (
    status.includes('pending_payment') ||
    status.includes('awaiting_payment') ||
    paymentStatus === 'pending' ||
    paymentStatus === 'pending_payment'
  );
}

function moneyMinor(a: any) {
  const candidates = [a?.totalMinor, a?.amountMinor, a?.priceCents, a?.patientCopayMinor];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return 0;
}

function metaRisk(profile: any, alertCount: number) {
  const meta = safeMeta(profile?.profileMetadata);
  const raw =
    clean(meta.riskLevel) ||
    clean(meta.risk) ||
    clean(meta.healthRisk) ||
    clean(meta.insightRisk);

  const score = Number(meta.riskScore ?? meta.careRiskScore ?? meta.connectedCareSignal);
  const lower = raw.toLowerCase();

  if (alertCount > 0) return 'high';
  if (lower.includes('high') || lower.includes('critical')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  if (Number.isFinite(score)) {
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
  }
  return 'low';
}

function initials(name: string) {
  const parts = clean(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const out = parts.map((p) => p[0]?.toUpperCase()).join('');
  return out || 'P';
}

async function optionalFindMany(model: any, args: any) {
  if (!model || typeof model.findMany !== 'function') return [];
  try {
    return await model.findMany(args);
  } catch {
    return [];
  }
}

function pushMap(map: Map<string, any[]>, keys: string[], value: any) {
  for (const key of keys) {
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(value);
  }
}

function uniqueById(rows: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];

  for (const row of rows) {
    const key = clean(row?.id) || JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function latestDate(rows: any[], fields: string[]) {
  let best: string | null = null;
  for (const row of rows) {
    for (const f of fields) {
      const val = iso(row?.[f]);
      if (!val) continue;
      if (!best || Date.parse(val) > Date.parse(best)) best = val;
    }
  }
  return best;
}

function filterLabel(key: string) {
  const labels: Record<string, string> = {
    all: 'All patients',
    recent: 'Recently onboarded',
    booked: 'Booked patients',
    simulation: 'Simulation patients',
    payment_pending: 'Payment-pending patients',
    high_risk: 'High-risk / InsightCore flagged',
    devices: 'Patients with devices',
    medical_aid: 'Patients with medical aid',
    sponsor_links: 'Patients with sponsor links',
    no_booking: 'No bookings yet',
    no_devices: 'No devices linked',
    incomplete: 'Profile incomplete',
    stale: 'Stale patients',
  };
  return labels[key] || key;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = clean(url.searchParams.get('q'), 120);
    const filter = clean(url.searchParams.get('filter') || 'all', 80) || 'all';
    const sort = clean(url.searchParams.get('sort') || 'created', 40);
    const dir = clean(url.searchParams.get('dir') || 'desc', 4).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const page = toPosInt(url.searchParams.get('page'), 1);
    const pageSize = toPageSize(url.searchParams.get('pageSize'), 50);
    const now = new Date();

    const profiles = await prisma.patientProfile.findMany({
      select: {
        id: true,
        mrn: true,
        userId: true,
        name: true,
        contactEmail: true,
        phone: true,
        primaryComm: true,
        dob: true,
        gender: true,
        city: true,
        postalCode: true,
        heightCm: true,
        weightKg: true,
        photoUrl: true,
        allergies: true,
        emergencyContact: true,
        profileMetadata: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const profileKeys = unique(profiles.flatMap((p) => patientKeys(p)));

    const appointmentWhere = profileKeys.length
      ? {
          OR: [
            { patientId: { in: profileKeys } },
            { subjectPatientId: { in: profileKeys } },
            { hostUserId: { in: profileKeys } },
          ],
        }
      : {};

    const [appointments, devices, medicalAidPolicies] = await Promise.all([
      prisma.appointment.findMany({
        where: appointmentWhere,
        select: {
          id: true,
          encounterId: true,
          patientId: true,
          subjectPatientId: true,
          hostUserId: true,
          clinicianId: true,
          roomId: true,
          reason: true,
          startsAt: true,
          endsAt: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          bookingSource: true,
          priceCents: true,
          amountMinor: true,
          totalMinor: true,
          patientCopayMinor: true,
          currency: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { startsAt: 'desc' },
        take: 12000,
      }),
      prisma.device.findMany({
        where: profileKeys.length ? { patientId: { in: profileKeys } } : {},
        select: {
          id: true,
          deviceId: true,
          patientId: true,
          vendor: true,
          category: true,
          model: true,
          roomId: true,
          createdAt: true,
          updatedAt: true,
        },
        take: 12000,
      }),
      prisma.medicalAidPolicy.findMany({
        where: profileKeys.length ? { patientId: { in: profileKeys } } : {},
        select: {
          id: true,
          patientId: true,
          schemeName: true,
          planName: true,
          membershipNumber: true,
          coversTelemedicine: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
        take: 12000,
      }),
    ]);

    const db: any = prisma as any;

    const sponsorLinks = await optionalFindMany(db.patientSponsorLink, {
      where: profileKeys.length ? { patientId: { in: profileKeys } } : {},
      select: {
        id: true,
        patientId: true,
        clientId: true,
        payerName: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 12000,
    });

    const alertRows: any[] = [];
    for (const modelName of ['insightCoreAlert', 'insightAlert', 'riskAlert', 'clinicalAlert']) {
      const rows = await optionalFindMany(db[modelName], {
        where: profileKeys.length ? { patientId: { in: profileKeys } } : {},
        select: {
          id: true,
          patientId: true,
          severity: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        take: 12000,
      });
      alertRows.push(...rows.map((r: any) => ({ ...r, sourceModel: modelName })));
    }

    const appointmentsByKey = new Map<string, any[]>();
    const devicesByKey = new Map<string, any[]>();
    const policiesByKey = new Map<string, any[]>();
    const sponsorsByKey = new Map<string, any[]>();
    const alertsByKey = new Map<string, any[]>();

    for (const a of appointments) pushMap(appointmentsByKey, appointmentKeys(a), a);
    for (const d of devices) pushMap(devicesByKey, unique([d.patientId]), d);
    for (const p of medicalAidPolicies) pushMap(policiesByKey, unique([p.patientId]), p);
    for (const s of sponsorLinks) pushMap(sponsorsByKey, unique([s.patientId]), s);
    for (const a of alertRows) pushMap(alertsByKey, unique([a.patientId]), a);

    const rows = profiles.map((profile) => {
      const keys = patientKeys(profile);

      const appts = uniqueById(keys.flatMap((k) => appointmentsByKey.get(k) || []));
      const devs = uniqueById(keys.flatMap((k) => devicesByKey.get(k) || []));
      const policies = uniqueById(keys.flatMap((k) => policiesByKey.get(k) || []));
      const sponsors = uniqueById(keys.flatMap((k) => sponsorsByKey.get(k) || []));
      const alerts = uniqueById(keys.flatMap((k) => alertsByKey.get(k) || []));

      const upcomingAppointments = appts.filter((a) => {
        const t = Date.parse(String(a.startsAt || ''));
        return Number.isFinite(t) && t >= now.getTime();
      });

      const pastAppointments = appts.filter((a) => {
        const t = Date.parse(String(a.startsAt || ''));
        return Number.isFinite(t) && t < now.getTime();
      });

      const paymentPendingAppointments = appts.filter(isPaymentPending);
      const simulationAppointments = appts.filter(isSimulationAppointment);

      const lastSeenAt = latestDate(appts, ['startsAt', 'updatedAt', 'createdAt']);
      const lastDeviceSeenAt = latestDate(devs, ['updatedAt', 'createdAt']);
      const riskLevel = metaRisk(profile, alerts.length);

      const missing: string[] = [];
      if (!clean(profile.name)) missing.push('name');
      if (!clean(profile.contactEmail)) missing.push('email');
      if (!clean(profile.phone)) missing.push('phone');
      if (!profile.dob) missing.push('dob');

      const totalSpendMinor = appts.reduce((sum, a) => sum + moneyMinor(a), 0);
      const currency = clean(appts.find((a) => clean(a.currency))?.currency, 3) || 'ZAR';

      const name = clean(profile.name) || 'Patient';

      return {
        id: profile.id,
        patientId: profile.id,
        userId: profile.userId,
        mrn: profile.mrn,
        name,
        displayName: name,
        initials: initials(name),
        email: profile.contactEmail,
        phone: profile.phone,
        gender: profile.gender,
        dob: iso(profile.dob),
        city: profile.city,
        postalCode: profile.postalCode,
        avatarUrl: profile.photoUrl,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        createdAt: iso(profile.createdAt),
        updatedAt: iso(profile.updatedAt),

        totalAppointments: appts.length,
        upcomingAppointments: upcomingAppointments.length,
        pastAppointments: pastAppointments.length,
        paymentPendingAppointments: paymentPendingAppointments.length,
        simulationAppointments: simulationAppointments.length,
        totalSpendMinor,
        currency,

        hasDevices: devs.length > 0,
        deviceCount: devs.length,
        deviceTypes: unique(devs.map((d) => d.category || d.model || d.vendor)).slice(0, 5),
        lastDeviceSeenAt,

        hasMedicalAid: policies.length > 0,
        medicalAidCount: policies.length,
        defaultMedicalAid:
          policies.find((p) => p.isDefault) ||
          policies[0] ||
          null,

        hasSponsorLinks: sponsors.length > 0,
        sponsorLinkCount: sponsors.length,
        sponsorNames: unique(sponsors.map((s) => s.payerName || s.clientId)).slice(0, 5),

        insightAlertCount: alerts.length,
        riskLevel,

        recentlyOnboarded: (daysSince(profile.createdAt) ?? 99999) <= 30,
        profileIncomplete: missing.length > 0,
        missingFields: missing,
        stale: !lastSeenAt || (daysSince(lastSeenAt) ?? 99999) > 90,

        lastSeenAt,
        latestAppointment: appts[0] || null,
        latestAppointmentId: appts[0]?.id || null,
        latestRoomId: appts[0]?.roomId || null,
      };
    });

    const searched = q
      ? rows.filter((r) => {
          return (
            hasText(r.name, q) ||
            hasText(r.email, q) ||
            hasText(r.phone, q) ||
            hasText(r.id, q) ||
            hasText(r.userId, q) ||
            hasText(r.mrn, q) ||
            hasText(r.city, q)
          );
        })
      : rows;

    const filtered = searched.filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'recent') return r.recentlyOnboarded;
      if (filter === 'booked') return r.totalAppointments > 0;
      if (filter === 'simulation') return r.simulationAppointments > 0 || String(r.id).startsWith('sim-');
      if (filter === 'payment_pending') return r.paymentPendingAppointments > 0;
      if (filter === 'high_risk') return r.riskLevel === 'high' || r.insightAlertCount > 0;
      if (filter === 'devices') return r.hasDevices;
      if (filter === 'medical_aid') return r.hasMedicalAid;
      if (filter === 'sponsor_links') return r.hasSponsorLinks;
      if (filter === 'no_booking') return r.totalAppointments === 0;
      if (filter === 'no_devices') return !r.hasDevices;
      if (filter === 'incomplete') return r.profileIncomplete;
      if (filter === 'stale') return r.stale;
      return true;
    });

    filtered.sort((a: any, b: any) => {
      const mult = dir === 'asc' ? 1 : -1;

      if (sort === 'name') return a.name.localeCompare(b.name) * mult;
      if (sort === 'lastSeen') return ((Date.parse(a.lastSeenAt || '1970-01-01') || 0) - (Date.parse(b.lastSeenAt || '1970-01-01') || 0)) * mult;
      if (sort === 'appointments') return (a.totalAppointments - b.totalAppointments) * mult;
      if (sort === 'risk') {
        const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
        return ((rank[a.riskLevel] || 0) - (rank[b.riskLevel] || 0)) * mult;
      }
      if (sort === 'payment') return (a.paymentPendingAppointments - b.paymentPendingAppointments) * mult;

      return ((Date.parse(a.createdAt || '1970-01-01') || 0) - (Date.parse(b.createdAt || '1970-01-01') || 0)) * mult;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    const summary = {
      all: rows.length,
      recent: rows.filter((r) => r.recentlyOnboarded).length,
      booked: rows.filter((r) => r.totalAppointments > 0).length,
      simulation: rows.filter((r) => r.simulationAppointments > 0 || String(r.id).startsWith('sim-')).length,
      payment_pending: rows.filter((r) => r.paymentPendingAppointments > 0).length,
      high_risk: rows.filter((r) => r.riskLevel === 'high' || r.insightAlertCount > 0).length,
      devices: rows.filter((r) => r.hasDevices).length,
      medical_aid: rows.filter((r) => r.hasMedicalAid).length,
      sponsor_links: rows.filter((r) => r.hasSponsorLinks).length,
      no_booking: rows.filter((r) => r.totalAppointments === 0).length,
      no_devices: rows.filter((r) => !r.hasDevices).length,
      incomplete: rows.filter((r) => r.profileIncomplete).length,
      stale: rows.filter((r) => r.stale).length,
    };

    const filterOptions = Object.keys(summary).map((key) => ({
      key,
      label: filterLabel(key),
      count: (summary as any)[key],
    }));

    return json({
      ok: true,
      items,
      patients: items,
      total,
      page,
      pageSize,
      summary,
      filterOptions,
      applied: { q, filter, sort, dir },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[api-gateway][admin/patients.GET] error', err);
    return json({ ok: false, error: err?.message || 'admin_patients_load_failed', items: [] }, 500);
  }
}
