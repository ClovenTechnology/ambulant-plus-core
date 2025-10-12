import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const uploadsDir = path.join(process.cwd(), '../../packages/medreach/uploads')

export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const filePath = path.join(uploadsDir, name)
  try{
    const data = await fs.readFile(filePath)
    const ext = (name.split('.').pop()||'').toLowerCase()
    const type = ext==='pdf' ? 'application/pdf' : (/(png|jpg|jpeg|webp|gif)$/i.test(ext)? `image/${ext}` : 'application/octet-stream')
    return new NextResponse(data, { headers: { 'Content-Type': type } })
  }catch{
    return NextResponse.json({error:'not found'},{status:404})
  }
}
