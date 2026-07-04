// packages/clinical-codes/src/lab-catalog.ts

export type LabCatalogItem = {
  id: string;
  code: string;
  codeSystem: 'local_sa_lab_catalog' | 'loinc' | 'yanwide' | 'nhls';
  name: string;
  label: string;
  aliases: string[];
  category: string;
  specimen?: string;
  source: 'local_sa_seed' | 'provider_catalog';
  country: 'ZA';
  score?: number;
};

function lab(id: string, name: string, aliases: string[], category: string, specimen?: string): LabCatalogItem {
  return {
    id,
    code: id.toUpperCase(),
    codeSystem: 'local_sa_lab_catalog',
    name,
    label: name,
    aliases,
    category,
    specimen,
    source: 'local_sa_seed',
    country: 'ZA',
  };
}

const LAB_TESTS: LabCatalogItem[] = [
  lab('lab-fbc', 'Full blood count', ['fbc', 'cbc', 'complete blood count', 'full blood count with differential'], 'Haematology', 'Blood'),
  lab('lab-esr', 'Erythrocyte sedimentation rate', ['esr'], 'Haematology', 'Blood'),
  lab('lab-crp', 'C-reactive protein', ['crp'], 'Chemistry / Inflammation', 'Blood'),
  lab('lab-ue-creatinine', 'Urea, electrolytes and creatinine', ['u&e', 'uec', 'renal function', 'kidney function', 'urea electrolytes creatinine'], 'Chemistry', 'Blood'),
  lab('lab-lft', 'Liver function tests', ['lft', 'liver panel', 'alt ast alp ggt bilirubin albumin'], 'Chemistry', 'Blood'),
  lab('lab-hba1c', 'HbA1c', ['glycated haemoglobin', 'a1c', 'diabetes control'], 'Endocrine / Diabetes', 'Blood'),
  lab('lab-glucose-fasting', 'Fasting glucose', ['fasting blood glucose', 'fbg', 'fasting plasma glucose'], 'Endocrine / Diabetes', 'Blood'),
  lab('lab-lipid', 'Lipid profile', ['cholesterol', 'fasting lipids', 'hdl ldl triglycerides'], 'Chemistry', 'Blood'),
  lab('lab-tsh', 'Thyroid-stimulating hormone', ['tsh', 'thyroid function'], 'Endocrine', 'Blood'),
  lab('lab-tft', 'Thyroid function tests', ['tft', 'tsh ft4 ft3'], 'Endocrine', 'Blood'),
  lab('lab-vitd', 'Vitamin D', ['25-oh vitamin d', '25 hydroxy vitamin d'], 'Chemistry', 'Blood'),
  lab('lab-b12-folate', 'Vitamin B12 and folate', ['b12 folate', 'haematinics'], 'Chemistry', 'Blood'),
  lab('lab-ferritin-iron', 'Iron studies and ferritin', ['ferritin', 'iron studies', 'transferrin saturation'], 'Chemistry', 'Blood'),
  lab('lab-urinalysis', 'Urinalysis', ['urine dipstick', 'urine mcs screen'], 'Urine', 'Urine'),
  lab('lab-urine-mcs', 'Urine microscopy, culture and sensitivity', ['urine mcs', 'urine culture', 'mcs urine'], 'Microbiology', 'Urine'),
  lab('lab-stool-mcs', 'Stool microscopy, culture and sensitivity', ['stool mcs', 'stool culture'], 'Microbiology', 'Stool'),
  lab('lab-sputum-mcs', 'Sputum microscopy, culture and sensitivity', ['sputum mcs', 'sputum culture'], 'Microbiology', 'Sputum'),
  lab('lab-hiv', 'HIV 1/2 antigen/antibody screen', ['hiv test', 'hiv ag ab', 'hiv screening'], 'Serology', 'Blood'),
  lab('lab-hepb', 'Hepatitis B screen', ['hbsag', 'hep b', 'hepatitis b'], 'Serology', 'Blood'),
  lab('lab-hepc', 'Hepatitis C antibody', ['hcv', 'hep c', 'hepatitis c'], 'Serology', 'Blood'),
  lab('lab-pregnancy', 'Pregnancy test', ['beta hcg', 'hcg', 'urine pregnancy', 'serum pregnancy'], 'Pregnancy', 'Urine or blood'),
  lab('lab-malaria', 'Malaria test', ['malaria rapid test', 'malaria smear', 'mps'], 'Infectious Diseases', 'Blood'),
  lab('lab-covid-pcr', 'SARS-CoV-2 PCR', ['covid pcr', 'coronavirus pcr'], 'Virology', 'Nasal/throat swab'),
  lab('lab-inr', 'INR / PT', ['prothrombin time', 'pt inr'], 'Coagulation', 'Blood'),
  lab('lab-aptt', 'APTT', ['activated partial thromboplastin time'], 'Coagulation', 'Blood'),
  lab('lab-d-dimer', 'D-dimer', ['d dimer'], 'Coagulation', 'Blood'),
  lab('lab-troponin', 'Troponin', ['cardiac troponin', 'hs troponin'], 'Cardiac', 'Blood'),
  lab('lab-bnp', 'BNP / NT-proBNP', ['bnp', 'ntprobnp', 'heart failure blood test'], 'Cardiac', 'Blood'),
];

function norm(value: unknown) {
  return String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function tokens(value: unknown) {
  return norm(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreLab(item: LabCatalogItem, query: string) {
  const q = norm(query);
  const haystack = [item.name, item.label, item.code, item.category, item.specimen, ...item.aliases].filter(Boolean);
  let score = 0;

  for (const value of haystack) {
    const text = norm(value);
    if (!text) continue;
    if (text === q) score += 10;
    else if (text.startsWith(q)) score += 6;
    else if (text.includes(q) && q.length >= 2) score += 3;
  }

  const queryTokens = tokens(query);
  const allTokens = tokens(haystack.join(' '));
  score += queryTokens.filter((token) => allTokens.includes(token)).length;

  return score;
}

export function searchLabTests(query: string, opts: { limit?: number } = {}) {
  const { limit = 20 } = opts;
  const q = query.trim();
  if (q.length < 2) return [];

  return LAB_TESTS
    .map((entry) => ({ ...entry, score: scoreLab(entry, q) }))
    .filter((entry) => (entry.score || 0) > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
