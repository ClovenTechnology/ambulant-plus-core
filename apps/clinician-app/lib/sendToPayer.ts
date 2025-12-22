// apps/clinician-app/lib/sendToPayer.ts

export type DiagnosisInput = {
  code?: string | null;
  text: string;
};

export type ServiceLineInput = {
  kind: 'consult' | 'med' | 'lab' | 'procedure' | 'other';
  code?: string | null;
  description: string;
  quantity?: number | null;
  unitPriceZar?: number | null;
  icd10?: string | null;
  modifiers?: string[];
};

export type BuildSendToPayerInput = {
  encounterId: string;

  patient: {
    id: string;
    name: string;
    dob?: string | null;
    gender?: string | null;
  };

  clinician: {
    id: string;
    name: string;
  };

  diagnoses?: DiagnosisInput | DiagnosisInput[];

  /** Single consult line, if you want to separate it explicitly */
  consult?: {
    tariffCode?: string | null;
    description?: string | null;
    amountZar?: number | null;
  };

  /** Medications from eRx (very close to your RxRow) */
  meds?: Array<{
    drug: string;
    dose?: string;
    route?: string;
    freq?: string;
    duration?: string;
    qty?: string;
    refills?: number;
    icd10?: string;
    unitPriceZar?: number | null;
  }>;

  /** Lab rows from eRx / lab composer */
  labs?: Array<{
    test: string;
    priority?: '' | 'Routine' | 'Urgent' | 'Stat';
    specimen?: string;
    icd?: string;
    instructions?: string;
    unitPriceZar?: number | null;
  }>;

  startedAt?: string | null;
  endedAt?: string | null;
  notes?: string | null;

  payerRouting?: {
    payerId?: string | null;
    planId?: string | null;
    benefitType?: string | null;
  };
};

export type SendToPayerPayload = {
  schemaVersion: '1.0';
  source: {
    system: 'clinician-app';
    channel: 'sfu';
  };
  encounter: {
    id: string;
    startedAt?: string | null;
    endedAt?: string | null;
    diagnoses: DiagnosisInput[];
    notes?: string | null;
  };
  patient: {
    id: string;
    name: string;
    dob?: string | null;
    gender?: string | null;
  };
  clinician: {
    id: string;
    name: string;
  };
  financial: {
    currency: 'ZAR';
    totalAmountZar: number | null;
    lines: Array<{
      lineId: string;
      kind: ServiceLineInput['kind'];
      code?: string | null;
      description: string;
      quantity?: number | null;
      unitPriceZar?: number | null;
      amountZar?: number | null;
      icd10?: string | null;
      modifiers?: string[];
    }>;
  };
  meta: {
    submittedAt: string;
    payerRouting?: BuildSendToPayerInput['payerRouting'];
  };
};

/**
 * Build a normalized payload that the gateway’s /send-to-payer endpoint can consume.
 *
 * You can call this both from API routes (server) and from unit tests.
 */
export function buildSendToPayerPayload(input: BuildSendToPayerInput): SendToPayerPayload {
  const {
    encounterId,
    patient,
    clinician,
    diagnoses,
    consult,
    meds = [],
    labs = [],
    startedAt,
    endedAt,
    notes,
    payerRouting,
  } = input;

  const diagArray: DiagnosisInput[] = Array.isArray(diagnoses)
    ? diagnoses
    : diagnoses
    ? [diagnoses]
    : [];

  const lines: SendToPayerPayload['financial']['lines'] = [];

  // 1) Consult line
  if (consult?.amountZar != null && consult.amountZar > 0) {
    lines.push({
      lineId: `consult-${encounterId}`,
      kind: 'consult',
      code: consult.tariffCode ?? null,
      description: consult.description || 'Telehealth consultation',
      quantity: 1,
      unitPriceZar: consult.amountZar,
      amountZar: consult.amountZar,
      icd10: diagArray[0]?.code ?? null,
      modifiers: [],
    });
  }

  // 2) Medication lines
  meds.forEach((m, idx) => {
    const q = m.qty ? Number(m.qty) || 1 : 1;
    const unit = m.unitPriceZar ?? null;
    const amount = unit != null ? unit * q : null;
    const descParts = [m.drug, m.dose, m.route, m.freq, m.duration].filter(Boolean);
    lines.push({
      lineId: `med-${encounterId}-${idx}`,
      kind: 'med',
      code: null, // could be NAPPI / RxCUI later
      description: descParts.join(' · ') || m.drug,
      quantity: q,
      unitPriceZar: unit,
      amountZar: amount,
      icd10: m.icd10 ?? diagArray[0]?.code ?? null,
      modifiers: [],
    });
  });

  // 3) Lab lines
  labs.forEach((l, idx) => {
    const unit = l.unitPriceZar ?? null;
    const amount = unit != null ? unit : null;
    const descParts = [l.test, l.priority, l.specimen].filter(Boolean);
    lines.push({
      lineId: `lab-${encounterId}-${idx}`,
      kind: 'lab',
      code: null, // LOINC / lab code later
      description: descParts.join(' · ') || l.test,
      quantity: 1,
      unitPriceZar: unit,
      amountZar: amount,
      icd10: l.icd || diagArray[0]?.code ?? null,
      modifiers: [],
    });
  });

  const totalAmountZar =
    lines.length === 0
      ? null
      : lines.reduce((sum, l) => sum + (l.amountZar ?? 0), 0);

  return {
    schemaVersion: '1.0',
    source: {
      system: 'clinician-app',
      channel: 'sfu',
    },
    encounter: {
      id: encounterId,
      startedAt: startedAt ?? null,
      endedAt: endedAt ?? null,
      diagnoses: diagArray,
      notes: notes ?? null,
    },
    patient: {
      id: patient.id,
      name: patient.name,
      dob: patient.dob ?? null,
      gender: patient.gender ?? null,
    },
    clinician: {
      id: clinician.id,
      name: clinician.name,
    },
    financial: {
      currency: 'ZAR',
      totalAmountZar,
      lines,
    },
    meta: {
      submittedAt: new Date().toISOString(),
      payerRouting,
    },
  };
}
