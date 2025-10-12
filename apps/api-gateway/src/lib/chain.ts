import crypto from 'node:crypto';
export function sha256Hex(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }
export async function writeEhrIndex(entry: {
  recordId: string; patientHash: string; clinicianHash: string;
  contentHash: string; uri: string; kind: string;
}) {
  // TODO: swap for ethers/Fabric client
  return { txId: `carechain_${entry.recordId}` };
}
