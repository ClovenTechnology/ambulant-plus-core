// apps/patient-app/capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const androidServerUrl = process.env.CAPACITOR_ANDROID_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.ambulant.patient',
  appName: 'Ambulant Patient',
  webDir: 'public-mobile',
  server: androidServerUrl
    ? {
        url: androidServerUrl,
        androidScheme: 'https',
        cleartext: false,
      }
    : {
        androidScheme: 'https',
      },
};

export default config;
