
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const STORE = path.join(process.cwd(), "../../.data/reports");
const SAMPLE = path.join(process.cwd(), "../../apps/patient-app/public"); // fallback

export async function GET(req: NextRequest){
  const name = new URL(req.url).searchParams.get("name") || "sample.pdf";
  const filePath = path.join(STORE, name);
  const altPath  = path.join(SAMPLE, name);
  try{
    const pick = await fs.readFile(filePath).catch(()=>fs.readFile(altPath));
    const ext = (name.split('.').pop()||'').toLowerCase();
    const type = ext === 'pdf' ? 'application/pdf'
      : (['png','jpg','jpeg','webp','gif'].includes(ext) ? `image/${ext}` : 'application/octet-stream');
    return new NextResponse(pick, { headers: { 'Content-Type': type } });
  }catch(e){
    return NextResponse.json({ error:"not found", detail: String(e) }, { status: 404 });
  }
}
