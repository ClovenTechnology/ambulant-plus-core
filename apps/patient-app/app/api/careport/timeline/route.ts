import { NextRequest, NextResponse } from "next/server";
const MOCK = [
  { status:"REQUESTED", at: new Date(Date.now()-60*60*1000).toISOString() },
  { status:"PHARMACY_MATCHED", at: new Date(Date.now()-50*60*1000).toISOString() },
  { status:"RIDER_ASSIGNED", at: new Date(Date.now()-40*60*1000).toISOString() },
  { status:"EN_ROUTE", at: new Date(Date.now()-20*60*1000).toISOString() },
  { status:"DELIVERED", at: new Date(Date.now()-5*60*1000).toISOString() }
];
export async function GET(req: NextRequest){
  const id = new URL(req.url).searchParams.get("id") || "ERX-1001";
  return NextResponse.json({ id, timeline: MOCK });
}
