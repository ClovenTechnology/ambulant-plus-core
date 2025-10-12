// Single import surface for device inventory.
// Add new devices by exporting them here; managers discover via these arrays.

import type { WearableDevice, IoMTDevice } from './types';

// ==== Wearables (Apple) ====
import AppleSeries9 from './wearable/apple/smart-watch/series-9';
import AppleSeries10 from './wearable/apple/smart-watch/series-10';
import AppleSeries11 from './wearable/apple/smart-watch/series-11';
import AppleUltra from './wearable/apple/smart-watch/ultra';
import AppleUltra2 from './wearable/apple/smart-watch/ultra-2';
import AppleUltra3 from './wearable/apple/smart-watch/ultra-3';
import AppleSE3 from './wearable/apple/smart-watch/se-3';

// Samsung
import GalaxyWatch8 from './wearable/samsung/smart-watch/galaxy-watch-8';
import GalaxyWatch8Classic from './wearable/samsung/smart-watch/galaxy-watch-8-classic';
import GalaxyFit3 from './wearable/samsung/band/galaxy-fit-3';

// Google
import PixelWatch3 from './wearable/google/smart-watch/pixel-watch-3';
import PixelWatch4 from './wearable/google/smart-watch/pixel-watch-4';

// Fitbit
import FitbitCharge6 from './wearable/fitbit/band/charge-6';
import FitbitLuxe from './wearable/fitbit/band/luxe';
import FitbitInspire3 from './wearable/fitbit/band/inspire-3';

// Garmin (subset you listed; add others as needed the same way)
import GarminVenuSq2 from './wearable/garmin/smart-watch/venu-sq-2';
import GarminVenu3 from './wearable/garmin/smart-watch/venu-3';
import GarminVenu3s from './wearable/garmin/smart-watch/venu-3s';
import GarminForerunner55 from './wearable/garmin/smart-watch/forerunner-55';
import GarminForerunner255 from './wearable/garmin/smart-watch/forerunner-255';
import GarminForerunner265 from './wearable/garmin/smart-watch/forerunner-265';
import GarminFenix6 from './wearable/garmin/smart-watch/fenix-6';
import GarminFenix7 from './wearable/garmin/smart-watch/fenix-7';
import GarminFenix7x from './wearable/garmin/smart-watch/fenix-7x';
import GarminFenix7Pro from './wearable/garmin/smart-watch/fenix-7-pro';
import GarminFenix8 from './wearable/garmin/smart-watch/fenix-8';
import GarminFenixE from './wearable/garmin/smart-watch/fenix-e';
import GarminFenix8Pro from './wearable/garmin/smart-watch/fenix-8-pro';
import GarminInstinct2 from './wearable/garmin/smart-watch/instinct-2';
import GarminInstinct2s from './wearable/garmin/smart-watch/instinct-2s';

// Oura
import OuraGen3 from './wearable/oura/smart-ring/gen-3';
import OuraGen4 from './wearable/oura/smart-ring/gen-4';
import OuraGen5 from './wearable/oura/smart-ring/gen-5';

// DueCare wearables
import DueCareSleepEarbuds from './wearable/duecare/earbuds/sleep-earbuds';
import DueCareSmartPillow from './wearable/duecare/pillow/smart-pillow';
import DueCareNexBand from './wearable/duecare/band/nexband';
import DueCareNexRing from './wearable/duecare/smart-ring/nexring';
import DueCareNexRingEcg from './wearable/duecare/smart-ring/nexring-ecg';

// ==== IoMT (DueCare) ====
import DueCareHealthMonitor from './iomt/duecare/health-monitor';
import DueCareStethoscope from './iomt/duecare/stethoscope';
import DueCareOtoscope from './iomt/duecare/otoscope';
import DueCareSmartScale from './iomt/duecare/smart-scale';
import DueCareCGM from './iomt/duecare/cgm';

export const wearableInventory: WearableDevice[] = [
  new AppleSeries9(), new AppleSeries10(), new AppleSeries11(), new AppleUltra(), new AppleUltra2(), new AppleUltra3(), new AppleSE3(),
  new GalaxyWatch8(), new GalaxyWatch8Classic(), new GalaxyFit3(),
  new PixelWatch3(), new PixelWatch4(),
  new FitbitCharge6(), new FitbitLuxe(), new FitbitInspire3(),
  new GarminVenuSq2(), new GarminVenu3(), new GarminVenu3s(), new GarminForerunner55(), new GarminForerunner255(), new GarminForerunner265(), new GarminFenix6(), new GarminFenix7(), new GarminFenix7x(), new GarminFenix7Pro(), new GarminFenix8(), new GarminFenixE(), new GarminFenix8Pro(), new GarminInstinct2(), new GarminInstinct2s(),
  new OuraGen3(), new OuraGen4(), new OuraGen5(),
  new DueCareSleepEarbuds(), new DueCareSmartPillow(), new DueCareNexBand(), new DueCareNexRing(), new DueCareNexRingEcg(),
];

export const iomtInventory: IoMTDevice[] = [
  new DueCareHealthMonitor(), new DueCareStethoscope(), new DueCareOtoscope(), new DueCareSmartScale(), new DueCareCGM(),
];
