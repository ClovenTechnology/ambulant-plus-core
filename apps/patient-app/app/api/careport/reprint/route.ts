import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const store = path.join(process.cwd(), '../../packages/careport/erx.json')
async function readSafe(){ try{ const txt = await fs.readFile(store,'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/, '')) }catch{ return { outbox:[], reprints:[] } } }
export async function POST(req: NextRequest){
  const { id } = await req.json()
  if(!id) return NextResponse.json({error:'id required'},{status:400})
  const data = await readSafe()
  const exists = (data.outbox||[]).find((x:any)=>x.id===id)
  if(!exists) return NextResponse.json({error:'erx not found'},{status:404})
  data.reprints = data.reprints || []
  data.reprints.push({ id, requestedAt: new Date().toISOString() })
  await fs.writeFile(store, JSON.stringify(data,null,2), 'utf-8')
  return NextResponse.json({ ok:true })
}
