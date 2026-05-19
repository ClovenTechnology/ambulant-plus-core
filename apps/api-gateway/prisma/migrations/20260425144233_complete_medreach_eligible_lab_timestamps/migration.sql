-- AlterTable
ALTER TABLE "MedReachOrderEligibleLab" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "expiredAt" TIMESTAMP(3);
