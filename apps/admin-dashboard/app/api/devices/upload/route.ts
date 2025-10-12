import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const devicesPath = path.join(process.cwd(), '../../packages/iot-sdk/devices.json')
const uploadsDir = path.join(process.cwd(), '../../packages/iot-sdk/uploads')

async function readJsonSafe(file:string){ try{ const txt = await fs.readFile(file, 'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/, '')) }catch{ return [] } }

export async function POST(req: NextRequest){
  const form = await req.formData()
  const id = String(form.get('id')||'').trim()
  const name = String(form.get('name')||'').trim() || id
  const streamsRaw = String(form.get('streams')||'')
  const streams = streamsRaw.split(',').map(s=>s.trim()).filter(Boolean)
  const file = form.get('file') as File | null
  if(!id || not file) return NextResponse.json({error:'id and file required'},{status:400})

  await fs.mkdir(uploadsDir, { recursive: true })
  const fileName = `${id}.zip`
  const dest = path.join(uploadsDir, fileName)
  const bytes = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(dest, bytes)

  const list = await readJsonSafe(devicesPath)
  const exists = list.find((d:any)=>d.id===id)
  const entry = { id, name, active: false, mode: 'mock', streams, config: { samplingRateHz: 1 } }
  if(exists){ Object.assign(exists, entry) } else { list.push(entry) }
  await fs.writeFile(devicesPath, JSON.stringify(list, null, 2), 'utf-8')

  return NextResponse.json({ ok:true, device: entry, archive: fileName })
}
