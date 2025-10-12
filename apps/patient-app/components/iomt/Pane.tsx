// apps/patient-app/components/iomt/Pane.tsx
'use client';
import { useState } from 'react';
import WearablePane from '@/components/iomt/WearablePane';
import HMPane from '@/components/iomt/HMPane';
import StethoPane from '@/components/iomt/StethoPane';
import OtoPane from '@/components/iomt/OtoPane';

type Tab = 'wearable'|'hm'|'stetho'|'oto';

export default function IoMTPane() {
  const [tab, setTab] = useState<Tab>('wearable');
  const TabBtn = ({id, children}:{id:Tab;children:any}) => (
    <button onClick={()=>setTab(id)}
      className={`px-3 py-2 rounded-xl text-sm border ${tab===id?'bg-zinc-900 text-white':'bg-white'}`}>{children}</button>
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabBtn id="wearable">Wearable</TabBtn>
        <TabBtn id="hm">Health Monitor</TabBtn>
        <TabBtn id="stetho">Stethoscope</TabBtn>
        <TabBtn id="oto">Otoscope</TabBtn>
      </div>
      {tab==='wearable' && <WearablePane/>}
      {tab==='hm' && <HMPane/>}
      {tab==='stetho' && <StethoPane/>}
      {tab==='oto' && <OtoPane/>}
    </div>
  );
}
