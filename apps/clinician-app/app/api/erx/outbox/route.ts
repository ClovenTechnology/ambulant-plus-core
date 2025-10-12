import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const store = path.join(process.cwd(), '../../packages/careport/erx.json')
async function readSafe(){ try{ const txt = await fs.readFile(store,'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/, '')) }catch{ return { outbox:[], reprints:[] } } }
export async function GET(){ const data = await readSafe(); return NextResponse.json({ outbox: data.outbox }) }
