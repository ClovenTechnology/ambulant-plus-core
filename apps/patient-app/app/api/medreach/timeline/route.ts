import { NextRequest, NextResponse } from "next/server";
const MOCK = [
  { status:"PHLEB_ASSIGNED", at: new Date(Date.now()-70*60*1000).toISOString() },
  { status:"TRAVELING", at: new Date(Date.now()-55*60*1000).toISOString() },
  { status:"ARRIVED", at: new Date(Date.now()-40*60*1000).toISOString() },
  { status:"SAMPLE_COLLECTED", at: new Date(Date.now()-35*60*1000).toISOString() },
  { status:"LAB_RECEIVED", at: new Date(Date.now()-20*60*1000).toISOString() },
  { status:"COMPLETE", at: new Date(Date.now()-10*60*1000).toISOString() }
];
export async function GET(req: NextRequest){
  const id = new URL(req.url).searchParams.get("id") || "LAB-2001";
  return NextResponse.json({ id, timeline: MOCK });
}
