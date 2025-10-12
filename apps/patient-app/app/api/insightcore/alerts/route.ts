import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const filePath = path.join(process.cwd(), '../../packages/insightcore/alerts.json')
export async function GET(){
  try{
    const txt = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(txt.replace(/^\uFEFF/, ''))
    return NextResponse.json({ alerts: data.alerts?.slice(-5) ?? [] })
  }catch{
    return NextResponse.json({ alerts: [] })
  }
}
