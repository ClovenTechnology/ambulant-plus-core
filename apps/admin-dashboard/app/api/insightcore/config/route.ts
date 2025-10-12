import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'; import path from 'path'
const cfgPath = path.join(process.cwd(),'../../packages/insightcore/config.json')
async function readJsonSafe(f:string){ const t=await fs.readFile(f,'utf-8'); return JSON.parse(t.replace(/^\uFEFF/,'')) }
export async function GET(){ return NextResponse.json(await readJsonSafe(cfgPath)) }
export async function PUT(req:NextRequest){ const body=await req.json(); await fs.writeFile(cfgPath,JSON.stringify(body,null,2),'utf-8'); return NextResponse.json({ok:true}) }