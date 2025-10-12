import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
const storeDir = path.join(process.cwd(), "../../.data/rtc");
export async function GET(req: NextRequest){
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({});
  try{
    const raw = await fs.readFile(path.join(storeDir, id + ".json"), "utf-8");
    return NextResponse.json(JSON.parse(raw));
  }catch{
    return NextResponse.json({});
  }
}
export async function POST(req: NextRequest){
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error:"id required" }, { status:400 });
  await fs.mkdir(storeDir, { recursive: true });
  const file = path.join(storeDir, id + ".json");
  let prev:any = {};
  try{ prev = JSON.parse(await fs.readFile(file, "utf-8")); }catch{}
  const next = { ...prev, ...rest };
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf-8");
  return NextResponse.json({ ok:true });
}
