import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const base = path.join(process.cwd(), '../../packages')

const devices = [
  { id:'nexring', name:'NexRing', active:true, mode:'mock', streams:['heartRate','hrv','sleep','temperature'], config:{samplingRateHz:1} },
  { id:'health-monitor', name:'6-in-1 Health Monitor', active:true, mode:'mock', streams:['bpSystolic','bpDiastolic','spo2','ecg','temperature','respiratoryRate'], config:{samplingRateHz:1} },
  { id:'digital-stethoscope', name:'Digital Stethoscope', active:true, mode:'mock', streams:['phonocardiogram','waveform'], config:{samplingRateHz:1} },
  { id:'digital-otoscope', name:'Digital Otoscope', active:true, mode:'mock', streams:['image','video'], config:{samplingRateHz:1} }
]

export async function POST(){
  await fs.mkdir(path.join(base,'iot-sdk'),{recursive:true})
  await fs.writeFile(path.join(base,'iot-sdk/devices.json'), JSON.stringify(devices,null,2), 'utf-8')
  return NextResponse.json({message:'Reset complete (all 4 devices active)'})
}
