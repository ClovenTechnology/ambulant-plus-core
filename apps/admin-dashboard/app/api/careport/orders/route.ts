import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
const store = path.join(process.cwd(), "../../data-careport.json");
async function read(){ try{ return JSON.parse(await fs.readFile(store,"utf8")); }catch{ return []; } }
async function write(list:any[]){ await fs.writeFile(store, JSON.stringify(list,null,2), "utf8"); }
export async function GET(){ return NextResponse.json(await read()); }
export async function POST(req:Request){
  const body = await req.json();
  const row = { createdAt: new Date().toISOString(), ...body };
  const list = await read();
  list.unshift(row);
  await write(list);
  return NextResponse.json({ ok:true, id: row.id });
}