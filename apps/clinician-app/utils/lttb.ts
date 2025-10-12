// utils/lttb.ts
export type Point = { t: string; v: number };

/**
 * Simple client-side LTTB downsampling.
 * - data: array of points sorted by time
 * - threshold: max points to return
 */
export function lttbDownsample(data: Point[], threshold: number): Point[] {
  if (!Array.isArray(data) || data.length <= threshold) return data.slice();

  const parsed = data.map((d) => ({ x: Date.parse(d.t), y: d.v, t: d.t }));
  const sampled: Point[] = [];
  const every = (parsed.length - 2) / (threshold - 2);

  let a = 0;
  sampled.push({ t: parsed[0].t, v: parsed[0].y });

  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * every) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * every) + 1, parsed.length);

    let avgX = 0, avgY = 0;
    const avgRangeLength = avgRangeEnd - avgRangeStart;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += parsed[j].x;
      avgY += parsed[j].y;
    }
    avgX = avgRangeLength > 0 ? avgX / avgRangeLength : parsed[avgRangeStart]?.x ?? parsed[parsed.length - 1].x;
    avgY = avgRangeLength > 0 ? avgY / avgRangeLength : parsed[avgRangeStart]?.y ?? parsed[parsed.length - 1].y;

    const rangeOffs = Math.floor(i * every) + 1;
    const rangeTo = Math.min(Math.floor((i + 1) * every) + 1, parsed.length);

    const pointAx = parsed[a].x;
    const pointAy = parsed[a].y;

    let maxArea = -1;
    let nextIndex = rangeOffs;

    for (let j = rangeOffs; j < rangeTo && j < parsed.length; j++) {
      const area = Math.abs(
        (pointAx - avgX) * (parsed[j].y - pointAy) - (pointAx - parsed[j].x) * (avgY - pointAy)
      );
      if (area > maxArea) {
        maxArea = area;
        nextIndex = j;
      }
    }

    sampled.push({ t: parsed[nextIndex].t, v: parsed[nextIndex].y });
    a = nextIndex;
  }

  sampled.push({ t: parsed[parsed.length - 1].t, v: parsed[parsed.length - 1].y });
  return sampled;
}
