// apps/medreach/app/api/phleb-jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { JobStatus } from '@shared/fsm';
import { rankPhlebsForOrder, distanceKm } from '@/lib/matching';
import type { LabOrderForMatching, PhlebForMatching } from '@/lib/matching';

export type PhlebJobStatus = JobStatus;

export type PhlebJob = {
  id: string;
  displayId: string;
  status: PhlebJobStatus;
  priority: 'normal' | 'urgent';
  patientName: string;
  patientDob: string;
  patientAddress: string;
  patientArea: string;
  labId: string;
  labName: string;
  createdAt: string;
  scheduledFor?: string;
  distanceKm?: number;
  etaMinutes?: number;
};

// Mock phlebs for matching – in real system, query central backend
const PHLEBS: PhlebForMatching[] = [
  {
    id: 'thabo-m',
    fullName: 'Thabo M.',
    active: true,
    homeBase: { lat: -26.12, lng: 27.98 }, // Randburg-ish
    serviceRadiusKm: 20,
    serviceAreas: ['Randburg', 'Rosebank'],
    preferredLabs: ['lancet-cresta'],
  },
  {
    id: 'lerato-k',
    fullName: 'Lerato K.',
    active: true,
    homeBase: { lat: -29.83, lng: 31.03 }, // Durban / Umhlanga-ish
    serviceRadiusKm: 25,
    serviceAreas: ['Umhlanga', 'Durban North'],
    preferredLabs: ['adc-diagnostics-durban'],
  },
  {
    id: 'siphiwe-d',
    fullName: 'Siphiwe D.',
    active: false,
    homeBase: { lat: -33.92, lng: 18.42 }, // Cape Town
    serviceRadiusKm: 15,
    serviceAreas: ['City Bowl'],
    preferredLabs: ['pathcare-city-bowl'],
  },
];

type OrderRecord = LabOrderForMatching & {
  displayId: string;
  priority: 'normal' | 'urgent';
  status: JobStatus;
  patientName: string;
  patientDob: string;
  patientAddress: string;
  labName: string;
  createdAt: string;
  scheduledFor?: string;
  assignedPhlebId?: string;
};

// Mock orders
const ORDERS: OrderRecord[] = [
  {
    id: 'order-001',
    displayId: 'MR-2025-0001',
    priority: 'urgent',
    status: 'WAITING_PHLEB',
    patientName: 'John Doe',
    patientDob: '1985-04-12',
    patientAddress: '12 Oak Street, Cresta',
    patientArea: 'Randburg',
    patientLocation: { lat: -26.13, lng: 27.97 },
    labId: 'lancet-cresta',
    labName: 'Lancet Cresta',
    createdAt: new Date().toISOString(),
    scheduledFor: new Date().toISOString(),
  },
  {
    id: 'order-002',
    displayId: 'MR-2025-0002',
    priority: 'normal',
    status: 'WAITING_PHLEB',
    patientName: 'Lerato M',
    patientDob: '1992-11-03',
    patientAddress: '45 Main Road, Rosebank',
    patientArea: 'Rosebank',
    patientLocation: { lat: -26.14, lng: 28.04 },
    labId: 'lancet-cresta',
    labName: 'Lancet Cresta',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order-003',
    displayId: 'MR-2025-0003',
    priority: 'normal',
    status: 'PHLEB_EN_ROUTE_TO_PATIENT',
    patientName: 'Sipho D',
    patientDob: '1978-02-19',
    patientAddress: '8 Beach Ave, Umhlanga',
    patientArea: 'Umhlanga',
    patientLocation: { lat: -29.73, lng: 31.05 },
    labId: 'adc-diagnostics-durban',
    labName: 'ADC Diagnostics Durban',
    createdAt: new Date().toISOString(),
    assignedPhlebId: 'lerato-k',
  },
  {
    id: 'order-004',
    displayId: 'MR-2025-0004',
    priority: 'urgent',
    status: 'SAMPLING_IN_PROGRESS',
    patientName: 'Naledi P',
    patientDob: '2000-09-01',
    patientAddress: '17 Lagoon St, Durban North',
    patientArea: 'Durban North',
    patientLocation: { lat: -29.78, lng: 31.02 },
    labId: 'adc-diagnostics-durban',
    labName: 'ADC Diagnostics Durban',
    createdAt: new Date().toISOString(),
    assignedPhlebId: 'lerato-k',
  },
  {
    id: 'order-005',
    displayId: 'MR-2025-0005',
    priority: 'normal',
    status: 'PHLEB_EN_ROUTE_TO_LAB',
    patientName: 'Kabelo S',
    patientDob: '1969-12-30',
    patientAddress: '22 Hill Rd, City Bowl',
    patientArea: 'City Bowl',
    patientLocation: { lat: -33.93, lng: 18.41 },
    labId: 'pathcare-city-bowl',
    labName: 'PathCare City Bowl',
    createdAt: new Date().toISOString(),
    assignedPhlebId: 'siphiwe-d',
  },
  {
    id: 'order-006',
    displayId: 'MR-2025-0006',
    priority: 'normal',
    status: 'DELIVERED_TO_LAB',
    patientName: 'Amy N',
    patientDob: '1999-05-25',
    patientAddress: '3 Smith St, City Bowl',
    patientArea: 'City Bowl',
    patientLocation: { lat: -33.92, lng: 18.42 },
    labId: 'pathcare-city-bowl',
    labName: 'PathCare City Bowl',
    createdAt: new Date().toISOString(),
    assignedPhlebId: 'siphiwe-d',
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phlebId = searchParams.get('phlebId') ?? 'thabo-m';

  const phleb = PHLEBS.find((p) => p.id === phlebId);
  if (!phleb) {
    return NextResponse.json({ jobs: [] });
  }

  const jobsForPhleb: PhlebJob[] = [];

  for (const order of ORDERS) {
    if (order.status === 'WAITING_LAB_SELECTION') continue;

    if (order.assignedPhlebId && order.assignedPhlebId !== phlebId) {
      continue;
    }

    let distance: number | undefined;
    let etaMinutes: number | undefined;

    if (order.status === 'WAITING_PHLEB') {
      if (!order.labId) continue;

      const ranked = rankPhlebsForOrder(
        {
          id: order.id,
          labId: order.labId,
          patientLocation: order.patientLocation,
          patientArea: order.patientArea,
        },
        PHLEBS,
        20,
      );
      const match = ranked.find((r) => r.phleb.id === phlebId);
      if (!match) {
        continue;
      }

      distance = match.distanceKm;
      etaMinutes = Math.round(match.distanceKm * 3 + 5);
    } else if (phleb.homeBase) {
      distance = distanceKm(order.patientLocation, phleb.homeBase);
      etaMinutes = Math.round(distance * 3 + 5);
    }

    jobsForPhleb.push({
      id: order.id,
      displayId: order.displayId,
      status: order.status,
      priority: order.priority,
      patientName: order.patientName,
      patientDob: order.patientDob,
      patientAddress: order.patientAddress,
      patientArea: order.patientArea ?? '',
      labId: order.labId ?? '',
      labName: order.labName,
      createdAt: order.createdAt,
      scheduledFor: order.scheduledFor,
      distanceKm: distance,
      etaMinutes,
    });
  }

  jobsForPhleb.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === 'urgent' ? -1 : 1;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return NextResponse.json({ jobs: jobsForPhleb });
}
