import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

const alertsPath = path.join(process.cwd(), '../../packages/insightcore/alerts.json')

async function readJsonSafe(file:string){
  const txt = await fs.readFile(file, 'utf-8').then(t=>t.replace(/^\uFEFF/, ''))
  return JSON.parse(txt)
}

export async function GET(){
  const data = await readJsonSafe(alertsPath).catch(()=>({alerts:[]}))
  return NextResponse.json(data)
}

export async function POST(req: NextRequest){
  const body = await req.json()
  const data = await readJsonSafe(alertsPath).catch(()=>({alerts:[]}))
  data.alerts.push({
    id: crypto.randomUUID(),
    patient: body.patient || '',
    type: body.type || 'Alert',
    score: Number(body.score || 0),
    ts: new Date().toISOString(),
    note: body.note || ''
  })
  await fs.writeFile(alertsPath, JSON.stringify(data, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
