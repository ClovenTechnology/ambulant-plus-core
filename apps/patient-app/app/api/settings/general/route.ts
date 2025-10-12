import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const filePath = path.join(process.cwd(), '../../packages/admin/settings.json')
export async function GET(){
  try{
    const txt = await fs.readFile(filePath, 'utf-8')
    const js = JSON.parse(txt.replace(/^\uFEFF/, ''))
    return NextResponse.json(js)
  }catch{
    return NextResponse.json({ reportExpiryDays: 60 })
  }
}
