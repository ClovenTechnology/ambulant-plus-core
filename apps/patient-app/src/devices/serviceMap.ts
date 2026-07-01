// apps/patient-app/src/devices/serviceMap.ts

export type Modality = 'stethoscope' | 'otoscope' | 'monitor' | 'ring' | 'ring_ecg';
export type Transport = 'ble' | 'usb';

export type CharSpec = {
  uuid: string;
  mode?: 'notify' | 'write' | 'read';
  sampleHz?: number | 'spot';
  notes?: string;
};

export type DeviceSpec = {
  id: string;
  label: string;
  vendor: string;
  transport: Transport;
  category?: string;
  filters?: { namePrefix?: string[]; services?: string[] };
  characteristics?: Record<string, CharSpec>;
  commands?: Record<string, Uint8Array | number[]>;
  console: { panels: ('pcm' | 'video' | 'vitals' | 'ppg' | 'ecg')[] };
};

export const serviceMap: Record<string, DeviceSpec> = {
  'duecare.stethoscope': {
    id: 'duecare.stethoscope',
    label: 'Stethoscope',
    vendor: 'DueCare/Linktop',
    transport: 'ble',
    category: 'Stethoscope',
    filters: {
      namePrefix: ['HC-21', 'HC21'],
      services: [
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
      ],
    },
    characteristics: {
      pcm_stream: {
        uuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
        mode: 'notify',
        sampleHz: 8000,
        notes: 'PCM16LE raw frames (mono), sampleRate=8000',
      },
      ctrl: { uuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', mode: 'write' },
      vendor_0004: {
        uuid: '00000004-0000-1000-8000-00805f9b34fb',
        mode: 'write',
        notes: 'gain/mode (if used)',
      },
      vendor_0005: {
        uuid: '00000005-0000-1000-8000-00805f9b34fb',
        mode: 'read',
        notes: 'state (if used)',
      },
      battery: {
        uuid: '00002a19-0000-1000-8000-00805f9b34fb',
        mode: 'notify',
        notes: 'Battery %',
      },
      firmware_rev: { uuid: '00002a26-0000-1000-8000-00805f9b34fb', mode: 'read' },
      hardware_rev: { uuid: '00002a27-0000-1000-8000-00805f9b34fb', mode: 'read' },
      software_rev: { uuid: '00002a28-0000-1000-8000-00805f9b34fb', mode: 'read' },
    },
    commands: {
      start: new Uint8Array([0x01]),
      stop: new Uint8Array([0x02]),
    },
    console: { panels: ['pcm'] },
  },

  'duecare.health-monitor': {
    id: 'duecare.health-monitor',
    label: 'Health Monitor',
    vendor: 'DueCare/Linktop',
    transport: 'ble',
    category: 'Vitals Monitor',
    filters: {
      namePrefix: [
        'HC03',
        'HC-03',
        'HC02',
        'HC02-',
        'Health',
        'Monitor',
        'Linktop',
        'DueCare',
      ],
      services: [
        '0000ff27-0000-1000-8000-00805f9b34fb',
        '0000fff0-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb',
        '0000ffd0-0000-1000-8000-00805f9b34fb',
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
      ],
    },
    characteristics: {
      vendor_ctrl: {
        uuid: '0000fff1-0000-1000-8000-00805f9b34fb',
        mode: 'write',
        notes: 'Primary control/write channel',
      },
      vendor_notify: {
        uuid: '0000fff4-0000-1000-8000-00805f9b34fb',
        mode: 'notify',
        notes: 'Primary multiplexed notify/result channel',
      },
      therm_confirm: {
        uuid: '0000fff5-0000-1000-8000-00805f9b34fb',
        mode: 'notify',
        notes: 'Thermometer handshake/confirm if exposed',
      },
      temp: {
        uuid: '0000ffe1-0000-1000-8000-00805f9b34fb',
        mode: 'notify',
        sampleHz: 'spot',
        notes: 'Fallback body temperature spot result',
      },
      glucose: {
        uuid: '0000ffd1-0000-1000-8000-00805f9b34fb',
        mode: 'notify',
        sampleHz: 'spot',
        notes: 'Fallback glucose spot result',
      },
      batt: {
        uuid: '00002a19-0000-1000-8000-00805f9b34fb',
        mode: 'read',
        notes: 'Battery percentage if available',
      },
      firmware_rev: {
        uuid: '00002a26-0000-1000-8000-00805f9b34fb',
        mode: 'read',
      },
      hardware_rev: {
        uuid: '00002a27-0000-1000-8000-00805f9b34fb',
        mode: 'read',
      },
      software_rev: {
        uuid: '00002a28-0000-1000-8000-00805f9b34fb',
        mode: 'read',
      },
    },
    console: { panels: ['vitals', 'ecg', 'ppg'] },
  },

  'duecare.otoscope': {
    id: 'duecare.otoscope',
    label: 'HD Otoscope (NE20)',
    vendor: 'DueCare/Linktop',
    transport: 'usb',
    category: 'Otoscope',
    console: { panels: ['video'] },
  },

  'duecare.nexring': {
    id: 'duecare.nexring',
    label: 'NexRing',
    vendor: 'DueCare',
    transport: 'usb',
    category: 'Wearable Ring',
    filters: {
      services: [
        '0000180d-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
        '0000fee0-0000-1000-8000-00805f9b34fb',
      ],
    },
    characteristics: {
      hr: { uuid: '0000fee1-0000-1000-8000-00805f9b34fb', mode: 'notify', sampleHz: 1 },
      ppg_wave: { uuid: '0000fee2-0000-1000-8000-00805f9b34fb', mode: 'notify', sampleHz: 25 },
      mindfulness: { uuid: '0000fee5-0000-1000-8000-00805f9b34fb', mode: 'write' },
      activity: { uuid: '0000fee6-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Steps, Calories, Distance' },
      sleep: { uuid: '0000fee7-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Sleep stages, latency, efficiency, score' },
      spo2: { uuid: '0000fee8-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Blood oxygen %' },
      resp_rate: { uuid: '0000fee9-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Respiratory rate' },
      temp: { uuid: '0000feea-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Skin/body temperature' },
      stress: { uuid: '0000feeb-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Stress level' },
      hrv: { uuid: '0000feec-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'HRV metrics' },
      rhr: { uuid: '0000feed-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Resting heart rate' },
      workout: { uuid: '0000feee-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Workout sessions' },
      readiness: { uuid: '0000feef-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Daily readiness score' },
      hr_dip: { uuid: '0000fef0-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Heart rate dip' },
      avg_hr: { uuid: '0000fef1-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Average HR' },
      finger_temp_var: { uuid: '0000fef2-0000-1000-8000-00805f9b34fb', mode: 'notify', notes: 'Finger temp variation' },
    },
    console: { panels: ['ppg'] },
  },

  'duecare.nexring-ecg': {
    id: 'duecare.nexring-ecg',
    label: 'NexRing ECG',
    vendor: 'DueCare',
    transport: 'ble',
    category: 'Wearable Ring',
    filters: {
      services: ['0000fee0-0000-1000-8000-00805f9b34fb'],
    },
    characteristics: {
      ecg_wave: { uuid: '0000fee3-0000-1000-8000-00805f9b34fb', mode: 'notify', sampleHz: 250 },
    },
    console: { panels: ['ecg'] },
  },
};

export const DEVICE_MAP = serviceMap;
export type DeviceKey = keyof typeof serviceMap;