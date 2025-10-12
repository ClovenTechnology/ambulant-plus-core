import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

function jsonParseSafe(txt:string){ try{ return JSON.parse(txt); }catch{ return []; } }

const devicesPath = path.join(process.cwd(), "../../packages/iot-sdk/devices.json");

export async function POST(req: Request){
  try{
    const body = await req.json();
    const { id, action }:{ id:string; action:"toggleActive"|"toggleMode" } = body || {};
    if(!id || !action) return NextResponse.json({error:"id & action required"}, {status:400});

    let raw = await fs.readFile(devicesPath);
    // strip BOM if present
    if(raw.length >= 3 && raw[0]===0xEF && raw[1]===0xBB && raw[2]===0xBF){ raw = raw.slice(3); }
    const list = jsonParseSafe(raw.toString());

    const idx = list.findIndex((d:any)=>d.id===id);
    if(idx<0) return NextResponse.json({error:"device not found"}, {status:404});

    const dev = list[idx];
    if(action==="toggleActive"){ dev.active = !dev.active; }
    if(action==="toggleMode"){ dev.mode = (dev.mode==="mock" ? "live" : "mock"); }

    await fs.writeFile(devicesPath, Buffer.from(JSON.stringify(list, null, 2), "utf8"));
    return NextResponse.json({ ok:true, device: dev });
  }catch(e:any){
    return NextResponse.json({error:e?.message||"fail"}, {status:500});
  }
}