// apps/clinician-app/app/api/erx/send/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
const outboxFile = path.join(process.cwd(), "data-erx-outbox.json");
export async function POST(req:Request){
  const rx = await req.json();
  let list:any[] = [];
  try{ list = JSON.parse(await fs.readFile(outboxFile,"utf8")); }catch{}
  list.unshift({ id:`RX-${Date.now()}`, at:new Date().toISOString(), ...rx });
  await fs.writeFile(outboxFile, JSON.stringify(list,null,2), "utf8");
  return NextResponse.json({ ok:true, id:list[0].id });
}