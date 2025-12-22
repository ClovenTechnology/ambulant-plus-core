import { withFxProxy } from '../../next.fx-proxy.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14 uses app router by default – no need for experimental.appDir
  env: {
    NEXT_PUBLIC_PATIENT_APP_BASE_URL:
      process.env.NEXT_PUBLIC_PATIENT_APP_BASE_URL ||
      'http://localhost:3000',
    NEXT_PUBLIC_CLINICIAN_BASE_URL:
      process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
      'http://localhost:3001',
    NEXT_PUBLIC_API_GATEWAY_BASE_URL:
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      'http://localhost:3010',
  },
};

export default withFxProxy(nextConfig);
