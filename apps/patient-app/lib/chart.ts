// apps/patient-app/lib/chart.ts
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  TimeSeriesScale,
} from 'chart.js';

let registered = false;
export function ensureChartRegistration() {
  if (registered) return;
  ChartJS.register(
    LineElement,
    PointElement,
    LineController,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    TimeSeriesScale
  );
  registered = true;
}
