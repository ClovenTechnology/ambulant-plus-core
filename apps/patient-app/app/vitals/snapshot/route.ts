import { NextRequest, NextResponse } from "next/server";
async function getSnapshot(id: string) {
  switch(id){
    case "nexring":
    case "oura-ring":
    case "ultrahuman-ring":
    case "ringconn-ring":
    case "circular-ring":
    case "galaxy-ring":
      return { heartRate: 72, spo2: 97, temperature: 36.7, hrv: 48, readiness: 84 };
    case "apple-watch":
    case "garmin-watch":
    case "fitbit-watch":
    case "samsung-galaxy-watch":
    case "polar-watch":
      return { heartRate: 70, spo2: 98, temperature: 36.6, steps: 1200, hrv: 42 };
    case "health-monitor":
      return { bpSystolic: 122, bpDiastolic: 82, spo2: 97, respiratoryRate: 16, temperature: 36.6 };
    default:
      return { heartRate: 71, spo2: 97, temperature: 36.6, hrv: 45 };
  }
}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || "nexring";
  const snap = await getSnapshot(id);
  return NextResponse.json(snap);
}
