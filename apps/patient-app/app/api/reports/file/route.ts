import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
async function watermarkPdf(buffer: Uint8Array, text: string){
  const { PDFDocument, rgb, degrees } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();
  for (const p of pages){
    const { width, height } = p.getSize();
    p.drawText(text, {
      x: width/4, y: height/2,
      size: 36, opacity: 0.15, color: rgb(0.6,0.6,0.6),
      rotate: degrees(45)
    });
  }
  const out = await pdfDoc.save();
  return out;
}
const baseDir = path.join(process.cwd(), "../../sample-reports");
const settingsPath = path.join(process.cwd(), "../../.data/settings/general.json");
export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "RPT-1001";
  const role = url.searchParams.get("role") || "free";
  const adminOverride = url.searchParams.get("admin") === "1";
  let settings: any = {};
  try{
    const raw = await fs.readFile(settingsPath, "utf-8");
    settings = JSON.parse(raw.charCodeAt(0)===0xFEFF? raw.slice(1): raw);
  }catch{}
  const perms = role === "premium" ? (settings.reportPermissions?.premium ?? {view:true,download:true,print:true})
                                   : (settings.reportPermissions?.free ?? {view:true,download:false,print:false});
  if (!perms.view && !adminOverride){
    return NextResponse.json({ error:"forbidden" }, { status: 403 });
  }
  const fileMap: Record<string, { path:string, module:string }> = {
    "RPT-1001": { path: path.join(baseDir, "medreach-sample.pdf"), module:"medreach" },
    "RPT-1002": { path: path.join(baseDir, "careport-sample.pdf"), module:"careport" }
  };
  const item = fileMap[id] || fileMap["RPT-1001"];
  const data = await fs.readFile(item.path);
  const wm = settings.pdfWatermark?.enabled;
  let text = settings.pdfWatermark?.defaultText || "";
  if (item.module === "careport" && settings.pdfWatermark?.careportText) text = settings.pdfWatermark.careportText;
  if (item.module === "medreach" && settings.pdfWatermark?.medreachText) text = settings.pdfWatermark.medreachText;
  const out = (wm && text) ? await watermarkPdf(data, text) : data;
  return new NextResponse(Buffer.from(out), {
    headers: { "Content-Type":"application/pdf", "Cache-Control":"no-store" }
  });
}
