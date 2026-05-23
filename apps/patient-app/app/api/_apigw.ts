// apps/patient-app/app/api/_apigw.ts
const CANONICAL_API_GATEWAY = 'https://ambulant-plus-core-api-gateway-kdon.vercel.app';

function trimSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function apigwBase() {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    '';

  const base = configured.trim() || CANONICAL_API_GATEWAY;
  return trimSlash(base);
}
