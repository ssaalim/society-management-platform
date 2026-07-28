import { z } from 'zod';

export const refundPaymentSchema = z.object({
  refundAmount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

export type RefundPaymentDto = z.infer<typeof refundPaymentSchema>;
