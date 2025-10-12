import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const filePath = path.join(process.cwd(), '../../packages/admin/payouts.json')
async function readJsonSafe(p:string){ const txt = await fs.readFile(p, 'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/, '')) }
function validate(body:any){
  const out:any = { ...body }
  if(!Array.isArray(out.clinicianClasses)) out.clinicianClasses = []
  out.clinicianClasses = out.clinicianClasses.map((c:any)=>({
    id: String(c.id || crypto.randomUUID()),
    name: String(c.name || 'Class'),
    enabled: Boolean(c.enabled),
    rxPayoutPercent: Math.max(0, Math.min(100, Number(c.rxPayoutPercent ?? 0))),
  }))
  out.clinicianErxCommissionPercent = Math.max(0, Math.min(100, Number(out.clinicianErxCommissionPercent ?? 0)))
  return out
}
export async function GET(){ const data = await readJsonSafe(filePath); return NextResponse.json(data) }
export async function PUT(req: NextRequest){ const body = await req.json(); const clean = validate(body); await fs.writeFile(filePath, JSON.stringify(clean, null, 2), 'utf-8'); return NextResponse.json({ ok: true }) }
