import { withFxProxy } from '../../next.fx-proxy.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  transpilePackages: ['@ambulant/ui-shell'],
};

export default withFxProxy(nextConfig);
