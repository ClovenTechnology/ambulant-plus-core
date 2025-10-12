import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'; import path from 'path'; import crypto from 'crypto'
const labsPath = path.join(process.cwd(),'../../packages/medreach/labs.json')
async function readJsonSafe(f:string){ const t=await fs.readFile(f,'utf-8'); return JSON.parse(t.replace(/^\uFEFF/,'')) }
export async function GET(){ return NextResponse.json(await readJsonSafe(labsPath)) }
export async function POST(req:NextRequest){ const body=await req.json(); const data=await readJsonSafe(labsPath); const id=(body.name||('lab-'+crypto.randomUUID())).toLowerCase().replace(/\s+/g,'-'); data.labs.push({id,name:body.name,city:body.city||'',contact:body.contact||'',logoUrl:'',tests:[]}); await fs.writeFile(labsPath,JSON.stringify(data,null,2),'utf-8'); return NextResponse.json(data) }