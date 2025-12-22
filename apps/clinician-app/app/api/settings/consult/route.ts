// apps/clinician-app/app/api/settings/consult/route.ts
import { NextResponse } from "next/server";
let preset = { lengthMin: 30 };
export async function GET(){ return NextResponse.json(preset); }
export async function POST(req:Request){ preset = await req.json(); return NextResponse.json(preset); }