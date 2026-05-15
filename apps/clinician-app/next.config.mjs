// apps/clinician-app/next.config.mjs
import { withFxProxy } from '../../next.fx-proxy.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ['@ambulant/ui-shell', '@ambulant/rtc'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value:
              process.env.NEXT_PUBLIC_WEB_ORIGIN ??
              'http://localhost:3001',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'content-type,x-uid',
          },
        ],
      },
    ];
  },
};

export default withFxProxy(nextConfig);