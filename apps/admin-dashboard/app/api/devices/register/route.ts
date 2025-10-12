import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import JSZip from 'jszip'

const devicesPath = path.join(process.cwd(), '../../packages/iot-sdk/devices.json')
const uploadsDir  = path.join(process.cwd(), '../../packages/iot-sdk/uploads')

async function readJsonSafe(file:string){ try{ const txt = await fs.readFile(file,'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/,'')) }catch{ return [] } }

export async function POST(req: NextRequest){
  const form = await req.formData()
  const file = form.get('file') as File | null
  if(!file) return NextResponse.json({error:'file required (.zip)'},{status:400})

  const buf = Buffer.from(await file.arrayBuffer())
  const zip = await JSZip.loadAsync(buf)
  const manifestEntry = zip.file('manifest.json')
  if(!manifestEntry) return NextResponse.json({error:'manifest.json not found in zip'},{status:400})
  const manifestTxt = await manifestEntry.async('string')
  let manifest:any
  try{ manifest = JSON.parse(manifestTxt) }catch{ return NextResponse.json({error:'manifest.json is not valid JSON'},{status:400}) }

  const id = String(manifest.deviceId || manifest.deviceName || '').toLowerCase().replace(/[^a-z0-9-_.]/g,'-') || 'custom-device'
  const name = String(manifest.deviceName || id)
  const streams = Array.isArray(manifest.streams)? manifest.streams.filter(Boolean):[]

  await fs.mkdir(uploadsDir, {recursive:true})
  const archiveName = `${id}.zip`
  await fs.writeFile(path.join(uploadsDir, archiveName), buf)

  const list:any[] = await readJsonSafe(devicesPath)
  const existing = list.find((d:any)=>d.id===id)
  const entry = { id, name, active:false, mode:'mock', streams, config:{samplingRateHz: manifest.samplingRateHz||1} }
  if(existing) Object.assign(existing, entry); else list.push(entry)
  await fs.writeFile(devicesPath, JSON.stringify(list,null,2), 'utf-8')

  return NextResponse.json({ok:true, device:entry, manifest})
}
