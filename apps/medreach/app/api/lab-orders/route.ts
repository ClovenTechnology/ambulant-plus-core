// apps/medreach/app/api/lab-orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { JobStatus } from '@shared/fsm';

// Structured per-test result attached to an order
export type LabTestResultFlag = 'LOW' | 'NORMAL' | 'HIGH' | 'ABNORMAL' | 'UNSPECIFIED';

export type LabTestResult = {
  code: string;           // test code, e.g. FBC
  name: string;           // test name
  category?: string;      // e.g. Haematology, Biochemistry, Virology
  sampleType?: string;    // e.g. Serum, Plasma, Whole blood
  value?: string;         // e.g. "6.4"
  units?: string;         // e.g. "mmol/L", "%"
  referenceRange?: string; // free-text range, e.g. "4.0 – 6.0"
  flag?: LabTestResultFlag;
  comments?: string;
};

export type LabResultStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SENT';

export type LabOrder = {
  id: string;
  displayId: string;

  // Assignment / marketplace
  labId?: string | null;
  eligibleLabs: string[];
  declinedByLabs: string[];

  // Logistics (phleb status) – shared FSM
  status: JobStatus;

  // Lab result workflow
  resultStatus: LabResultStatus;
  resultSummary?: string;
  resultPdfUrl?: string;       // optional, for future upload integration
  testResults?: LabTestResult[];

  // Patient + encounter context
  patientId?: string;
  encounterId?: string;
  patientName: string;
  patientDob: string;
  patientGender?: string;
  patientIdentifier?: string;  // e.g. ID/passport
  patientAddress: string;
  patientArea: string;

  // Lab + phleb context
  labNameHint?: string;
  labCityHint?: string;
  phlebId?: string;
  phlebName?: string;

  // Ordered tests (definition)
  tests: { code: string; name: string }[];

  // Timeline
  createdAt: string;
  collectionTime?: string;
  deliveredToLabAt?: string;
  resultReadyAt?: string;
  resultSentAt?: string;

  // Logistics geometry
  distanceKm?: number;
};

// ---- Mock store ----

const initialOrders: LabOrder[] = [
  {
    id: 'lab-order-001',
    displayId: 'MR-LAB-2025-0001',
    labId: undefined,
    eligibleLabs: ['lancet-cresta', 'adc-diagnostics-durban'],
    declinedByLabs: [],
    status: 'WAITING_LAB_SELECTION',
    resultStatus: 'PENDING',
    patientName: 'John Doe',
    patientDob: '1985-04-12',
    patientGender: 'Male',
    patientIdentifier: '8001015009087',
    patientAddress: '12 Oak Street, Cresta',
    patientArea: 'Randburg',
    labNameHint: 'Lancet / ADC (Gauteng)',
    tests: [
      { code: 'FBC', name: 'Full Blood Count' },
      { code: 'CRP', name: 'C-reactive protein' },
    ],
    createdAt: new Date().toISOString(),
    distanceKm: 7.2,
    testResults: [], // none yet
  },
  {
    id: 'lab-order-002',
    displayId: 'MR-LAB-2025-0002',
    labId: 'lancet-cresta',
    eligibleLabs: ['lancet-cresta'],
    declinedByLabs: [],
    status: 'PHLEB_EN_ROUTE_TO_PATIENT',
    resultStatus: 'PENDING',
    patientName: 'Lerato M',
    patientDob: '1992-11-03',
    patientGender: 'Female',
    patientIdentifier: '9211030456083',
    patientAddress: '45 Main Road, Rosebank',
    patientArea: 'Rosebank',
    labNameHint: 'Lancet Cresta',
    tests: [{ code: 'LFT', name: 'Liver Function Test' }],
    createdAt: new Date().toISOString(),
    distanceKm: 9.8,
    testResults: [],
  },
  {
    id: 'lab-order-003',
    displayId: 'MR-LAB-2025-0003',
    labId: 'adc-diagnostics-durban',
    eligibleLabs: ['adc-diagnostics-durban'],
    declinedByLabs: [],
    status: 'PHLEB_EN_ROUTE_TO_LAB',
    resultStatus: 'IN_PROGRESS',
    patientName: 'Sipho D',
    patientDob: '1978-02-19',
    patientGender: 'Male',
    patientIdentifier: '7802195082081',
    patientAddress: '8 Beach Ave, Umhlanga',
    patientArea: 'Umhlanga',
    labNameHint: 'ADC Diagnostics Durban',
    phlebId: 'lerato-k',
    phlebName: 'Lerato K.',
    tests: [
      { code: 'U&E', name: 'Urea & Electrolytes' },
      { code: 'LIP', name: 'Lipid Profile' },
    ],
    createdAt: new Date().toISOString(),
    collectionTime: new Date().toISOString(),
    distanceKm: 5.4,
    testResults: [],
  },
  {
    id: 'lab-order-004',
    displayId: 'MR-LAB-2025-0004',
    labId: 'adc-diagnostics-durban',
    eligibleLabs: ['adc-diagnostics-durban'],
    declinedByLabs: [],
    status: 'DELIVERED_TO_LAB',
    resultStatus: 'READY',
    patientName: 'Naledi P',
    patientDob: '2000-09-01',
    patientGender: 'Female',
    patientIdentifier: '0009010250087',
    patientAddress: '17 Lagoon St, Durban North',
    patientArea: 'Durban North',
    labNameHint: 'ADC Diagnostics Durban',
    phlebId: 'lerato-k',
    phlebName: 'Lerato K.',
    tests: [{ code: 'HBA1C', name: 'HbA1c' }],
    createdAt: new Date().toISOString(),
    deliveredToLabAt: new Date().toISOString(),
    distanceKm: 3.2,
    resultSummary: 'HbA1c mildly elevated. Recommend lifestyle modification and repeat in 3 months.',
    resultPdfUrl: undefined, // would be generated later by MedReach report print-to-PDF
    resultReadyAt: new Date().toISOString(),
    testResults: [
      {
        code: 'HBA1C',
        name: 'HbA1c',
        category: 'Biochemistry',
        sampleType: 'Whole blood',
        value: '6.4',
        units: '%',
        referenceRange: '< 5.7%',
        flag: 'HIGH',
        comments: 'Borderline high. Correlate with fasting glucose and clinical picture.',
      },
    ],
  },
];

const ordersStore: Record<string, LabOrder> = {};
for (const o of initialOrders) {
  ordersStore[o.id] = { ...o };
}

function getGatewayBase() {
  return process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL || null;
}

type LabOrdersResponse = {
  labId: string;
  assigned: LabOrder[];
  marketplace: LabOrder[];
};

// ---- GET: list orders for a lab ----

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const labId = searchParams.get('labId');
  if (!labId) {
    return NextResponse.json(
      { error: 'Missing labId' },
      { status: 400 },
    );
  }

  const gatewayBase = getGatewayBase();
  if (gatewayBase) {
    try {
      const upstreamUrl = new URL(
        `/medreach/labs/${encodeURIComponent(labId)}/orders`,
        gatewayBase,
      );
      const upstream = await fetch(upstreamUrl.toString(), {
        cache: 'no-store',
      });
      if (upstream.ok) {
        const data = await upstream.json();
        return NextResponse.json(data);
      }
      console.error('Gateway lab-orders GET failed:', upstream.status);
    } catch (e) {
      console.error('Gateway lab-orders GET error:', e);
    }
  }

  const all = Object.values(ordersStore);

  const assigned = all.filter((o) => o.labId === labId);

  const marketplace = all.filter(
    (o) =>
      (!o.labId || o.labId === null || o.labId === '') &&
      o.eligibleLabs.includes(labId) &&
      !o.declinedByLabs.includes(labId),
  );

  const payload: LabOrdersResponse = {
    labId,
    assigned,
    marketplace,
  };

  return NextResponse.json(payload);
}

// ---- PATCH: mutate order (accept, decline, status, results) ----

type PatchBody =
  | {
      orderId: string;
      action: 'accept';
      labId: string;
    }
  | {
      orderId: string;
      action: 'decline';
      labId: string;
    }
  | {
      orderId: string;
      action: 'updateStatus';
      status: JobStatus;
    }
  | {
      orderId: string;
      action: 'updateResult';
      resultStatus: LabResultStatus;
      resultSummary?: string;
      resultPdfUrl?: string;
      testResults?: LabTestResult[];
    };

export async function PATCH(req: NextRequest) {
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const order = ordersStore[body.orderId];
  if (!order) {
    return NextResponse.json(
      { error: 'Order not found' },
      { status: 404 },
    );
  }

  switch (body.action) {
    case 'accept': {
      order.labId = body.labId;
      if (order.status === 'WAITING_LAB_SELECTION') {
        order.status = 'WAITING_PHLEB';
      }
      break;
    }
    case 'decline': {
      if (!order.declinedByLabs.includes(body.labId)) {
        order.declinedByLabs.push(body.labId);
      }
      break;
    }
    case 'updateStatus': {
      order.status = body.status;
      if (body.status === 'DELIVERED_TO_LAB') {
        order.deliveredToLabAt = new Date().toISOString();
      }
      break;
    }
    case 'updateResult': {
      order.resultStatus = body.resultStatus;
      if (typeof body.resultSummary === 'string') {
        order.resultSummary = body.resultSummary;
      }
      if (typeof body.resultPdfUrl === 'string') {
        order.resultPdfUrl = body.resultPdfUrl;
      }
      if (Array.isArray(body.testResults)) {
        order.testResults = body.testResults;
      }
      const nowIso = new Date().toISOString();
      if (body.resultStatus === 'READY') {
        order.resultReadyAt = nowIso;
      }
      if (body.resultStatus === 'SENT') {
        order.resultSentAt = nowIso;
      }
      break;
    }
    default:
      return NextResponse.json(
        { error: 'Unsupported action' },
        { status: 400 },
      );
  }

  const gatewayBase = getGatewayBase();
  if (gatewayBase) {
    try {
      const url = new URL(
        `/medreach/labs/orders/${encodeURIComponent(order.id)}`,
        gatewayBase,
      );
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((e) => {
        console.error('Gateway lab-orders PATCH error:', e);
      });
    } catch (e) {
      console.error('Gateway lab-orders PATCH exception:', e);
    }
  }

  return NextResponse.json(order);
}
