import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const storePath = path.join(process.cwd(), '../../packages/medreach')
const uploadsDir = path.join(storePath, 'uploads')
const reportsPath = path.join(storePath, 'reports.json')

async function ensureUploads(){
  try { await fs.mkdir(uploadsDir, { recursive: true }) } catch {}
}
async function readJsonSafe(file:string){
  const txt = await fs.readFile(file, 'utf-8').then(t=>t.replace(/^\uFEFF/, ''))
  return JSON.parse(txt)
}

export async function POST(req: NextRequest){
  await ensureUploads()
  const form = await req.formData()
  const file = form.get('file') as unknown as File | null
  const id = String(form.get('id') || 'LAB-' + Date.now())
  const patient = String(form.get('patient') || '')
  const labId = String(form.get('labId') || '')
  const test = String(form.get('test') || '')

  if(!file) return NextResponse.json({ error:'No file' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const safe = id.replace(/[^a-z0-9-_]/gi,'_')
  const filename = safe + '.' + ext
  const filepath = path.join(uploadsDir, filename)
  await fs.writeFile(filepath, buf)

  // update reports.json
  const data = await readJsonSafe(reportsPath).catch(()=>({reports:[]}))
  const existing = data.reports.find((r:any)=>r.id===id)
  if(existing){
    existing.filePath = filename
    existing.status = 'Ready'
    existing.dateReady = new Date().toISOString().slice(0,10)
  } else {
    data.reports.push({ id, patient, labId, test, status:'Ready', dateReady: new Date().toISOString().slice(0,10), filePath: filename })
  }
  await fs.writeFile(reportsPath, JSON.stringify(data, null, 2), 'utf-8')

  const previewUrl = `/api/medreach/reports/file?name=${encodeURIComponent(filename)}`
  return NextResponse.json({ id, previewUrl })
}
