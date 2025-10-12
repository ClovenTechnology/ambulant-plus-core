import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const uploadsDir = path.join(process.cwd(), '../../packages/medreach/uploads')
const registry = path.join(process.cwd(), '../../packages/medreach/reports.json')

async function readJsonSafe(file:string){
  try{ const txt = await fs.readFile(file,'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/,'')) }catch{ return {reports:[]} }
}

export async function GET(){
  const reg = await readJsonSafe(registry)
  return NextResponse.json(reg)
}

export async function POST(req: NextRequest){
  const form = await req.formData()
  const file = form.get('file') as File | null
  const reportId = String(form.get('id')||'').trim()
  const patient = String(form.get('patient')||'').trim() || 'Unknown'
  const test = String(form.get('test')||'').trim() || 'Unknown Test'
  const labId = String(form.get('labId')||'LAB-00').trim()
  if(!file || !reportId) return NextResponse.json({error:'id and file required'}, {status:400})

  await fs.mkdir(uploadsDir,{recursive:true})
  const bytes = Buffer.from(await file.arrayBuffer())
  const original = (file as any).name || 'upload.bin'
  const safeName = `${reportId}-${original}`.replace(/[^a-zA-Z0-9._-]/g,'_')
  await fs.writeFile(path.join(uploadsDir, safeName), bytes)

  const reg = await readJsonSafe(registry)
  const entry = { id: reportId, patient, labId, test, status:'ready', fileName: safeName, dateReady: new Date().toISOString().slice(0,10) }
  const idx = (reg.reports||[]).findIndex((r:any)=>r.id===reportId)
  if(idx>=0) reg.reports[idx]=entry; else reg.reports=[...(reg.reports||[]), entry]
  await fs.writeFile(registry, JSON.stringify(reg,null,2), 'utf-8')
  return NextResponse.json({ok:true, saved: entry})
}
