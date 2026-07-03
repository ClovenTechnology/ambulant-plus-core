export function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

export function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function configuredGatewayBase() {
  const raw =
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  const value = cleanBaseUrl(raw);
  return value || null;
}

export function gatewayBase() {
  const value = configuredGatewayBase();

  if (!value && isProductionRuntime()) {
    throw new Error('gateway_base_not_configured');
  }

  return value || 'http://localhost:3010';
}

export function adminBaseUrl() {
  const raw =
    process.env.ADMIN_BASE_URL ||
    process.env.NEXT_PUBLIC_ADMIN_BASE_URL ||
    'https://admin.ambulantplus.co.za';

  return cleanBaseUrl(raw);
}

export function insightCoreStudioPublicUrl() {
  const raw =
    process.env.INSIGHTCORE_STUDIO_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_INSIGHTCORE_STUDIO_URL ||
    'https://insightcore.ambulantplus.co.za';

  return cleanBaseUrl(raw);
}