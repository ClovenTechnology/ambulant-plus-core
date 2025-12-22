// next.fx-proxy.mjs
function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const t = trimSlash(v);
    if (t) return t;
  }
  return '';
}

async function resolveUserRewrites(nextConfig) {
  const rw = nextConfig?.rewrites;
  if (!rw) return { beforeFiles: [], afterFiles: [], fallback: [] };

  const resolved = typeof rw === 'function' ? await rw() : rw;

  // Next supports:
  //  - Array (treated like "afterFiles")
  //  - Object { beforeFiles, afterFiles, fallback }
  if (Array.isArray(resolved)) {
    return { beforeFiles: [], afterFiles: resolved, fallback: [] };
  }

  return {
    beforeFiles: Array.isArray(resolved?.beforeFiles) ? resolved.beforeFiles : [],
    afterFiles: Array.isArray(resolved?.afterFiles) ? resolved.afterFiles : [],
    fallback: Array.isArray(resolved?.fallback) ? resolved.fallback : [],
  };
}

export function withFxProxy(nextConfig = {}) {
  // Prefer explicit APIGW origin (prod), then public base vars (dev), then fallback.
  const APIGW =
    firstNonEmpty(
      process.env.APIGW_ORIGIN,
      process.env.API_GATEWAY_ORIGIN,
      process.env.NEXT_PUBLIC_APIGW_BASE,
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL,
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL?.replace?.(/\/+$/, ''),
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE,
    ) || 'http://localhost:3010';

  // Ensure we always generate a valid absolute destination.
  const apigw = trimSlash(APIGW);

  const fxRewriteWildcard = {
    source: '/api/fx/:path*',
    destination: `${apigw}/api/fx/:path*`,
  };

  // Optional: if anyone hits /api/fx (no trailing slash/path)
  const fxRewriteRoot = {
    source: '/api/fx',
    destination: `${apigw}/api/fx`,
  };

  return {
    ...nextConfig,
    async rewrites() {
      const user = await resolveUserRewrites(nextConfig);

      // Put FX rewrites FIRST so they always win.
      return {
        beforeFiles: [fxRewriteRoot, fxRewriteWildcard, ...user.beforeFiles],
        afterFiles: user.afterFiles,
        fallback: user.fallback,
      };
    },
  };
}
