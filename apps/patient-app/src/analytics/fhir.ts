// ============================================================================
// apps/patient-app/src/analytics/fhir.ts
// Extend export with MedicationRequest from eRx.
// ============================================================================
import type { AntenatalLog, VisitItem, AntenatalPrefs, ERx } from './antenatal';

type FhirResource = Record<string, any>;
type FhirEntry = { resource: FhirResource };
export type FhirBundle = { resourceType: 'Bundle'; type: 'collection'; entry: FhirEntry[] };

export function buildFhirBundle(userId: string, prefs: AntenatalPrefs | null, logs: AntenatalLog[], schedule: VisitItem[]): FhirBundle {
  const entries: FhirEntry[] = [];

  logs.forEach((l, i) => {
    if (l.bpSys && l.bpDia) entries.push({ resource: { resourceType:'Observation', id:`bp-${i}`, status:'final',
      code:{ coding:[{ system:'http://loinc.org', code:'85354-9', display:'Blood pressure panel' }]},
      subject:{ reference:`Patient/${userId}` }, effectiveDateTime:`${l.date}T09:00:00Z`,
      component:[
        { code:{ coding:[{ system:'http://loinc.org', code:'8480-6', display:'Systolic blood pressure'}]}, valueQuantity:{ value:l.bpSys, unit:'mmHg' } },
        { code:{ coding:[{ system:'http://loinc.org', code:'8462-4', display:'Diastolic blood pressure'}]}, valueQuantity:{ value:l.bpDia, unit:'mmHg' } },
      ] }});
    if (typeof l.weightKg==='number') entries.push({ resource:{ resourceType:'Observation', id:`wt-${i}`, status:'final',
      code:{ coding:[{ system:'http://loinc.org', code:'29463-7', display:'Body weight' }]}, subject:{ reference:`Patient/${userId}` },
      effectiveDateTime:`${l.date}T09:00:00Z`, valueQuantity:{ value:l.weightKg, unit:'kg' } }});
    if (typeof l.fetalMovements==='number') entries.push({ resource:{ resourceType:'Observation', id:`kick-${i}`, status:'final',
      code:{ coding:[{ system:'http://loinc.org', code:'41950-7', display:'Fetal movement'}]}, subject:{ reference:`Patient/${userId}` },
      effectiveDateTime:`${l.date}T21:00:00Z`, valueInteger:l.fetalMovements }});
  });

  schedule.forEach((v, i) => entries.push({ resource:{
    resourceType:'Appointment', id:`anc-${i}`, status: v.date >= new Date().toISOString().slice(0,10) ? 'booked' : 'fulfilled',
    description: v.label, start:`${v.date}T09:00:00Z`,
    participant:[{ actor:{ reference:`Patient/${userId}` }, status:'accepted' }],
  }}));

  if (prefs?.edd) entries.push({ resource:{ resourceType:'Observation', id:'edd', status:'final',
    code:{ coding:[{ system:'http://loinc.org', code:'11779-6', display:'Estimated date of delivery' }] },
    subject:{ reference:`Patient/${userId}` }, valueDateTime:`${prefs.edd}T00:00:00Z` }});

  // eRx → MedicationRequest
  const rx: ERx[] = (typeof window!=='undefined' ? JSON.parse(localStorage.getItem('antenatal:erx')||'[]') : []);
  rx.forEach((r, i)=> entries.push({ resource:{
    resourceType:'MedicationRequest', id:`rx-${i}`, status:'active', intent:'order',
    medicationCodeableConcept:{ text:`${r.drug} ${r.dose}` },
    subject:{ reference:`Patient/${userId}` },
    authoredOn: `${r.date}T12:00:00Z`,
    requester:{ display: r.prescriber || 'OB/GYN' },
    dosageInstruction:[{ text: r.sig }],
    note: r.notes ? [{ text: r.notes }] : undefined,
  }}));

  return { resourceType:'Bundle', type:'collection', entry: entries };
}
