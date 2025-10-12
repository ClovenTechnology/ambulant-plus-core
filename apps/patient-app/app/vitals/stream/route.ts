import { NextResponse } from 'next/server'

function rand(n:number){ return Math.round(n) }
export async function GET(){
  const stream = new ReadableStream({
    start(controller){
      const encoder = new TextEncoder()
      const timer = setInterval(()=>{
        const payload = {
          heartRate: rand(60 + Math.random()*30),
          spo2: rand(95 + Math.random()*4),
          temperature: (36.4 + Math.random()*0.6).toFixed(1),
          hrv: rand(40 + Math.random()*20),
          t: Date.now()
        }
        const data = `data: ${JSON.stringify(payload)}\n\n`
        controller.enqueue(encoder.encode(data))
      }, 1000)
      const close = () => clearInterval(timer as any)
      // @ts-ignore
      controller._onClose = close
    },
    cancel(){
      // @ts-ignore
      if(this._onClose) this._onClose()
    }
  })
  return new NextResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
}
