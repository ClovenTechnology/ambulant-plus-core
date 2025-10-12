// Mock streaming adapter for IoMT devices
export type DataPoint = Record<string, number>;
export type OnData = (dp: DataPoint) => void;
const rand = (min:number, max:number)=> Math.round((Math.random()*(max-min)+min)*10)/10;
const streamProfiles: Record<string, ()=>DataPoint> = {
  "heartRate": () => ({ heartRate: Math.round(rand(58, 98)) }),
  "hrv": () => ({ hrv: Math.round(rand(25, 90)) }),
  "sleep": () => ({ sleep: rand(0, 1) ? 1 : 0 }),
  "temperature": () => ({ temperature: rand(36.1, 37.2) }),
  "bp": () => ({ bpSystolic: Math.round(rand(110, 135)), bpDiastolic: Math.round(rand(70, 88)) }),
  "spo2": () => ({ spo2: Math.round(rand(95, 99)) }),
  "respiratoryRate": () => ({ respiratoryRate: Math.round(rand(12, 20)) }),
  "steps": () => ({ steps: Math.round(rand(0, 50)) }),
  "stress": () => ({ stress: Math.round(rand(10, 70)) }),
  "readiness": () => ({ readiness: Math.round(rand(60, 95)) }),
  "ppg": () => ({ ppg: Math.round(rand(100, 900)) })
};
export function start(deviceId: string, streams: string[], onData: OnData){
  const interval = setInterval(()=>{
    const merged: DataPoint = {};
    for(const s of streams){
      const key = s.toLowerCase().includes("bp") ? "bp" : s;
      const gen = streamProfiles[key];
      if(gen) Object.assign(merged, gen());
    }
    onData(merged);
  }, 1000);
  return () => clearInterval(interval);
}
