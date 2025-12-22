// apps/patient-app/lib/chartRegistry.ts
// import once to register ChartJS controllers/plugins used across the app

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

let registered = (global as any).__chartjs_registered__ as boolean | undefined;

if (!registered) {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Filler,
    Tooltip,
    Legend
  );
  (global as any).__chartjs_registered__ = true;
}

export default ChartJS;
