import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';
function gatewayBase(){ return String(process.env.APIGW_BASE || process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_APIGW_BASE || CANONICAL_API_GATEWAY).trim().replace(/\/+$/,''); }
function clean(v:unknown,max=500){ return String(v??'').trim().slice(0,max); }
async function relay(upstream:Response){ const ct=upstream.headers.get('content-type')||''; if(ct.includes('application/json')) return NextResponse.json(await upstream.json().catch(()=>null),{status:upstream.status,headers:{'cache-control':'no-store'}}); return new NextResponse(await upstream.text().catch(()=>''),{status:upstream.status,headers:{'cache-control':'no-store'}}); }
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
  const auth=await requireClinicianAuth(req,{allowAdmin:true,allowAdminStaff:true}); if(!auth.ok) return authErrorResponse(auth);
  const encounterId=clean(params.id,120); if(!encounterId) return NextResponse.json({ok:false,error:'encounter_id_required'},{status:400});
  let identity:string; try{ identity=createTrustedClinicianIdentityHeader(req); }catch(error:any){ return NextResponse.json({ok:false,error:clean(error?.message)||'identity_bridge_failed'},{status:Number(error?.status||500)}); }
  const body=await req.json().catch(()=>null); if(!body || typeof body!=='object') return NextResponse.json({ok:false,error:'invalid_json_body'},{status:400});
  try{
    const upstream=await fetch(`${gatewayBase()}/api/encounters/${encodeURIComponent(encounterId)}/end`,{method:'POST',headers:{accept:'application/json','content-type':'application/json','x-ambulant-identity':identity},body:JSON.stringify({...body,encounterId}),cache:'no-store'});
    return relay(upstream);
  }catch(error:any){ return NextResponse.json({ok:false,error:'api_gateway_unreachable',message:clean(error?.message,1000)},{status:502}); }
}
