// apps/patient-app/lib/chart.ts
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartTypeRegistry,
} from 'chart.js';

let registered = false;

/**
 * SAFE GLOBAL REGISTRATION (Next.js + StrictMode safe)
 */
export function ensureChartRegistration(): void {
  if (registered) return;

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler
  );

  registered = true;
}

/**
 * Backward compatibility alias (FIXES YOUR BUILD ERROR)
 * Some files import registerCharts → we support it safely
 */
export function registerCharts(): void {
  ensureChartRegistration();
}

/**
 * Dev-only reset (HMR debugging)
 */
export function resetChartRegistry(): void {
  registered = false;
}

/**
 * Optional type helper (prevents Chart typing issues elsewhere)
 */
export type ChartInstance<T extends keyof ChartTypeRegistry = 'line'> =
  ChartJS<T>;