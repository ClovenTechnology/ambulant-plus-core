/** @type {import('next').NextConfig} */

// Use phase to avoid "output: export" during `next dev` (which breaks dynamic API routes)
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants');

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  const isProdBuild = phase === PHASE_PRODUCTION_BUILD;

  const nextConfig = {
    // Only export in production build (Capacitor uses /out). In dev we keep a Node server.
    output: isDev ? undefined : 'export',

    // Make <Image> work when exporting
    images: { unoptimized: true },

    reactStrictMode: true,

    webpack: (config, { isServer }) => {
      // keep your aliases
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        bufferutil: false,
        'utf-8-validate': false,
      };

      if (isServer) {
        const externals = Array.isArray(config.externals) ? config.externals : [];
        config.externals = [...externals, 'bufferutil', 'utf-8-validate'];
      }

      // keep your fallbacks
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
      };

      return config;
    },
  };

  return nextConfig;
};
