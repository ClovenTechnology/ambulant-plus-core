/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false, net: false, tls: false };
  return config;
},
};

module.exports = nextConfig;
