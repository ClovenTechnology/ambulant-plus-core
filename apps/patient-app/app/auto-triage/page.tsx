//apps/patient-app/app/auto-triage/page.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type SymptomPreset = {
  label: string;
  value: string;
  specialties: string[]; // used to pre-filter clinicians
};

// --- Minimal visible preset buttons (compact, your original + a few very common) ---
const PRESETS: SymptomPreset[] = [
  { label: 'Chest pain', value: 'chest_pain', specialties: ['Cardiology'] },
  { label: 'Shortness of breath', value: 'dyspnea', specialties: ['Pulmonology', 'Cardiology'] },
  { label: 'Fever', value: 'fever', specialties: ['General Medicine'] },
  { label: 'High blood pressure', value: 'hypertension', specialties: ['Cardiology'] },
  { label: 'High blood sugar', value: 'hyperglycemia', specialties: ['Endocrinology'] },
  { label: 'Dizziness', value: 'dizziness', specialties: ['Neurology', 'General Medicine'] },
  { label: 'Palpitations', value: 'palpitations', specialties: ['Cardiology'] },
  { label: 'Cough', value: 'cough', specialties: ['Pulmonology'] },
  { label: 'Ear pain', value: 'ear_pain', specialties: ['ENT'] },
  { label: 'Sore throat', value: 'sore_throat', specialties: ['ENT'] },

  // small, common additions (kept tiny to avoid clutter)
  { label: 'Abdominal pain', value: 'abdominal_pain', specialties: ['Gastroenterology', 'General Medicine'] },
  { label: 'Back pain', value: 'back_pain', specialties: ['Orthopedics'] },
  { label: 'Skin rash', value: 'skin_rash', specialties: ['Dermatology'] },
];

// --- Large catalog ONLY for autosuggest (does not render as buttons) ---
const EXTRA_SYMPTOMS: SymptomPreset[] = [
  { label: 'Headache', value: 'headache', specialties: ['Neurology', 'General Medicine'] },
  { label: 'Migraine', value: 'migraine', specialties: ['Neurology'] },
  { label: 'Runny nose', value: 'rhinorrhea', specialties: ['ENT', 'General Medicine'] },
  { label: 'Sinus pain', value: 'sinus_pain', specialties: ['ENT'] },
  { label: 'Nasal congestion', value: 'nasal_congestion', specialties: ['ENT'] },
  { label: 'Eye pain', value: 'eye_pain', specialties: ['Ophthalmology'] },
  { label: 'Eye redness', value: 'eye_redness', specialties: ['Ophthalmology'] },
  { label: 'Blurred vision', value: 'blurred_vision', specialties: ['Ophthalmology'] },
  { label: 'Leg swelling', value: 'leg_swelling', specialties: ['Cardiology', 'Nephrology'] },
  { label: 'Nausea or vomiting', value: 'nausea_vomiting', specialties: ['Gastroenterology', 'General Medicine'] },
  { label: 'Diarrhea', value: 'diarrhea', specialties: ['Gastroenterology', 'Infectious Disease'] },
  { label: 'Constipation', value: 'constipation', specialties: ['Gastroenterology'] },
  { label: 'Heartburn / reflux', value: 'heartburn', specialties: ['Gastroenterology'] },
  { label: 'Blood in stool', value: 'hematochezia', specialties: ['Gastroenterology'] },
  { label: 'Jaundice', value: 'jaundice', specialties: ['Gastroenterology'] },
  { label: 'Burning urination', value: 'dysuria', specialties: ['Urology', 'General Medicine'] },
  { label: 'Frequent urination', value: 'urinary_frequency', specialties: ['Urology', 'Endocrinology'] },
  { label: 'Blood in urine', value: 'hematuria', specialties: ['Urology', 'Nephrology'] },
  { label: 'Pelvic pain', value: 'pelvic_pain', specialties: ['Obstetrics & Gynecology', 'Urology', 'Gastroenterology'] },
  { label: 'Vaginal discharge', value: 'vaginal_discharge', specialties: ['Obstetrics & Gynecology'] },
  { label: 'Irregular periods', value: 'irregular_periods', specialties: ['Obstetrics & Gynecology'] },
  { label: 'Missed period', value: 'amenorrhea', specialties: ['Obstetrics & Gynecology', 'Endocrinology'] },
  { label: 'Fatigue', value: 'fatigue', specialties: ['General Medicine', 'Endocrinology'] },
  { label: 'Joint pain', value: 'arthralgia', specialties: ['Rheumatology', 'Orthopedics'] },
  { label: 'Swollen joints', value: 'joint_swelling', specialties: ['Rheumatology'] },
  { label: 'Muscle pain', value: 'myalgia', specialties: ['Rheumatology', 'General Medicine'] },
  { label: 'Neck pain', value: 'neck_pain', specialties: ['Orthopedics'] },
  { label: 'Sprain / strain', value: 'sprain_strain', specialties: ['Orthopedics'] },
  { label: 'Hives', value: 'hives', specialties: ['Allergy & Immunology', 'Dermatology'] },
  { label: 'Itchy skin', value: 'pruritus', specialties: ['Dermatology', 'Allergy & Immunology'] },
  { label: 'Allergic reaction', value: 'allergic_reaction', specialties: ['Allergy & Immunology', 'General Medicine'] },
  { label: 'Depression', value: 'depression', specialties: ['Psychiatry'] },
  { label: 'Anxiety', value: 'anxiety', specialties: ['Psychiatry'] },
  { label: 'Insomnia', value: 'insomnia', specialties: ['Psychiatry'] },
  { label: 'Tremor', value: 'tremor', specialties: ['Neurology'] },
  { label: 'Seizures', value: 'seizures', specialties: ['Neurology'] },
  { label: 'Hearing loss', value: 'hearing_loss', specialties: ['ENT'] },
  { label: 'Ringing in ears', value: 'tinnitus', specialties: ['ENT'] },
];

// Combined catalog for lookup/mapping (PRESETS stay visually small)
const ALL_SYMPTOMS: SymptomPreset[] = dedupeByValue([...PRESETS, ...EXTRA_SYMPTOMS]);

function dedupeByValue(arr: SymptomPreset[]) {
  const seen = new Set<string>();
  const out: SymptomPreset[] = [];
  for (const x of arr) {
    if (!seen.has(x.value)) { seen.add(x.value); out.push(x); }
  }
  return out;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
}

// Infer specialties from raw free-typed symptom (best-effort keyword map)
function inferSpecialties(raw: string): string[] {
  const s = raw.toLowerCase();

  const add = (...arr: string[]) => arr;
  let out: string[] = [];

  // Cardiology
  if (/(chest|angina|pressure|tightness).*(pain)?/.test(s) || /palpitation|tachy|faint/.test(s)) out = out.concat(add('Cardiology'));
  if (/high blood pressure|hypertension|bp\b/.test(s)) out = out.concat(add('Cardiology'));
  if (/leg swelling|ankle swelling|edema/.test(s)) out = out.concat(add('Cardiology', 'Nephrology'));

  // Pulmonology
  if (/shortness of breath|dyspnea|wheeze|asthma|cough/.test(s)) out = out.concat(add('Pulmonology'));

  // ENT
  if (/ear pain|earache|hearing|tinnitus/.test(s)) out = out.concat(add('ENT'));
  if (/sore throat|throat pain|tonsil|hoarse/.test(s)) out = out.concat(add('ENT'));
  if (/sinus|congestion|runny nose|nasal/.test(s)) out = out.concat(add('ENT'));

  // Gastroenterology
  if (/abdominal|stomach|belly|tummy/.test(s)) out = out.concat(add('Gastroenterology', 'General Medicine'));
  if (/nausea|vomit|diarrhea|constipation|heartburn|reflux|bloody stool|blood in stool|jaundice/.test(s)) out = out.concat(add('Gastroenterology'));

  // Neurology
  if (/headache|migraine|seizure|tremor|dizziness|vertigo|numb|weakness|tingling/.test(s)) out = out.concat(add('Neurology', 'General Medicine'));

  // Dermatology / Allergy
  if (/rash|hives|itch|pruritus|acne|eczema/.test(s)) out = out.concat(add('Dermatology'));
  if (/allerg|anaphylaxis/.test(s)) out = out.concat(add('Allergy & Immunology', 'General Medicine'));

  // Endocrinology
  if (/high blood sugar|hyperglyc|diabetes|hypoglyc/.test(s)) out = out.concat(add('Endocrinology'));
  if (/thyroid/.test(s)) out = out.concat(add('Endocrinology'));

  // Urology / Nephrology
  if (/urination|urinary|dysuria|pee|hematuria/.test(s)) out = out.concat(add('Urology'));
  if (/kidney|renal/.test(s)) out = out.concat(add('Nephrology'));

  // Obstetrics & Gynecology
  if (/pelvic pain|vaginal|period|menstru|pregnan|amenorrhea|fertility/.test(s)) out = out.concat(add('Obstetrics & Gynecology'));

  // Ophthalmology
  if (/eye|vision|redness|blurry/.test(s)) out = out.concat(add('Ophthalmology'));

  // Rheumatology / Orthopedics
  if (/joint pain|arthritis|swollen joint/.test(s)) out = out.concat(add('Rheumatology'));
  if (/back pain|neck pain|sprain|strain|fracture|injury/.test(s)) out = out.concat(add('Orthopedics'));

  // Psychiatry
  if (/depress|anxiety|panic|insomnia|sleep/.test(s)) out = out.concat(add('Psychiatry'));

  // General Medicine common
  if (/fever|fatigue|tired|chills/.test(s)) out = out.concat(add('General Medicine'));

  // Dedup
  return Array.from(new Set(out));
}

export default function AutoTriagePage() {
  const router = useRouter();
  const [freeText, setFreeText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [age, setAge] = useState<number | ''>('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | ''>('');
  const [query, setQuery] = useState('');

  // map value -> symptom
  const byValue = useMemo(() => {
    const m = new Map<string, SymptomPreset>();
    ALL_SYMPTOMS.forEach(s => m.set(s.value, s));
    return m;
  }, []);

  // map label -> symptom for quick label matching in autosuggest
  const byLabelLower = useMemo(() => {
    const m = new Map<string, SymptomPreset>();
    ALL_SYMPTOMS.forEach(s => m.set(s.label.toLowerCase(), s));
    return m;
  }, []);

  // specialties from *all* selected symptoms (including autosuggest)
  const selectedSpecialties = useMemo(() => {
    const specs = new Set<string>();
    selected.forEach(v => {
      const s = byValue.get(v);
      const arr = s?.specialties ?? []; // ← no default to General Medicine
      arr.forEach(x => specs.add(x));
    });
    return Array.from(specs);
  }, [selected, byValue]);

  // autosuggest list filtered by query (kept short)
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // prefix first, then substring; cap length to keep it tidy
    const starts = ALL_SYMPTOMS.filter(s => s.label.toLowerCase().startsWith(q));
    const contains = ALL_SYMPTOMS.filter(s => !s.label.toLowerCase().startsWith(q) && s.label.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 10);
  }, [query]);

  const onToggle = (v: string) => {
    setSelected(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const addFromQuery = () => {
    const raw = query.trim();
    if (!raw) return;
    const known = byLabelLower.get(raw.toLowerCase());
    let value: string;
    let specialties: string[] = [];
    if (known) {
      value = known.value;
      specialties = known.specialties;
    } else {
      // free symptom -> infer specialties
      value = slugify(raw);
      specialties = inferSpecialties(raw);
      if (!byValue.has(value)) {
        const newSym: SymptomPreset = { label: raw, value, specialties };
        ALL_SYMPTOMS.push(newSym);
        byValue.set(value, newSym);
        byLabelLower.set(raw.toLowerCase(), newSym);
      }
    }
    setSelected(prev => prev.includes(value) ? prev : [...prev, value]);
    setQuery('');
  };

  const removeSelected = (v: string) => {
    setSelected(prev => prev.filter(x => x !== v));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selected.length) params.set('symptoms', selected.join(','));
    if (selectedSpecialties.length) params.set('specialties', selectedSpecialties.join(','));
    if (freeText.trim()) params.set('notes', freeText.trim());
    if (age !== '') params.set('age', String(age));
    if (sex) params.set('sex', sex);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('triage.last', JSON.stringify({
        selected, freeText, age, sex
      }));
    }

    router.push(`/clinicians?${params.toString()}`);
  };

  // selected chips with labels (includes autosuggest + presets)
  const selectedLabeled = useMemo(() => {
    return selected.map(v => byValue.get(v) || { label: v, value: v, specialties: [] });
  }, [selected, byValue]);

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Auto Triage</h1>
        <Link href="/clinicians" className="text-sm text-indigo-700 hover:underline">
          Skip --> Clinicians
        </Link>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Compact presets grid (unchanged feel, minimal extra options) */}
        <section className="bg-white rounded-2xl shadow-sm border p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Select common symptoms</h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => {
              const active = selected.includes(p.value);
              return (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => onToggle(p.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${
                    active
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Selected chips (includes autosuggest picks) */}
          {selectedLabeled.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedLabeled.map(s => (
                <span key={s.value} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 text-xs">
                  {s.label}
                  <button
                    type="button"
                    onClick={() => removeSelected(s.value)}
                    className="text-slate-500 hover:text-slate-800"
                    aria-label={`Remove ${s.label}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {!!selectedSpecialties.length && (
            <p className="mt-3 text-xs text-slate-500">
              Likely specialties: {selectedSpecialties.join(', ')}
            </p>
          )}
        </section>

        {/* Type-ahead (autosuggest) to access larger catalog without visual clutter */}
        <section className="bg-white rounded-2xl shadow-sm border p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Add other symptoms (type to suggest)</h2>

          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFromQuery(); } }}
              placeholder="Start typing (e.g., headache, nausea, insomnia…) then press Enter"
              className="w-full rounded-lg border p-3 text-sm"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
            />

            {/* simple dropdown */}
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow text-sm max-h-60 overflow-auto">
                {suggestions.map(s => (
                  <li key={s.value}>
                    <button
                      type="button"
                      onClick={() => { setQuery(s.label); addFromQuery(); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50"
                    >
                      {s.label}
                      {s.specialties.length > 0 && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({s.specialties.join(', ')})
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500">
            We’ll auto-map common typed symptoms to specialties where possible. If we can’t infer any,
            it won’t restrict specialties (you can still proceed).
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Describe your symptoms</h2>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="e.g., Started 2 days ago, worse on exertion..."
            className="w-full h-28 rounded-lg border p-3 text-sm"
          />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Age</label>
              <input
                type="number"
                min={0}
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border p-2 text-sm"
                placeholder="e.g., 34"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Sex</label>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as any)}
                className="w-full rounded-lg border p-2 text-sm"
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other / Prefer not to say</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm"
          >
            Submit & View Matched Clinicians
          </button>

          <Link
            href="/clinicians"
            className="text-sm text-indigo-700 hover:underline"
          >
            Skip --> Clinicians
          </Link>
        </div>
      </form>
    </main>
  );
}
