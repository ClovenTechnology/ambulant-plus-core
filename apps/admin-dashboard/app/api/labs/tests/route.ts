import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'; import path from 'path'
const labsPath = path.join(process.cwd(),'../../packages/medreach/labs.json')
async function readJsonSafe(f:string){ const t=await fs.readFile(f,'utf-8'); return JSON.parse(t.replace(/^\uFEFF/,'')) }
export async function POST(req:NextRequest){ const {labId,code,name,priceZAR,etaDays}=await req.json(); const data=await readJsonSafe(labsPath); const lab=data.labs.find((l:any)=>l.id===labId); if(!lab) return NextResponse.json({error:'Lab not found'},{status:404}); lab.tests.push({code,name,priceZAR,etaDays}); await fs.writeFile(labsPath,JSON.stringify(data,null,2),'utf-8'); return NextResponse.json(data) }