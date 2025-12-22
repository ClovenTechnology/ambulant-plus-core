import { withFxProxy } from '../../next.fx-proxy.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
    tsconfigPaths: true,
  },
  transpilePackages: ['@ambulant/ui-shell'],
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          // TODO: set this to your clinician-app origin in dev/prod
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
