import { createHash } from 'crypto';
import { prisma } from './db';

export function sha256Hex(s: string) {
  return createHash('sha256').update(s).digest('hex');
}

export async function anchorEncounter(encounterId: string, canonicalJson: unknown) {
  const contentHash = sha256Hex(JSON.stringify(canonicalJson));
  // TODO: if RPC config exists, submit tx via ethers and get txId
  return prisma.encounterAnchor.upsert({
    where: { encounterId },
    update: { contentHash },
    create: { encounterId, contentHash, chain: 'offchain-dev' }
  });
}
