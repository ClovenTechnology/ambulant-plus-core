import type { Chart, Plugin, ScriptableContext } from 'chart.js';

// British-style timestamp: DD Mon YYYY HH:mm:ss
export const fmtTs = (iso?: string) => {
  if (!iso) return 'â€”';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
};

// Format to 0â€“2 dp, returning an em dash for invalid
export const fmt2 = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'â€”';
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(2);
};

// In-chart out-of-range colouring for line segments
// Example thresholds: warn [55,110], alert [50,130]
export function segmentColorFn(bounds: { warn: [number, number]; alert: [number, number] }) {
  return (ctx: ScriptableContext<'line'>) => {
    const v = (ctx?.p0 as any)?.parsed?.y as number | undefined;
    if (typeof v !== 'number') return undefined;
    const [wMin, wMax] = bounds.warn;
    const [aMin, aMax] = bounds.alert;
    if (v < aMin || v > aMax) return 'rgb(244,63,94)';   // red
    if (v < wMin || v > wMax) return 'rgb(245,158,11)';   // amber
    return undefined;                                     // default color
  };
}

// Nice gradient fill for sci-fi area charts
export function makeAreaFill(ctx: CanvasRenderingContext2D, color: string) {
  const g = ctx.createLinearGradient(0, 0, 0, 120);
  const toRGBA = (c: string, a: number) =>
    c.startsWith('rgb(') ? c.replace('rgb', 'rgba').replace(')', `, ${a})`) : c;
  g.addColorStop(0, toRGBA(color, 0.35));
  g.addColorStop(1, toRGBA(color, 0.05));
  return g;
}

// Draw thin vertical connectors that link BP sys/dia pairs (permanent)
export const bpConnectorPlugin: Plugin<'line'> = {
  id: 'bpConnector',
  afterDatasetsDraw(chart: Chart) {
    const anyChart = chart as any;
    const { ctx, chartArea } = anyChart;
    const metas = chart.getSortedVisibleDatasetMetas();
    const sysMeta = metas.find((m: any) => m.dataset?.label?.includes('Systolic'));
    const diaMeta = metas.find((m: any) => m.dataset?.label?.includes('Diastolic'));
    if (!sysMeta || !diaMeta) return;

    const len = Math.min(sysMeta.data.length, diaMeta.data.length);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    for (let i = 0; i < len; i++) {
      const sx = sysMeta.data[i]?.x; const sy = sysMeta.data[i]?.y;
      const dy = diaMeta.data[i]?.y;
      if (sx == null || sy == null || dy == null) continue;
      if (sx < chartArea.left || sx > chartArea.right) continue;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, dy);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// Center text for Doughnut (shows â€œ98% / SpOâ‚‚â€)
export const centerTextPlugin: Plugin<'doughnut'> = {
  id: 'centerText',
  beforeDraw(chart) {
    const opts: any = (chart.options as any)?.plugins?.centerText;
    if (!opts?.lines?.length) return;
    const anyChart = chart as any;
    const { ctx } = anyChart;
    const meta = chart.getDatasetMeta(0) as any;
    const el = meta?.data?.[0];
    const x = el?.x ?? chart.chartArea.left + chart.chartArea.width / 2;
    const y = el?.y ?? chart.chartArea.top + chart.chartArea.height / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.color || '#0f172a';
    ctx.font = '600 20px Inter, ui-sans-serif, system-ui';
    ctx.fillText(opts.lines[0], x, y - 8);
    if (opts.lines[1]) {
      ctx.font = '400 11px Inter, ui-sans-serif, system-ui';
      ctx.globalAlpha = 0.8;
      ctx.fillText(opts.lines[1], x, y + 12);
    }
    ctx.restore();
  },
};
