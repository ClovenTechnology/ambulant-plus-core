// apps/api-gateway/src/devices/serviceMap.ts
import type { DeviceServiceMap } from './types';

export const SERVICE_MAPS: Record<string, DeviceServiceMap> = {
  // ---- HC-21 Stethoscope (Nordic UART Service) ----
  'duecare.stethoscope': {
    transport: 'ble',
    ble: {
      filters: [
        { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },
        { services: ['0000180f-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000180a-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'HC-21' }, { namePrefix: 'HC21' },
      ],
      services: {
        nus: {
          uuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
          chars: {
            nus_tx: { uuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e', write: true, description: 'Command TX' },
            nus_rx: { uuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', notify: true, cadenceHz: 8000, description: 'PCM16 RX' },
            ctrl_0004: { uuid: '00000004-0000-1000-8000-00805f9b34fb', read: true, write: true, description: 'OEM control 0004' },
            ctrl_0005: { uuid: '00000005-0000-1000-8000-00805f9b34fb', read: true, write: true, description: 'OEM control 0005' },
          },
        },
        battery: {
          uuid: '0000180f-0000-1000-8000-00805f9b34fb',
          chars: { battery_level: { uuid: '00002a19-0000-1000-8000-00805f9b34fb', read: true } },
        },
        device_info: {
          uuid: '0000180a-0000-1000-8000-00805f9b34fb',
          chars: {
            fw_rev: { uuid: '00002a26-0000-1000-8000-00805f9b34fb', read: true },
            hw_rev: { uuid: '00002a27-0000-1000-8000-00805f9b34fb', read: true },
            sw_rev: { uuid: '00002a28-0000-1000-8000-00805f9b34fb', read: true },
            pnp_id: { uuid: '00002ac9-0000-1000-8000-00805f9b34fb', read: true, write: true },
            reg_id: { uuid: '00002aca-0000-1000-8000-00805f9b34fb', read: true, write: true },
          },
        },
      },
    },
  },

  // ---- Health Monitor (keep SIG services; vendor block can be added once confirmed) ----
  'duecare.health-monitor': {
    transport: 'ble',
    ble: {
      filters: [
        { services: ['0000180d-0000-1000-8000-00805f9b34fb'] },
        { services: ['00001810-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000180f-0000-1000-8000-00805f9b34fb'] },
      ],
      services: {
        heart_rate: {
          uuid: '0000180d-0000-1000-8000-00805f9b34fb',
          chars: { hr_measurement: { uuid: '00002a37-0000-1000-8000-00805f9b34fb', notify: true, cadenceHz: 1 } },
        },
        blood_pressure: {
          uuid: '00001810-0000-1000-8000-00805f9b34fb',
          chars: { bp_measurement: { uuid: '00002a35-0000-1000-8000-00805f9b34fb', notify: true, cadenceHz: 1 } },
        },
        battery: {
          uuid: '0000180f-0000-1000-8000-00805f9b34fb',
          chars: { battery_level: { uuid: '00002a19-0000-1000-8000-00805f9b34fb', read: true } },
        },
      },
    },
  },

  // ---- NexRing (unchanged) ----
  'duecare.nexring': {
    transport: 'ble',
    ble: {
      filters: [
        { services: ['0000180d-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000180a-0000-1000-8000-00805f9b34fb'] },
        { services: ['0000fee0-0000-1000-8000-00805f9b34fb'] },
        { namePrefix: 'NexRing' },
      ],
      services: {
        vendor_fee0: {
          uuid: '0000fee0-0000-1000-8000-00805f9b34fb',
          chars: {
            hr:       { uuid: '0000fee1-0000-1000-8000-00805f9b34fb', notify: true, cadenceHz: 1 },
            ppg_wave: { uuid: '0000fee2-0000-1000-8000-00805f9b34fb', notify: true, cadenceHz: 50 },
            mindfulness: { uuid: '0000fee5-0000-1000-8000-00805f9b34fb', write: true },
          },
        },
      },
    },
  },
};
