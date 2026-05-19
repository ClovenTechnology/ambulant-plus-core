// apps/patient-app/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ambulant.patient',
  appName: 'Ambulant Patient',
  webDir: 'public-mobile',
  server: {
    androidScheme: 'https',
  },
};

export default config;