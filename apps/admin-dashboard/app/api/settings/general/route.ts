import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
const settingsPath = path.join(process.cwd(), "../../.data/settings/general.json");
async function readSettings(){
  try{
    const raw = await fs.readFile(settingsPath, "utf-8");
    const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    return JSON.parse(clean);
  }catch{
    return {
      reportAccessDays: 60,
      reportPermissions: {
        premium: { view:true, download:true, print:true },
        free: { view:true, download:false, print:false }
      },
      pdfWatermark: { enabled:true, defaultText:"AMBULANT+ SAMPLE" }
    };
  }
}
export async function GET(){
  const s = await readSettings();
  return NextResponse.json(s);
}
export async function POST(req: NextRequest){
  const body = await req.json();
  const next = { ...body, updatedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), "utf-8");
  return NextResponse.json({ ok:true });
}
