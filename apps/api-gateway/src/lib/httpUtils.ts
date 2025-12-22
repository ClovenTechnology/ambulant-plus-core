//apps/api-gateway/src/lib/httpUtils.ts
import type { Request } from 'express';

export function getClientInfo(req: Request) {
  const userAgent = req.headers['user-agent'] || undefined;

  // If you’re behind a proxy / load balancer, make sure trust-proxy is set
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    undefined;

  // You can later plug a GeoIP lookup here:
  const ipCountry = undefined;
  const ipCity = undefined;

  return { ip, userAgent, ipCountry, ipCity };
}
