// apps/api-gateway/src/devices/types.ts

export type DeviceCategory =
  | 'health-monitor'
  | 'stethoscope'
  | 'otoscope'
  | 'ring'
  | 'vitals'
  | 'audio'
  | 'imaging'
  | 'wearable'
  | 'iomt';

export type Transport =
  | 'ble'
  | 'usb'
  | 'camera'
  | 'cloud'
  | 'mqtt'
  | 'manual';

export type ServiceUUID = string;
export type CharUUID = string;

export type BleChar = {
  uuid: CharUUID;
  notify?: boolean;
  write?: boolean;
  read?: boolean;
  cadenceHz?: number;
  description?: string;
};

export type BleService = {
  uuid: ServiceUUID;
  chars: Record<string, BleChar>;
};

export type UsbInterface = {
  vendorId: number;
  productId: number;
  description?: string;
};

export type DeviceServiceMap = {
  transport: Transport;
  ble?: {
    filters: Array<{
      services?: ServiceUUID[];
      namePrefix?: string;
    }>;
    services: Record<string, BleService>;
  };
  usb?: UsbInterface[];
  camera?: {
    uvcLabelHint?: string;
  };
};

export type MetricSample = {
  metric: string;
  value: number | string | boolean | null;
  unit?: string | null;
  timestamp?: string | Date;
  deviceId?: string;
  patientId?: string;
  payload?: any;
  raw?: any;
  [key: string]: any;
};

export type IoMTInfo = {
  id: string;
  vendor: string;
  displayName: string;
  category: DeviceCategory | string;
  family?: string;
  model?: string;
  transport?: Transport;
  version?: string;
  description?: string;
  capabilities?: string[];
  serviceMap?: DeviceServiceMap;
  [key: string]: any;
};

export type IoMTData = MetricSample & {
  type?: string;
};

export type IoMTDevice = {
  info: IoMTInfo;

  connect?: () => Promise<void> | void;
  disconnect?: () => Promise<void> | void;
  start?: () => Promise<void> | void;
  stop?: () => Promise<void> | void;

  onData?: (cb: (event: IoMTData) => void) => void;
  offData?: () => void;

  read?: () =>
    | Promise<IoMTData | IoMTData[] | null>
    | IoMTData
    | IoMTData[]
    | null;
};

export type IoMTManager = {
  list: () => IoMTInfo[];
  get?: (id: string) => IoMTDevice | undefined;
  find?: (id: string) => IoMTDevice | undefined;
  connect?: (id: string) => Promise<IoMTDevice | null> | IoMTDevice | null;
  disconnect?: (id: string) => Promise<void> | void;
  onData?: (id: string, cb: (event: IoMTData) => void) => void;
};

export type WearableInfo = IoMTInfo;
export type WearableData = IoMTData;
export type WearableDevice = IoMTDevice;

export type WearableManager = {
  list: () => WearableInfo[];
  get?: (id: string) => WearableDevice | undefined;
  find?: (id: string) => WearableDevice | undefined;
  connect?: (id: string) => Promise<WearableDevice | null> | WearableDevice | null;
  disconnect?: (id: string) => Promise<void> | void;
  onData?: (id: string, cb: (event: WearableData) => void) => void;
};

export type DeviceReading = IoMTData;

export type DeviceMapperInput = {
  deviceId?: string;
  patientId?: string;
  payload?: any;
  [key: string]: any;
};

export type DeviceMapperOutput = IoMTData | IoMTData[] | null;