// apps/patient-app/next.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFxProxy } from '../../next.fx-proxy.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    externalDir: true,
    outputFileTracingRoot: workspaceRoot,
  },

  transpilePackages: ['@ambulant/ui-shell'],

  images: {
    unoptimized: true,
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      bufferutil: false,
      'utf-8-validate': false,
    };

    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...externals, 'bufferutil', 'utf-8-validate'];
    }

    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };

    return config;
  },
};

export default withFxProxy(nextConfig);