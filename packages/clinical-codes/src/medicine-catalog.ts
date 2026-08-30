// packages/clinical-codes/src/medicine-catalog.ts
import { searchRxNorm } from './rxnorm';

export type MedicineCode = {
  system: 'nappi' | 'rxnorm' | 'atc' | 'local_sa';
  code: string;
  display?: string;
};

export type MedicineCatalogItem = {
  id: string;
  label: string;
  name: string;
  genericName?: string;
  brandName?: string;
  aliases: string[];
  codes: MedicineCode[];
  source: 'local_sa_seed' | 'rxnorm' | 'formulary';
  country: 'ZA' | 'US' | 'GLOBAL';
  prescriptionRequired?: boolean;
  strength?: string;
  doseForm?: string;
  route?: string;
  packSize?: string;
  score?: number;
};

const SA_MEDICINE_SEED: MedicineCatalogItem[] = [
  item('med-paracetamol', 'Paracetamol', ['panado', 'calpol', 'acetaminophen', 'para'], [{ system: 'rxnorm', code: '161', display: 'Acetaminophen' }]),
  item('med-amoxicillin', 'Amoxicillin', ['amoxil', 'amoxicillin 500', 'amoxicillin/clavulanate'], [{ system: 'rxnorm', code: '723', display: 'Amoxicillin' }], true),
  item('med-co-amoxiclav', 'Amoxicillin + clavulanic acid', ['co-amoxiclav', 'co amoxiclav', 'augmentin', 'amoxyclav', 'amoxicillin clavulanate'], [], true),
  item('med-ibuprofen', 'Ibuprofen', ['brufen', 'nurofen'], [{ system: 'rxnorm', code: '5640', display: 'Ibuprofen' }]),
  item('med-aspirin', 'Aspirin', ['disprin', 'acetylsalicylic acid'], [{ system: 'rxnorm', code: '1191', display: 'Aspirin' }]),
  item('med-metformin', 'Metformin', ['glucophage', 'metformin xr'], [{ system: 'rxnorm', code: '6809', display: 'Metformin' }], true),
  item('med-amlodipine', 'Amlodipine', ['norvasc'], [{ system: 'rxnorm', code: '17767', display: 'Amlodipine' }], true),
  item('med-losartan', 'Losartan', ['cozaar'], [{ system: 'rxnorm', code: '52175', display: 'Losartan' }], true),
  item('med-enalapril', 'Enalapril', ['renitec'], [{ system: 'rxnorm', code: '3827', display: 'Enalapril' }], true),
  item('med-hydrochlorothiazide', 'Hydrochlorothiazide', ['hctz', 'hydrex'], [{ system: 'rxnorm', code: '5487', display: 'Hydrochlorothiazide' }], true),
  item('med-atorvastatin', 'Atorvastatin', ['lipitor'], [{ system: 'rxnorm', code: '83367', display: 'Atorvastatin' }], true),
  item('med-simvastatin', 'Simvastatin', ['zocor'], [{ system: 'rxnorm', code: '36567', display: 'Simvastatin' }], true),
  item('med-omeprazole', 'Omeprazole', ['losec'], [{ system: 'rxnorm', code: '7646', display: 'Omeprazole' }]),
  item('med-pantoprazole', 'Pantoprazole', ['controloc'], [{ system: 'rxnorm', code: '40790', display: 'Pantoprazole' }]),
  item('med-salbutamol', 'Salbutamol', ['albuterol', 'ventolin'], [{ system: 'rxnorm', code: '435', display: 'Albuterol' }], true),
  item('med-prednisone', 'Prednisone', ['prednisolone', 'cortisone'], [{ system: 'rxnorm', code: '8640', display: 'Prednisone' }], true),
  item('med-cetirizine', 'Cetirizine', ['zyrtec'], [{ system: 'rxnorm', code: '20610', display: 'Cetirizine' }]),
  item('med-loratadine', 'Loratadine', ['clarityne', 'claritin'], [{ system: 'rxnorm', code: '28889', display: 'Loratadine' }]),
  item('med-azithromycin', 'Azithromycin', ['zithromax'], [{ system: 'rxnorm', code: '18631', display: 'Azithromycin' }], true),
  item('med-doxycycline', 'Doxycycline', ['doxycline'], [{ system: 'rxnorm', code: '3640', display: 'Doxycycline' }], true),
  item('med-ciprofloxacin', 'Ciprofloxacin', ['ciproxin'], [{ system: 'rxnorm', code: '2551', display: 'Ciprofloxacin' }], true),
  item('med-fluconazole', 'Fluconazole', ['diflucan'], [{ system: 'rxnorm', code: '4450', display: 'Fluconazole' }], true),
];

function item(
  id: string,
  label: string,
  aliases: string[],
  codes: MedicineCode[],
  prescriptionRequired = false,
): MedicineCatalogItem {
  return {
    id,
    label,
    name: label,
    genericName: label,
    aliases,
    codes: [{ system: 'local_sa', code: id, display: label }, ...codes],
    source: 'local_sa_seed',
    country: 'ZA',
    prescriptionRequired,
  };
}

function norm(value: unknown) {
  return String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function tokens(value: unknown) {
  return norm(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreLocal(item: MedicineCatalogItem, q: string) {
  const qn = norm(q);
  const haystack = [item.label, item.name, item.genericName, item.brandName, ...item.aliases, ...item.codes.map((c) => c.code), ...item.codes.map((c) => c.display)].filter(Boolean);
  let score = 0;

  for (const value of haystack) {
    const text = norm(value);
    if (!text) continue;
    if (text === qn) score += 10;
    else if (text.startsWith(qn)) score += 6;
    else if (text.includes(qn) && qn.length >= 3) score += 3;
  }

  const queryTokens = tokens(q);
  const textTokens = tokens(haystack.join(' '));
  score += queryTokens.filter((t) => textTokens.includes(t)).length;

  return score;
}

function primaryRxNormCode(item: MedicineCatalogItem) {
  return item.codes.find((c) => c.system === 'rxnorm')?.code;
}

export type SearchMedicineOptions = {
  limit?: number;
  includeRxNorm?: boolean;
};

export async function searchMedicines(query: string, opts: SearchMedicineOptions = {}) {
  const { limit = 20, includeRxNorm = true } = opts;
  const q = query.trim();
  if (q.length < 2) return [];

  const local = SA_MEDICINE_SEED
    .map((entry) => ({ ...entry, score: scoreLocal(entry, q) }))
    .filter((entry) => (entry.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const rxRows = includeRxNorm
    ? await searchRxNorm(q, { limit: Math.max(limit, 20), preferGeneric: true })
    : [];

  const rx = rxRows.map((row: any) => {
    const label = String(row.name || row.title || row.rxcui || '').trim();
    const rxcui = String(row.rxcui || '').trim();

    return {
      id: rxcui ? 'rxnorm-' + rxcui : 'rxnorm-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label,
      name: label,
      genericName: row.generic === false ? undefined : label,
      aliases: Array.isArray(row.synonyms) ? row.synonyms : [],
      codes: rxcui ? [{ system: 'rxnorm' as const, code: rxcui, display: label }] : [],
      source: 'rxnorm' as const,
      country: 'GLOBAL' as const,
      strength: row.strength ? String(row.strength) : undefined,
      doseForm: row.doseForm ? String(row.doseForm) : undefined,
      route: (row as any).route ? String((row as any).route) : undefined,
      score: Number(row.score || 0),
    };
  }).filter((entry) => entry.label);

  const merged = [...local, ...rx];
  const seen = new Set<string>();

  return merged
    .filter((entry) => {
      const rxCode = primaryRxNormCode(entry);
      const key = (rxCode ? 'rxnorm:' + rxCode : entry.label).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const localBiasA = a.source === 'local_sa_seed' ? 2 : 0;
      const localBiasB = b.source === 'local_sa_seed' ? 2 : 0;
      return ((b.score || 0) + localBiasB) - ((a.score || 0) + localBiasA);
    })
    .slice(0, limit);
}
