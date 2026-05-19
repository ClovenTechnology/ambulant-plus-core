import { z } from "zod";

export const pushOrderSchema = z.object({
  erxOrderId: z.string().min(1),
  fulfillment: z.enum(["PICKUP", "DELIVERY"]),
  destination: z
    .object({
      addr: z.string().min(1),
      lat: z.number(),
      lng: z.number()
    })
    .optional()
});

export const pharmacyAcceptSchema = z.object({
  prepEtaMin: z.number().int().min(1).max(24 * 60).optional(),
  stockFlags: z
    .record(z.string(), z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]))
    .optional()
});

export const selectionSchema = z.object({
  offerId: z.string().min(1),
  selections: z.record(
    z.string(), // orderItemId
    z.object({
      chosenSkuId: z.string().min(1)
    })
  )
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["MEDICAL_AID", "CARD", "COD"]),
  idempotencyKey: z.string().min(1).optional()
});