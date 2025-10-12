import { wearableInventory } from '../registry';
import type { WearableDevice, WearableManager, WearableInfo } from '../types';


export const Wearables: WearableManager = {
list(): WearableInfo[] { return wearableInventory.map(w => w.info); },
get(id: string): WearableDevice | undefined { return wearableInventory.find(w => w.info.id === id); }
};