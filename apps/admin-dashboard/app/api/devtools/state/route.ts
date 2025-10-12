import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const file = path.join(process.cwd(), '../../packages/mock/state.json')

export async function GET(){
  try{
    const txt = await fs.readFile(file,'utf-8')
    return NextResponse.json(JSON.parse(txt.replace(/^\uFEFF/,'')))
  }catch{
    return NextResponse.json({mode:'demo'})
  }
}

export async function POST(req: NextRequest){
  const mode = (new URL(req.url).searchParams.get('mode')||'demo') as 'demo'|'empty'
  await fs.mkdir(path.dirname(file), {recursive:true})
  await fs.writeFile(file, JSON.stringify({mode},null,2), 'utf-8')
  return NextResponse.json({mode})
}
