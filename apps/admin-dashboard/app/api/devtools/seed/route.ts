import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const devicesPath = path.join(process.cwd(), '../../packages/iot-sdk/devices.json');

export async function POST(){
  const data = [
  {
    "id": "nexring",
    "vendor": "NexRing",
    "name": "NexRing",
    "group": "smartring",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "hrv",
      "sleep",
      "temperature"
    ]
  },
  {
    "id": "health-monitor",
    "vendor": "Ambulant+",
    "name": "6-in-1 Health Monitor",
    "group": "multisensor",
    "active": true,
    "mode": "mock",
    "streams": [
      "bpSystolic",
      "bpDiastolic",
      "spo2",
      "ecg",
      "temperature",
      "respiratoryRate"
    ]
  },
  {
    "id": "digital-stethoscope",
    "vendor": "Ambulant+",
    "name": "Digital Stethoscope",
    "group": "stethoscope",
    "active": true,
    "mode": "mock",
    "streams": [
      "phonocardiogram",
      "waveform"
    ]
  },
  {
    "id": "digital-otoscope",
    "vendor": "Ambulant+",
    "name": "Digital Otoscope",
    "group": "otoscope",
    "active": true,
    "mode": "mock",
    "streams": [
      "image",
      "video"
    ]
  },
  {
    "id": "apple-watch",
    "vendor": "Apple",
    "name": "Apple Watch (HealthKit)",
    "group": "smartwatch",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "hrv",
      "steps",
      "sleep",
      "spo2"
    ]
  },
  {
    "id": "garmin-watch",
    "vendor": "Garmin",
    "name": "Garmin Watch (Health SDK/API)",
    "group": "smartwatch",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "hrv",
      "steps",
      "sleep",
      "stress",
      "spo2"
    ]
  },
  {
    "id": "fitbit-watch",
    "vendor": "Google Fitbit",
    "name": "Fitbit Watch (Web API)",
    "group": "smartwatch",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "steps",
      "sleep",
      "spo2"
    ]
  },
  {
    "id": "samsung-galaxy-watch",
    "vendor": "Samsung",
    "name": "Galaxy Watch (Samsung Health)",
    "group": "smartwatch",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "steps",
      "sleep",
      "spo2"
    ]
  },
  {
    "id": "polar-watch",
    "vendor": "Polar",
    "name": "Polar Watch (AccessLink)",
    "group": "smartwatch",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "steps",
      "sleep",
      "spo2"
    ]
  },
  {
    "id": "oura-ring",
    "vendor": "Oura",
    "name": "Oura Ring (Cloud API)",
    "group": "smartring",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "hrv",
      "sleep",
      "temperature",
      "readiness"
    ]
  },
  {
    "id": "ultrahuman-ring",
    "vendor": "Ultrahuman",
    "name": "Ultrahuman Ring Air (UltraSignal)",
    "group": "smartring",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "hrv",
      "sleep",
      "temperature",
      "ppg"
    ]
  },
  {
    "id": "ringconn-ring",
    "vendor": "RingConn",
    "name": "RingConn Ring",
    "group": "smartring",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "sleep",
      "temperature"
    ]
  },
  {
    "id": "circular-ring",
    "vendor": "Circular",
    "name": "Circular Ring (API/SDK)",
    "group": "smartring",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "hrv",
      "sleep",
      "temperature"
    ]
  },
  {
    "id": "galaxy-ring",
    "vendor": "Samsung",
    "name": "Galaxy Ring (Samsung Health)",
    "group": "smartring",
    "active": true,
    "mode": "mock",
    "streams": [
      "heartRate",
      "sleep",
      "temperature"
    ]
  }
];
  await fs.mkdir(path.dirname(devicesPath), { recursive: true });
  await fs.writeFile(devicesPath, JSON.stringify(data, null, 2), 'utf-8');
  return NextResponse.json({ ok:true, count: data.length });
}
