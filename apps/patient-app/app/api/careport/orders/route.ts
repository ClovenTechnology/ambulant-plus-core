import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const ordersPath = path.join(process.cwd(), '../../packages/careport/orders.json')

async function readJsonSafe(file:string){
  const txt = await fs.readFile(file, 'utf-8')
  const clean = txt.replace(/^\uFEFF/, '')
  return JSON.parse(clean)
}

export async function GET(){
  try {
    const data = await readJsonSafe(ordersPath)
    return NextResponse.json(data)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'read error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest){
  try {
    const { id, status } = await req.json()
    const data = await readJsonSafe(ordersPath)
    const o = data.orders.find((x:any)=>x.id===id)
    if(o){ o.status = status }
    await fs.writeFile(ordersPath, JSON.stringify(data, null, 2), 'utf-8')
    return NextResponse.json(data)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'write error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest){
  try {
    const body = await req.json()
    const data = await readJsonSafe(ordersPath)
    if(body.action === 'reprint'){
      const orig = data.orders.find((x:any)=>x.id===body.id)
      if(!orig) return NextResponse.json({error:'not found'}, {status:404})
      orig.status = 'Unfulfilled â€” Reprint sent to patient'
      const supId = 'SUP-' + body.id
      data.orders.push({ id: supId, parentId: body.id, patient: orig.patient, items: orig.items, status:'Awaiting Patient Reorder', pharmacy:'â€”', notes:'' })
    } else if(body.action === 'partial'){
      const o = data.orders.find((x:any)=>x.id===body.id)
      if(o){ o.status = 'Partially Fulfilled (First order only)' }
    }
    await fs.writeFile(ordersPath, JSON.stringify(data, null, 2), 'utf-8')
    return NextResponse.json(data)
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'write error' }, { status: 500 })
  }
}
