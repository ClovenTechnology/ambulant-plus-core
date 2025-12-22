import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ambulant.patient',
  appName: 'Ambulant Patient',
  webDir: 'public-mobile',           // <- points to our tiny folder
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

export default config;
