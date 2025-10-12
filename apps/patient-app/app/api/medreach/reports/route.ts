import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const filePath = path.join(process.cwd(), '../../packages/medreach/reports.json')
async function readJsonSafe(p:string){ const txt = await fs.readFile(p, 'utf-8'); return JSON.parse(txt.replace(/^\uFEFF/, '')) }
export async function GET(){ const data = await readJsonSafe(filePath); return NextResponse.json(data) }
