// apps/clinician-app/app/api/erx/_lib_db_compat.ts
import fs from 'node:fs/promises';
import path from 'node:path';

type DemoDb = Record<string, any>;

const DB_DIR = path.join(process.cwd(), '.runtime');
const DB_FILE = path.join(DB_DIR, 'clinician-demo-db.json');

function defaultDb(): DemoDb {
  return {
    appointments: [],
    encounters: [],
    encounterSummaries: [],
    erx: [],
    sicknotes: [],
    fitnesscerts: [],
    docs: [],
  };
}

export async function readDb(): Promise<DemoDb> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { ...defaultDb(), ...(parsed || {}) };
  } catch {
    return defaultDb();
  }
}

export async function writeDb(db: DemoDb): Promise<void> {
  await fs.mkdir(DB_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;

  await fs.writeFile(tmp, JSON.stringify(db ?? defaultDb(), null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}