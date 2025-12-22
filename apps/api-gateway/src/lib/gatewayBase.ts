// apps/api-gateway/src/lib/gatewayBase.ts (or shared util)
export function getGatewayBase(): string {
  return (
    process.env.NEXT_PUBLIC_APIGW_BASE?.trim() ||
    'http://127.0.0.1:3010'
  );
}
