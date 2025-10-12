// Updated device types. Otoscope supports photo + video capture.


export type DeviceCategory =
| 'wearable'
| 'iomt'
| 'stethoscope'
| 'otoscope'
| 'scale'
| 'cgm';


export type Transport = 'ble' | 'usb' | 'camera' | 'cloud';


export type ServiceUUID = string; // 128-bit or 16-bit (e.g., 0x180D)
export type CharUUID = string;


export type BleChar = {
uuid: CharUUID;
notify?: boolean;
write?: boolean;
read?: boolean;
cadenceHz?: number; // expected notification cadence if notify=true
description?: string;
};


export type BleService = {
uuid: ServiceUUID;
chars: Record<string, BleChar>; // key = symbolic name, e.g. "ecg_wave", "hr_measurement"
};


export type UsbInterface = {
vendorId: number;
productId: number;
description?: string;
};


export type DeviceServiceMap = {
transport: Transport;
ble?: {
filters: { services?: ServiceUUID[]; namePrefix?: string }[];
services: Record<string, BleService>; // symbolic service names
};
usb?: UsbInterface[]; // otoscope etc.
camera?: { uvcLabelHint?: string };
};