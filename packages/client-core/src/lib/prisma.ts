import { PrismaClient, Prisma } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __ambulant_client_core_prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__ambulant_client_core_prisma__ ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__ambulant_client_core_prisma__ = prisma;
}

export type PrismaTx = Prisma.TransactionClient;

export function dbOrTx(tx?: PrismaTx) {
  return tx ?? prisma;
}

export default prisma;