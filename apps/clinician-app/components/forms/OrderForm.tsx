// apps/clinician-app/components/forms/OrderForm.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCombobox } from 'downshift';
import { useAutocomplete, rxnormSearch } from '@/src/hooks/useAutocomplete';
import type { RxNormHit } from '@/src/hooks/useAutocomplete';

type MedicationConceptKind = 'ingredient' | 'clinical_drug' | 'product' | 'free_text';
type LaboratoryDisciplineCode =
  | 'CLINICAL_CHEMISTRY'
  | 'HAEMATOLOGY'
  | 'MICROBIOLOGY'
  | 'IMMUNOLOGY_SEROLOGY'
  | 'ENDOCRINOLOGY'
  | 'MOLECULAR_GENETICS'
  | 'HISTOPATHOLOGY_CYTOLOGY'
  | 'GENERAL_LABORATORY';

type ErxItem = {
  id: string;
  drugName: string;
  rxCui?: string | null;
  nappi?: string | null;
  genericName?: string;
  conceptKind?: MedicationConceptKind;
  strength?: string;
  form?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  refills?: number;
  notes?: string;
};

type LabItem = {
  id: string;
  testCode: string;
  title?: string;
  details?: string;
  priority?: 'Routine' | 'Urgent' | 'Stat';
  fasting?: boolean;
  specimen?: string;
  notes?: string;
  catalogSystem?: string;
  investigationClass?: 'laboratory';
  disciplineCode?: LaboratoryDisciplineCode;
  disciplineText?: string;
};

function inferStrengthAndForm(label: string) {
  const text = String(label || '').trim();
  const strength = text.match(/\b\d+(?:\.\d+)?\s*(?:mcg|micrograms?|mg|g|kg|units?|iu|mmol|mEq)(?:\s*\/\s*(?:mL|L|dose|actuation))?\b/i)?.[0] || '';
  const forms = ['Extended Release Oral Tablet','Delayed Release Oral Tablet','Oral Disintegrating Tablet','Sublingual Tablet','Buccal Tablet','Oral Tablet','Oral Capsule','Oral Solution','Oral Suspension','Injectable Solution','Injection','Inhalation Solution','Inhalation Powder','Metered Dose Inhaler','Transdermal Patch','Topical Cream','Topical Ointment','Topical Gel','Ophthalmic Solution','Nasal Spray','Suppository','Vaginal Tablet','Tablet','Capsule','Solution','Suspension','Cream','Ointment','Gel','Patch','Spray','Drops'];
  const lower = text.toLowerCase();
  return { strength, form: forms.find((form) => lower.includes(form.toLowerCase())) || '' };
}

function medicationConceptKind(hit: RxNormHit): MedicationConceptKind {
  const raw = hit as any;
  const termType = String(raw.tty || raw.termType || raw.term_type || raw.kind || '').trim().toUpperCase();
  if (['IN','PIN','MIN'].includes(termType) || termType.includes('INGREDIENT')) return 'ingredient';
  if (['SCD','SBD','SCDG','SBDG'].includes(termType) || termType.includes('CLINICAL')) return 'clinical_drug';
  if (['GPCK','BPCK'].includes(termType) || termType.includes('PRODUCT') || String(raw.source || '').includes('careport')) return 'product';
  if (String(raw.strength || '').trim() || String(raw.doseForm || raw.form || '').trim()) return 'clinical_drug';
  return hit.rxcui ? 'ingredient' : 'free_text';
}

function canonicalLaboratoryDiscipline(value: unknown): { code: LaboratoryDisciplineCode; text: string } {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/haemat|hemat|coagulat|blood count|blood film/.test(normalized)) return { code: 'HAEMATOLOGY', text: 'Haematology' };
  if (/chem|biochem|metabolic|renal|liver|electrolyte/.test(normalized)) return { code: 'CLINICAL_CHEMISTRY', text: 'Clinical Chemistry / Biochemistry' };
  if (/micro|culture|bacter|virolog|parasit|mycolog/.test(normalized)) return { code: 'MICROBIOLOGY', text: 'Microbiology' };
  if (/immun|serolog/.test(normalized)) return { code: 'IMMUNOLOGY_SEROLOGY', text: 'Immunology / Serology' };
  if (/endocr|hormon/.test(normalized)) return { code: 'ENDOCRINOLOGY', text: 'Endocrinology' };
  if (/molecular|genetic|genomic|pcr/.test(normalized)) return { code: 'MOLECULAR_GENETICS', text: 'Molecular / Genetics' };
  if (/histopath|cytolog|pathology|biopsy/.test(normalized)) return { code: 'HISTOPATHOLOGY_CYTOLOGY', text: 'Histopathology / Cytology' };
  return { code: 'GENERAL_LABORATORY', text: 'General laboratory' };
}

function looksLikeNonLaboratoryInvestigation(value: unknown) {
  const text = String(value || '').toLowerCase();
  return /\b(x[- ]?ray|radiograph(?:y|ic)?|ultra[- ]?sound|sonograph(?:y|ic)?|ct scan|computed tomography|mri|magnetic resonance|mammograph(?:y|ic)?|nuclear medicine|pet(?:[- ]?ct)?|fluoroscop(?:y|ic)?|angiograph(?:y|ic)|echocardiograph(?:y|ic)?|ecg|electrocardiogra(?:m|phy)|eeg|electroencephalogra(?:m|phy)|spirometr(?:y|ic))\b/i.test(text);
}

function makeId(prefix = 'i') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function SigPill({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200"
    >
      {text}
    </button>
  );
}

/* tiny modal & helpers */
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-white rounded shadow-xl z-10 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */
export default function OrderForm({ onSaved = (v: any) => {} }: { onSaved?: (v: any) => void }) {
  const [encounterId, setEncounterId] = useState<string>('');
  const [encInput, setEncInput] = useState<string>('');

  const [tab, setTab] = useState<'erx' | 'lab'>('erx');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const drugAuto = useAutocomplete<RxNormHit>(rxnormSearch);

  /* eRx items */
  const [items, setItems] = useState<ErxItem[]>(() => [
    { id: makeId('item'), drugName: '', rxCui: null, conceptKind: 'free_text', strength: '', form: '', dose: '', route: '', frequency: '', duration: '', quantity: '', refills: 0, notes: '' },
  ]);

  /* Lab items */
  const [labItems, setLabItems] = useState<LabItem[]>(() => [
    { id: makeId('lab'), testCode: '', title: '', details: '', priority: 'Routine', fasting: false, specimen: 'Blood', notes: '', catalogSystem: 'local_sa_lab_catalog', investigationClass: 'laboratory', disciplineCode: 'GENERAL_LABORATORY', disciplineText: 'General laboratory' },
  ]);

  const storageKey = useMemo(() => `erx-composer:${encounterId || 'ad-hoc'}`, [encounterId]);
  const storageKeyLab = useMemo(() => `lab-composer:${encounterId || 'ad-hoc'}`, [encounterId]);

  /* persist/load drafts */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: ErxItem[]; tab?: 'erx' | 'lab' };
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length) setItems(parsed.items);
        if (parsed.tab) setTab(parsed.tab);
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKeyLab);
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: LabItem[]; tab?: 'erx' | 'lab' };
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length) setLabItems(parsed.items);
        if (parsed.tab) setTab(parsed.tab);
      }
    } catch {}
  }, [storageKeyLab]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ items, tab }));
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
  }, [items, tab, storageKey]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKeyLab, JSON.stringify({ items: labItems, tab }));
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
  }, [labItems, tab, storageKeyLab]);

  /* eRx helpers */
  const updateItem = useCallback((id: string, patch: Partial<ErxItem>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);
  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: makeId('item'), drugName: '', rxCui: null, conceptKind: 'free_text', strength: '', form: '', dose: '', route: '', frequency: '', duration: '', quantity: '', refills: 0, notes: '' },
    ]);
  }, []);
  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.id !== id)));
  }, []);

  const [sigMap, setSigMap] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const cuis = Array.from(new Set(items.map((i) => i.rxCui).filter(Boolean) as string[]));
    cuis.forEach((cui) => {
      if (sigMap[cui]) return;
      (async () => {
        try {
          const r = await fetch(`/api/codes/sigs?rxCui=${encodeURIComponent(cui)}`, { cache: 'no-store' });
          if (r.ok) {
            const js = await r.json();
            if (Array.isArray(js.items)) {
              setSigMap((s) => ({ ...s, [cui]: js.items }));
              return;
            }
          }
        } catch {
          // ignore
        }
        setSigMap((s) => ({ ...s, [cui]: [] }));
      })();
    });
  }, [items, sigMap]);

  /* ---------- full lab test catalogue grouped (10-ish per category) ---------- */
  const LAB_TESTS = useMemo(() => ([
    { category: 'Clinical Chemistry / Biochemistry', code: 'LIPID', title: 'Lipid panel', details: 'Total cholesterol, HDL, LDL, TG', specimen: 'Blood', fastingRecommended: true, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'GLU', title: 'Glucose (Fasting)', details: 'Fasting plasma glucose', specimen: 'Blood', fastingRecommended: true, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'BMP', title: 'Basic metabolic panel', details: 'Na, K, Cl, HCO3, Urea, Creatinine, Glucose', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'LFT', title: 'Liver function tests (LFT)', details: 'AST, ALT, ALP, bilirubin', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'RFT', title: 'Renal function tests (RFT)', details: 'Urea, creatinine, electrolytes', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'AMYL', title: 'Amylase', details: 'Pancreatic enzyme', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'CRP', title: 'CRP', details: 'C-reactive protein', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'GGT', title: 'GGT', details: 'Gamma glutamyl transferase', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'BIL', title: 'Bilirubin (total & direct)', details: 'Assess jaundice', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Clinical Chemistry / Biochemistry', code: 'TG', title: 'Triglycerides', details: 'Serum triglycerides', specimen: 'Blood', fastingRecommended: true, urgent: false },

    { category: 'Haematology', code: 'CBC', title: 'Complete blood count (CBC)', details: 'Hb, WCC, Platelets', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'ESR', title: 'ESR', details: 'Erythrocyte sedimentation rate', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'RETIC', title: 'Reticulocyte count', details: 'Bone marrow response', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'PT', title: 'PT/INR', details: 'Coagulation profile (Prothrombin time)', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'PB', title: 'Peripheral blood film', details: 'Morphology & differential', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'FERR', title: 'Ferritin', details: 'Iron stores', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'IRON', title: 'Serum iron', details: 'Serum iron indices', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Haematology', code: 'B12', title: 'Vitamin B12', details: 'Cobalamin level', specimen: 'Blood', fastingRecommended: false, urgent: false },

    { category: 'Microbiology', code: 'CULT-URINE', title: 'Urine culture', details: 'Urine microscopy & culture', specimen: 'Urine', fastingRecommended: false, urgent: false },
    { category: 'Microbiology', code: 'CULT-BLOOD', title: 'Blood culture', details: 'Blood culture x2 sets', specimen: 'Blood', fastingRecommended: false, urgent: true },
    { category: 'Microbiology', code: 'PCR-COVID', title: 'COVID-19 PCR', details: 'SARS-CoV-2 PCR (swab)', specimen: 'Swab', fastingRecommended: false, urgent: false },
    { category: 'Microbiology', code: 'THROAT-CULT', title: 'Throat swab culture', details: 'Bacterial throat culture', specimen: 'Swab', fastingRecommended: false, urgent: false },
    { category: 'Microbiology', code: 'STOOL-RT', title: 'Stool R/M/C', details: 'Microscopy, culture & sensitivity', specimen: 'Stool', fastingRecommended: false, urgent: false },
    { category: 'Microbiology', code: 'MSU', title: 'Midstream urine', details: 'Urine MC&S', specimen: 'Urine', fastingRecommended: false, urgent: false },
    { category: 'Microbiology', code: 'PCR-INFL', title: 'Influenza PCR', details: 'Flu PCR panel (swab)', specimen: 'Swab', fastingRecommended: false, urgent: false },

    { category: 'Endocrinology', code: 'HBA1C', title: 'HbA1c', details: 'Glycated haemoglobin', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Endocrinology', code: 'TSH', title: 'TSH', details: 'Thyroid stimulating hormone', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Endocrinology', code: 'FT4', title: 'Free T4', details: 'Thyroid hormone', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Endocrinology', code: 'INS', title: 'Insulin (fasting)', details: 'Fasting insulin', specimen: 'Blood', fastingRecommended: true, urgent: false },

    { category: 'Immunology / Serology', code: 'HIV', title: 'HIV Ag/Ab', details: 'HIV 4th gen test', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Immunology / Serology', code: 'HBSAG', title: 'HBsAg', details: 'Hepatitis B surface antigen', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Immunology / Serology', code: 'HCV', title: 'HCV Ab', details: 'Hepatitis C antibody', specimen: 'Blood', fastingRecommended: false, urgent: false },
    { category: 'Immunology / Serology', code: 'SYPH', title: 'Syphilis (RPR/TPHA)', details: 'Syphilis serology', specimen: 'Blood', fastingRecommended: false, urgent: false },
  ]), []);

  const categories = useMemo(() => Array.from(new Set(LAB_TESTS.map(t => t.category))), [LAB_TESTS]);
  const COMMON_PANELS = useMemo(() => LAB_TESTS.filter(t => ['LIPID','CBC','HBA1C','BMP','LFT','RFT'].includes(t.code)).slice(0,6).map(t => ({ id: t.code, title: t.title, details: t.details, specimen: t.specimen })), [LAB_TESTS]);

  /* lab helpers */
  const updateLabItem = useCallback((id: string, patch: Partial<LabItem>) => {
    setLabItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);
  const addLabItem = useCallback(() => {
    setLabItems((prev) => [
      ...prev,
      { id: makeId('lab'), testCode: '', title: '', details: '', priority: 'Routine', fasting: false, specimen: 'Blood', notes: '', catalogSystem: 'local_sa_lab_catalog', investigationClass: 'laboratory', disciplineCode: 'GENERAL_LABORATORY', disciplineText: 'General laboratory' },
    ]);
  }, []);
  const removeLabItem = useCallback((id: string) => {
    setLabItems((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.id !== id)));
  }, []);
  const duplicateLabItem = useCallback((item: LabItem) => {
    setLabItems((prev) => [...prev, { ...item, id: makeId('lab') }]);
  }, []);

  const buildItemsForPost = useCallback(() => items.filter((it) => it.drugName.trim()).map((it) => ({
    drug: it.drugName.trim(),
    rxcui: it.rxCui || undefined,
    nappi: it.nappi || undefined,
    genericName: it.genericName || undefined,
    conceptKind: it.conceptKind || (it.rxCui ? 'ingredient' : 'free_text'),
    strength: it.strength?.trim() || undefined,
    form: it.form?.trim() || undefined,
    dose: it.dose?.trim() || undefined,
    route: it.route?.trim() || undefined,
    freq: it.frequency?.trim() || undefined,
    duration: it.duration?.trim() || undefined,
    qty: it.quantity?.trim() || undefined,
    refills: typeof it.refills === 'number' ? it.refills : 0,
    notes: it.notes?.trim() || undefined,
  })), [items]);

  const buildLabForPost = useCallback(() => labItems
    .filter((l) => String(l.testCode || l.title || '').trim())
    .map((l) => ({
      test: String(l.title || l.testCode || '').trim(),
      catalogCode: l.testCode?.trim() || undefined,
      catalogSystem: l.catalogSystem || 'local_sa_lab_catalog',
      priority: l.priority || 'Routine',
      specimen: l.specimen || 'Blood',
      instructions: l.notes?.trim() || undefined,
      investigationClass: 'laboratory' as const,
      disciplineCode: l.disciplineCode || 'GENERAL_LABORATORY',
      disciplineText: l.disciplineText || 'General laboratory',
    })), [labItems]);

  /* toast */
  const [toast, setToast] = useState<{ msg: string; kind?: 'success' | 'error' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* submit handlers */
  const submitErx = useCallback(async () => {
    setBusy(true);
    setErr(null);
    if (!encounterId) { setErr('Missing encounterId'); setBusy(false); return; }
    try {
      const medications = buildItemsForPost();
      if (!medications.length) throw new Error('Add at least one medication before issuing the prescription.');
      const incomplete = medications.find((item) => !item.strength || !item.form);
      if (incomplete) throw new Error(`Strength and dosage form are required before issuing ${incomplete.drug}.`);
      const body = { action: 'finalize', scope: 'medications', encounterId, medications, labs: [] };
      const url = `/api/encounters/${encodeURIComponent(encounterId)}/erx`;
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
      const js = await r.json().catch(() => null as any);
      if (!r.ok || !js?.ok) throw new Error(js?.message || js?.error || `HTTP ${r.status}`);
      try { localStorage.removeItem(storageKey); } catch {}
      setToast({ msg: 'Prescription issued to the patient record', kind: 'success' });
      onSaved(js);
    } catch (e: any) {
      setErr(e?.message || 'Failed to create order'); setToast({ msg: e?.message || 'Failed to create order', kind: 'error' });
    } finally { setBusy(false); }
  }, [encounterId, buildItemsForPost, storageKey, onSaved]);

  const submitLab = useCallback(async () => {
    setBusy(true);
    setErr(null);
    if (!encounterId) { setErr('Missing encounterId'); setBusy(false); return; }
    try {
      const labs = buildLabForPost();
      if (!labs.length) throw new Error('Add at least one laboratory investigation before issuing the order.');
      const misrouted = labs.find((item) => looksLikeNonLaboratoryInvestigation(item.test));
      if (misrouted) throw new Error(`“${misrouted.test}” is not a laboratory investigation. Imaging/Radiology and other diagnostics require a separate workflow.`);
      const body = { action: 'finalize', scope: 'labs', encounterId, medications: [], labs };
      const url = `/api/encounters/${encodeURIComponent(encounterId)}/erx`;
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
      const js = await r.json().catch(() => null as any);
      if (!r.ok || !js?.ok) throw new Error(js?.message || js?.error || `HTTP ${r.status}`);
      try { localStorage.removeItem(storageKeyLab); } catch {}
      setToast({ msg: 'Laboratory order issued to the patient record', kind: 'success' });
      onSaved(js);
    } catch (e: any) {
      setErr(e?.message || 'Failed to create lab order'); setToast({ msg: e?.message || 'Failed to create lab order', kind: 'error' });
    } finally { setBusy(false); }
  }, [encounterId, buildLabForPost, storageKeyLab, onSaved]);

  /* Drug combobox */
  function DrugCombobox({ row }: { row: ErxItem }) {
    const options = useMemo(() => (drugAuto.opts || []).map((hit) => {
      const raw = hit as any;
      const inferred = inferStrengthAndForm(hit.name);
      return {
        label: hit.name,
        hit,
        strength: String(raw.strength || '').trim() || inferred.strength,
        form: String(raw.doseForm || raw.form || '').trim() || inferred.form,
      };
    }), [drugAuto.opts]);

    const itemsList = options.map((o) => o.label);

    const { isOpen, getMenuProps, getInputProps, getItemProps, highlightedIndex } = useCombobox({
      items: itemsList,
      inputValue: row.drugName || '',
      onInputValueChange: ({ inputValue }) => {
        if (typeof inputValue === 'string') {
          drugAuto.setQ(inputValue);
          const matchesCurrentOption = options.some((option) => option.label === inputValue);
          if (matchesCurrentOption) {
            if (inputValue !== row.drugName) updateItem(row.id, { drugName: inputValue });
          } else {
            updateItem(row.id, { drugName: inputValue, rxCui: null, nappi: null, genericName: undefined, conceptKind: 'free_text', strength: '', form: '' });
          }
        }
      },
      onSelectedItemChange: ({ selectedItem }) => {
        if (!selectedItem) return;
        const selected = options.find((option) => option.label === selectedItem);
        const hit = selected?.hit || null;
        const raw = hit as any;
        updateItem(row.id, {
          drugName: selectedItem,
          rxCui: hit?.rxcui || null,
          nappi: String(raw?.nappi || raw?.nappiCode || '').trim() || null,
          genericName: String(raw?.genericName || raw?.ingredientName || '').trim() || undefined,
          conceptKind: hit ? medicationConceptKind(hit) : 'free_text',
          strength: selected?.strength || '',
          form: selected?.form || '',
          route: row.route || String(raw?.route || '').trim(),
        });
      },
      itemToString: (i: any) => i ?? '',
    });

    return (
      <div className="relative">
        <input {...getInputProps({ placeholder: 'Type drug name…', className: 'w-full border rounded px-2 py-1' })} />
        <ul {...getMenuProps()} className={`absolute z-40 mt-1 w-full max-h-56 overflow-auto rounded border bg-white ${isOpen ? '' : 'hidden'}`}>
          {itemsList.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No coded match. You may continue with free text, but strength and dosage form remain mandatory before issue.</li>
          ) : itemsList.map((label, index) => {
            const option = options[index];
            return (
              <li key={`${label}-${index}`} {...getItemProps({ item: label, index })} className={`px-3 py-2 text-sm cursor-pointer ${highlightedIndex === index ? 'bg-gray-100' : ''}`}>
                <div className="font-medium">{label}</div>
                <div className="text-[11px] text-gray-500">{[option?.strength, option?.form].filter(Boolean).join(' · ') || 'Strength/formulation not coded — required before issue'}</div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ---------- Picker modal state & logic (multi-select + collapsible categories) ---------- */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetRowId, setPickerTargetRowId] = useState<string | null>(null); // if user opened from a row
  const [pickerSelection, setPickerSelection] = useState<Record<string, boolean>>({});
  const [pickerFilter, setPickerFilter] = useState('');
  const [pickerCategoryOpen, setPickerCategoryOpen] = useState<Record<string, boolean>>({});
  const [confirmPanelShown, setConfirmPanelShown] = useState(false);
  const [addAnotherAfterConfirm, setAddAnotherAfterConfirm] = useState(false);

  // extra group filters (fasting / urgent)
  const [filterFasting, setFilterFasting] = useState(false);
  const [filterUrgent, setFilterUrgent] = useState(false);

  useEffect(() => {
    // Initialize all categories collapsed = false by default
    const initial: Record<string, boolean> = {};
    categories.forEach(c => (initial[c] = false));
    setPickerCategoryOpen(initial);
  }, [categories]);

  const openPicker = useCallback((targetRowId?: string | null) => {
    setPickerTargetRowId(targetRowId ?? null);
    setPickerSelection({});
    setPickerFilter('');
    setConfirmPanelShown(false);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setConfirmPanelShown(false);
    setPickerSelection({});
    setPickerFilter('');
    setFilterFasting(false);
    setFilterUrgent(false);
  }, []);

  const toggleSelectTest = useCallback((code: string) => {
    setPickerSelection(s => ({ ...s, [code]: !s[code] }));
  }, []);

  const filteredByCategory = useCallback((cat: string) => LAB_TESTS
    .filter(t => t.category === cat)
    .filter(t => {
      if (filterFasting && !t.fastingRecommended) return false;
      if (filterUrgent && !t.urgent) return false;
      const term = pickerFilter.trim().toLowerCase();
      if (!term) return true;
      return (`${t.code} ${t.title} ${t.details}`.toLowerCase().includes(term));
    })
  , [LAB_TESTS, pickerFilter, filterFasting, filterUrgent]);

  const selectAllInCategory = useCallback((cat: string) => {
    const list = filteredByCategory(cat);
    setPickerSelection(s => {
      const copy = { ...s };
      list.forEach(t => (copy[t.code] = true));
      return copy;
    });
  }, [filteredByCategory]);

  const selectPanel = useCallback((panelCode: string) => {
    // select items that match the panel (heuristic: same code or similar)
    const panel = LAB_TESTS.find(t => t.code === panelCode);
    if (!panel) return;
    // for simplicity select items within same category that are common to panel (first 4)
    const matches = LAB_TESTS.filter(t => t.category === panel.category).slice(0, 6);
    setPickerSelection(s => {
      const copy = { ...s };
      matches.forEach(m => (copy[m.code] = true));
      return copy;
    });
  }, [LAB_TESTS]);

  const makeLabItemFromTest = useCallback(
    (t: {
      code: string;
      title?: string;
      details?: string;
      fastingRecommended?: boolean;
      specimen?: string;
      category?: string;
    }): LabItem => ({
      id: makeId('lab'),
      testCode: t.code,
      title: t.title || '',
      details: t.details || '',
      priority: 'Routine',
      fasting: !!t.fastingRecommended,
      specimen: t.specimen || 'Blood',
      notes: '',
      catalogSystem: 'local_sa_lab_catalog',
      investigationClass: 'laboratory',
      ...(() => { const discipline = canonicalLaboratoryDiscipline((t as any).category); return { disciplineCode: discipline.code, disciplineText: discipline.text }; })(),
    }),
    []
  );

  const confirmPick = useCallback(() => {
    const selectedCodes = Object.keys(pickerSelection).filter(k => pickerSelection[k]);
    if (selectedCodes.length === 0) {
      setToast({ msg: 'Select at least one test', kind: 'error' });
      return;
    }

    const tests = selectedCodes.map(code => LAB_TESTS.find(t => t.code === code)).filter(Boolean) as any[];

    if (pickerTargetRowId) {
      const first = tests[0];
      if (first) {
        updateLabItem(pickerTargetRowId, {
          testCode: first.code, title: first.title, details: first.details, specimen: first.specimen, fasting: !!first.fastingRecommended,
          catalogSystem: 'local_sa_lab_catalog', investigationClass: 'laboratory',
          ...(() => { const discipline = canonicalLaboratoryDiscipline(first.category); return { disciplineCode: discipline.code, disciplineText: discipline.text }; })(),
        });
      }
      const extras = tests.slice(1);

      if (extras.length > 0) {
        setLabItems((prev) => [
          ...prev,
          ...extras.map((t) => makeLabItemFromTest(t)),
        ]);
      }
    } else {
      setLabItems((prev) => [
        ...prev,
        ...tests.map((t) => makeLabItemFromTest(t)),
      ]);
    }

    setConfirmPanelShown(true);
    setToast({ msg: `Added ${tests.length} test(s)`, kind: 'success' });

    if (!addAnotherAfterConfirm) {
      setTimeout(() => closePicker(), 450);
    } else {
      setPickerSelection({});
      setPickerFilter('');
    }
  }, [
    pickerSelection,
    LAB_TESTS,
    pickerTargetRowId,
    updateLabItem,
    makeLabItemFromTest,
    addAnotherAfterConfirm,
    closePicker,
  ]);

  /* specimen badge */
  function SpecimenBadge({ text }: { text?: string }) {
    return <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 border text-gray-700">{text || 'Blood'}</span>;
  }

  /* preview modal + server-rendered clinical PDF */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<any>(null);
  const clinicianName = typeof window !== 'undefined' ? String((window as any).__USER__?.name || '').trim() : '';
  const patientPlaceholder = { name: '', id: '' };

  const openPreview = useCallback(() => {
    if (!encounterId) {
      setToast({ msg: 'Select an encounter before generating a laboratory requisition.', kind: 'error' });
      return;
    }
    const payload = {
      createdAt: new Date().toISOString(),
      clinician: clinicianName,
      patient: patientPlaceholder,
      items: labItems.map(l => ({ code: l.testCode || l.title, title: l.title || l.testCode, specimen: l.specimen, fasting: l.fasting, notes: l.notes, discipline: l.disciplineText || 'General laboratory' })),
    };
    setPreviewPayload(payload);
    setPreviewOpen(true);
  }, [labItems, clinicianName, encounterId]);

  const generatePdfBlob = useCallback(async (payload: any) => {
    const response = await fetch('/api/clinical-documents/render', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/pdf' },
      body: JSON.stringify({
        kind: 'lab-requisition',
        encounterId,
        createdAt: payload.createdAt,
        patient: payload.patient,
        clinician: { name: payload.clinician },
        tests: payload.items,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || 'Unable to render laboratory requisition.');
    }
    return await response.blob();
  }, [encounterId]);

  const downloadPreviewPdf = useCallback(async () => {
    if (!previewPayload) return;
    try {
      const blob = await generatePdfBlob(previewPayload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ambulant_lab_order_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast({ msg: 'PDF downloaded', kind: 'success' });
    } catch (error: any) {
      setToast({ msg: error?.message || 'Unable to generate laboratory requisition PDF.', kind: 'error' });
    }
  }, [previewPayload, generatePdfBlob]);

  /* LabInline component */
  function LabInline({ row }: { row: LabItem }) {
    return (
      <div className="flex gap-2 items-stretch">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={row.testCode || row.title || ''}
          onChange={(e) => updateLabItem(row.id, { testCode: e.target.value, title: '', disciplineCode: 'GENERAL_LABORATORY', disciplineText: 'General laboratory', investigationClass: 'laboratory' })}
          placeholder="Type code/title or use picker"
        />
        <button type="button" onClick={() => openPicker(row.id)} className="px-3 py-1 rounded border bg-white">Choose tests…</button>
      </div>
    );
  }

  /* UI render */
  return (
    <div className="bg-white rounded p-4">
      <h3 className="text-sm font-semibold mb-3">Create Order</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
        <div className="col-span-2">
          <div className="text-sm text-gray-600">Encounter / Case ID</div>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Enter encounterId (or leave blank for ad-hoc)"
            value={encInput}
            onChange={(e) => setEncInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEncounterId(encInput.trim()); }}
          />
        </div>
        <div className="flex gap-2 items-end">
          <button className="px-3 py-1 rounded border bg-white" onClick={() => { setEncInput(''); setEncounterId(''); }}>Clear</button>
          <button className="px-3 py-1.5 rounded bg-emerald-600 text-white" onClick={() => setEncounterId(encInput.trim())}>Use ID</button>
        </div>
      </div>

      <div className="text-sm text-gray-500 mt-2">Active encounter: <code>{encounterId || 'ad-hoc'}</code></div>

      <div className="flex gap-2 mt-3">
        <button onClick={() => setTab('erx')} className={`px-3 py-1 rounded border ${tab === 'erx' ? 'bg-gray-900 text-white' : 'bg-white'}`}>Pharmacy (eRx)</button>
        <button onClick={() => setTab('lab')} className={`px-3 py-1 rounded border ${tab === 'lab' ? 'bg-gray-900 text-white' : 'bg-white'}`}>Laboratory</button>
        <span className="self-center rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">Imaging / Radiology · separate workflow</span>
      </div>

      {tab === 'erx' ? (
        <section className="space-y-4 border rounded p-4 bg-white mt-3">
          {items.map((it, idx) => {
            const sigs = it.rxCui ? (sigMap[it.rxCui] || []) : [];
            return (
              <div key={it.id} className="border rounded p-3 bg-gray-50">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
                  <div>
                    <label className="text-xs text-gray-600">Medicine</label>
                    <DrugCombobox row={it} />
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      <span>{it.conceptKind === 'ingredient' ? 'Ingredient concept' : it.conceptKind === 'clinical_drug' ? 'Clinical drug concept' : it.conceptKind === 'product' ? 'Product concept' : 'Free-text medicine'}</span>
                      {it.genericName && it.genericName !== it.drugName ? <span>Generic: {it.genericName}</span> : null}
                      {it.rxCui ? <span>RxCUI: <span className="font-mono">{it.rxCui}</span></span> : null}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Strength</label>
                    <input className="w-full border rounded px-2 py-1" value={it.strength || ''} onChange={(e) => updateItem(it.id, { strength: e.target.value })} placeholder="e.g. 500 mg" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Dosage form</label>
                    <input className="w-full border rounded px-2 py-1" value={it.form || ''} onChange={(e) => updateItem(it.id, { form: e.target.value })} placeholder="e.g. tablet" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                  <input className="border rounded px-2 py-1" placeholder="Dose (e.g. 1 tablet)" value={it.dose || ''} onChange={(e) => updateItem(it.id, { dose: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Route (e.g. oral)" value={it.route || ''} onChange={(e) => updateItem(it.id, { route: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Frequency (e.g. BD)" value={it.frequency || ''} onChange={(e) => updateItem(it.id, { frequency: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Duration (e.g. x5d)" value={it.duration || ''} onChange={(e) => updateItem(it.id, { duration: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Quantity" value={it.quantity || ''} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                  <input type="number" min={0} className="border rounded px-2 py-1" placeholder="Refills" value={it.refills ?? 0} onChange={(e) => updateItem(it.id, { refills: Number(e.target.value || 0) })} />
                </div>

                <div className="mt-3">
                  <label className="text-xs text-gray-600">Sig / Notes</label>
                  <input className="w-full border rounded px-2 py-1" value={it.notes || ''} onChange={(e) => updateItem(it.id, { notes: e.target.value })} placeholder="e.g. 1 tab nocte" />
                  <div className="flex gap-2 flex-wrap mt-2">
                    {sigs.map((s) => (
                      <SigPill key={s} text={s} onClick={() => updateItem(it.id, { notes: s })} />
                    ))}
                    {!sigs.length ? <span className="text-[11px] text-gray-500">No coded SIG suggestion available — enter directions explicitly.</span> : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => removeItem(it.id)} disabled={items.length === 1} className="px-3 py-1 rounded border bg-white">Remove</button>
                  <button type="button" onClick={() => setItems((p) => [...p, { ...it, id: makeId('dup') }])} className="px-3 py-1 rounded border bg-white">Duplicate</button>
                  <div className="ml-auto text-xs text-gray-500">Row {idx + 1}</div>
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <button onClick={addItem} className="px-3 py-1 rounded border bg-white">Add medication</button>
            <div className="flex-1" />
            <div className="text-xs text-gray-500">Draft autosaved</div>
          </div>
        </section>
      ) : (
        <section className="space-y-2 border rounded p-3 bg-white mt-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            This workspace is for laboratory investigations only. Laboratory orders carry a structured discipline (for example Haematology or Clinical Chemistry). Imaging/Radiology, ECG, EEG and spirometry use separate diagnostic workflows and are not routed through MedReach.
          </div>
          {labItems.map((li, idx) => {
            const meta = LAB_TESTS.find(t => t.code === li.testCode) || LAB_TESTS.find(t => t.title === li.title);
            const discipline = canonicalLaboratoryDiscipline(li.disciplineText || meta?.category);
            const fastingSuggested = !!meta?.fastingRecommended;
            return (
              <div key={li.id} className="border rounded p-3 bg-gray-50">
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600">Test / Panel</label>
                    <LabInline row={li} />
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-[11px] text-gray-600">{li.details || meta?.details || ''}</div>
                      <div title={meta?.details || ''} className="text-[11px] text-gray-500 ml-1 px-1 rounded">{meta ? <SpecimenBadge text={meta.specimen} /> : <SpecimenBadge text={li.specimen} />}</div>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">Discipline: <span className="font-medium text-gray-700">{li.disciplineText || discipline.text}</span> · class: Laboratory</div>

                    {(fastingSuggested || li.fasting) && (
                      <div className="mt-1 text-[12px] italic text-amber-700">
                        {fastingSuggested ? 'Suggested: Patient should be fasting for this test.' : 'Patient marked as fasting.'}
                      </div>
                    )}
                  </div>

                  <div className="w-36">
                    <label className="text-xs text-gray-600">Specimen</label>
                    <select className="w-full border rounded px-2 py-1" value={li.specimen} onChange={(e) => updateLabItem(li.id, { specimen: e.target.value })}>
                      <option>Blood</option>
                      <option>Urine</option>
                      <option>Swab</option>
                      <option>Stool</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="w-28">
                    <label className="text-xs text-gray-600">Priority</label>
                    <select className="w-full border rounded px-2 py-1" value={li.priority} onChange={(e) => updateLabItem(li.id, { priority: e.target.value as any })}>
                      <option value="Routine">Routine</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Stat">Stat</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                  <div>
                    <label className="text-xs text-gray-600">Test code</label>
                    <input className="w-full border rounded px-2 py-1" value={li.testCode || ''} onChange={(e) => updateLabItem(li.id, { testCode: e.target.value, disciplineCode: 'GENERAL_LABORATORY', disciplineText: 'General laboratory', investigationClass: 'laboratory' })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Title</label>
                    <input className="w-full border rounded px-2 py-1" value={li.title || ''} onChange={(e) => updateLabItem(li.id, { title: e.target.value, disciplineCode: 'GENERAL_LABORATORY', disciplineText: 'General laboratory', investigationClass: 'laboratory' })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Fasting</label>
                    <div className="mt-1">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!li.fasting} onChange={(e) => updateLabItem(li.id, { fasting: e.target.checked })} />
                        <span className="text-xs">Patient fasting</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Notes</label>
                    <input className="w-full border rounded px-2 py-1" value={li.notes || ''} onChange={(e) => updateLabItem(li.id, { notes: e.target.value })} />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => removeLabItem(li.id)} disabled={labItems.length === 1} className="px-3 py-1 rounded border bg-white">Remove</button>
                  <button type="button" onClick={() => duplicateLabItem(li)} className="px-3 py-1 rounded border bg-white">Duplicate</button>
                  <button type="button" onClick={() => openPicker(li.id)} className="px-3 py-1 rounded border bg-white">Choose more tests…</button>
                  <div className="ml-auto text-xs text-gray-500">Row {idx + 1}</div>
                </div>
              </div>
            );
          })}

          <div className="mt-2">
            <div className="text-xs text-gray-600">Quick panels</div>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {COMMON_PANELS.map((p) => (
                <div key={p.id} className="flex gap-2">
                  <button key={p.id} type="button" onClick={() => {
                    setLabItems([{ id: makeId('lab'), testCode: p.id, title: p.title, details: p.details, specimen: p.specimen || 'Blood', priority: 'Routine', fasting: p.id === 'LIPID', notes: '', catalogSystem: 'local_sa_lab_catalog', investigationClass: 'laboratory', ...(() => { const discipline = canonicalLaboratoryDiscipline(LAB_TESTS.find((t) => t.code === p.id)?.category); return { disciplineCode: discipline.code, disciplineText: discipline.text }; })() }]);
                  }} className="flex-1 text-left border rounded p-2 hover:bg-gray-50">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-gray-600">{p.details}</div>
                  </button>
                  <button title="Select panel contents" onClick={() => selectPanel(p.id)} className="px-3 py-1 rounded border bg-white">Select</button>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-600">Panel code / custom</label>
              <input className="w-full border rounded px-2 py-1" value={labItems[0]?.testCode || ''} onChange={(e) => updateLabItem(labItems[0].id, { testCode: e.target.value, disciplineCode: 'GENERAL_LABORATORY', disciplineText: 'General laboratory', investigationClass: 'laboratory' })} />
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={addLabItem} className="px-3 py-1 rounded border bg-white">Add lab row</button>
              <button onClick={() => openPicker(null)} className="px-3 py-1 rounded border bg-white">Open test picker</button>
            </div>
          </div>
        </section>
      )}

      {err && <div className="text-sm text-rose-600 mt-2">{err}</div>}

      <div className="flex gap-2 mt-3">
        {tab === 'erx' ? (
          <button disabled={busy} onClick={submitErx} className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create'}</button>
        ) : (
          <>
            <button disabled={busy} onClick={() => { openPreview(); }} className="px-3 py-1.5 rounded border bg-white">Preview</button>
            <button disabled={busy} onClick={submitLab} className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create Lab Order'}</button>
          </>
        )}
        <button onClick={() => { /* remain on form */ }} className="px-3 py-1.5 rounded border bg-white">Cancel</button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 bottom-6 z-50 rounded p-3 shadow-lg ${toast.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="text-sm">{toast.msg}</div>
        </div>
      )}

      {/* Picker modal (collapsible categories, multi-select, sticky footer) */}
      <Modal open={pickerOpen} onClose={closePicker}>
        <div className="flex flex-col h-[80vh]">
          <div className="p-3 border-b flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-medium">Choose tests (multi-select)</div>
              <div className="text-xs text-gray-500">Filter or expand categories. Select multiple tests and confirm.</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 mr-2">Add another after confirm</label>
              <input type="checkbox" checked={addAnotherAfterConfirm} onChange={(e) => setAddAnotherAfterConfirm(e.target.checked)} />
              <button onClick={closePicker} className="px-3 py-1 rounded border bg-white">Close</button>
            </div>
          </div>

          <div className="p-3 border-b">
            <div className="flex gap-2">
              <input value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value)} placeholder="Filter tests…" className="border rounded px-2 py-1 flex-1" />
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <label><input type="checkbox" checked={filterFasting} onChange={(e) => setFilterFasting(e.target.checked)} /> fasting</label>
                <label><input type="checkbox" checked={filterUrgent} onChange={(e) => setFilterUrgent(e.target.checked)} /> urgent</label>
              </div>
              <div className="text-xs text-gray-500">Selected: {Object.keys(pickerSelection).filter(k=>pickerSelection[k]).length}</div>
              <button onClick={() => { setPickerSelection({}); setPickerFilter(''); setFilterFasting(false); setFilterUrgent(false); }} className="px-3 py-1 rounded border bg-white">Clear</button>
            </div>
          </div>

          <div className="p-3 overflow-auto flex-1 space-y-2">
            {categories.map(cat => {
              const list = filteredByCategory(cat);
              return (
                <details key={cat} className="border rounded" open={!!pickerCategoryOpen[cat]} onToggle={(e) => setPickerCategoryOpen(s => ({ ...s, [cat]: (e.target as HTMLDetailsElement).open }))}>
                  <summary className="px-3 py-2 cursor-pointer flex items-center justify-between">
                    <div className="font-medium">{cat}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500">{list.length} items</div>
                      <button onClick={(ev) => { ev.stopPropagation(); selectAllInCategory(cat); }} className="text-xs px-2 py-1 border rounded bg-white">Select all</button>
                    </div>
                  </summary>
                  <div className="p-2">
                    {list.length === 0 ? <div className="text-xs text-gray-500 p-2">No items</div> :
                      <div className="grid sm:grid-cols-2 gap-2">
                        {list.map(t => {
                          const code = t.code;
                          const selected = !!pickerSelection[code];
                          return (
                            <div key={code} className={`p-2 border rounded flex items-start gap-2 hover:bg-gray-50 ${selected ? 'ring-2 ring-indigo-300 bg-indigo-50' : ''}`} onClick={() => toggleSelectTest(code)}>
                              <input type="checkbox" checked={selected} readOnly className="mt-1" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">{t.code} — {t.title}</div>
                                  <div className="text-xs text-gray-500">{t.specimen}</div>
                                </div>
                                <div className="text-xs text-gray-600">{t.details}</div>
                                {t.fastingRecommended && <div className="text-[11px] text-amber-700 mt-1">Fasting recommended</div>}
                                {t.urgent && <div className="text-[11px] text-red-600 mt-1">Urgent</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="p-3 border-t bg-white sticky bottom-0 z-20">
            <div className="flex items-center justify-between">
              <div>
                {confirmPanelShown ? <div className="text-sm text-gray-600">Tests added. {addAnotherAfterConfirm ? 'Add more or close.' : 'Closing shortly...'}</div> : <div className="text-sm text-gray-600">Pick tests then click Add selected to add them to the lab order.</div>}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 mr-2">Add & keep modal open</label>
                <input type="checkbox" checked={addAnotherAfterConfirm} onChange={(e) => setAddAnotherAfterConfirm(e.target.checked)} />
                <button onClick={confirmPick} className="px-3 py-1 rounded bg-indigo-600 text-white">Add selected</button>
                <button onClick={closePicker} className="px-3 py-1 rounded border bg-white">Done</button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Preview modal (scrollable body + sticky footer) */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <div className="flex flex-col h-[80vh]">
          <div className="p-4 border-b flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">A+</div>
                <div>
                  <div className="text-lg font-semibold">Ambulant+</div>
                  <div className="text-xs text-gray-500">Connected care · MedReach integration</div>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>{new Date().toLocaleString()}</div>
              <div>Order preview</div>
            </div>
          </div>

          <div className="p-4 overflow-auto flex-1">
            <div className="mb-3">
              <div className="text-sm font-medium">Clinician</div>
              <div className="text-sm">{previewPayload?.clinician || clinicianName || 'Authenticated clinician'}</div>
              <div className="text-xs text-gray-500 mt-1">Identity and registration details are resolved from the authenticated clinician record when the order is issued.</div>
            </div>

            <div className="mb-3">
              <div className="text-sm font-medium">Patient</div>
              <div className="text-sm">{previewPayload?.patient?.name || 'Patient identity resolved from encounter'}</div>
              <div className="text-xs text-gray-500">Patient ID: {previewPayload?.patient?.id || encounterId || 'Encounter-bound'}</div>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-600 border-b">
                  <th className="py-2">Code</th>
                  <th className="py-2">Test</th>
                  <th className="py-2">Specimen</th>
                  <th className="py-2">Fasting</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {previewPayload?.items?.length ? previewPayload.items.map((it: any, i: number) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 text-sm">{it.code}</td>
                    <td className="py-2 text-sm">{it.title}</td>
                    <td className="py-2 text-sm">{it.specimen}</td>
                    <td className="py-2 text-sm">{it.fasting ? 'Yes' : 'No'}</td>
                    <td className="py-2 text-sm">{it.notes || '—'}</td>
                  </tr>
                )) : <tr><td colSpan={5} className="py-4 text-sm text-gray-500">No tests to preview.</td></tr>}
              </tbody>
            </table>

            <div className="mt-6 text-xs text-gray-500">
              Laboratory requisition authored in Ambulant+. MedReach routing, if chosen by the patient, occurs only after issue and is not triggered by this preview.
            </div>
          </div>

          <div className="p-4 border-t bg-white sticky bottom-0 z-20">
            <div className="flex justify-end gap-2">
              <button onClick={() => setPreviewOpen(false)} className="px-3 py-1 rounded border bg-white">Close</button>
              <button onClick={downloadPreviewPdf} className="px-3 py-1 rounded bg-indigo-600 text-white">Download PDF</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
