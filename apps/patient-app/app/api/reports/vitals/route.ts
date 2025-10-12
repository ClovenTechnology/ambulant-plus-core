import { NextResponse } from "next/server";

// Example derived report from vitals history
export async function GET() {
  const mock = {
    lastUpdated: new Date().toISOString(),
    summary: {
      avgHR: 76,
      avgSpO2: 98,
      avgTempC: 36.7,
      avgSys: 119,
      avgDia: 77,
      avgBMI: 24.2,
    },
    latest: {
      ts: new Date().toISOString(),
      hr: 78,
      spo2: 99,
      temp_c: 36.8,
      sys: 118,
      dia: 76,
      bmi: 24.3,
    },
    trend: [
      { ts: new Date(Date.now() - 3600e3*6).toISOString(), hr: 72, spo2: 98 },
      { ts: new Date(Date.now() - 3600e3*3).toISOString(), hr: 74, spo2: 99 },
      { ts: new Date().toISOString(), hr: 78, spo2: 98 },
    ]
  };

  return NextResponse.json(mock);
}
