'use client';

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NativeHealthMonitorPlugin = {
  askPermissions(): Promise<void>;
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(options: { mac: string }): Promise<void>;
  disconnect(): Promise<void>;
  setMeasurePosition(options: { wrist: boolean }): Promise<void>;
  startMeasurements(options?: { type?: string }): Promise<void>;
  startMeasurement?: (options?: { type?: string }) => Promise<void>;
  stopMeasurements(): Promise<void>;
  addListener(
    eventName: string,
    listenerFunc: (event: unknown) => void,
  ): Promise<PluginListenerHandle>;
};

const globalKey = '__AMBULANT_NATIVE_HEALTH_MONITOR_PLUGIN__';

type RegistryGlobal = typeof globalThis & {
  [globalKey]?: NativeHealthMonitorPlugin;
};

const registry = globalThis as RegistryGlobal;

export const NativeHealthMonitor: NativeHealthMonitorPlugin =
  registry[globalKey] ??
  (registry[globalKey] = registerPlugin<NativeHealthMonitorPlugin>('HealthMonitor'));
