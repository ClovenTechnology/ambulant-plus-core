import { iomtInventory } from '../registry';
import type { IoMTDevice, IoMTManager, IoMTInfo } from '../types';

export const IoMT: IoMTManager = {
  list(): IoMTInfo[] { return iomtInventory.map(d => d.info); },
  get(id: string): IoMTDevice | undefined { return iomtInventory.find(d => d.info.id === id); }
};
