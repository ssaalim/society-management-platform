import { z } from 'zod';

export const voucherLineSchema = z.object({
  ledgerId: z.string().uuid(),
  type: z.enum(['DEBIT', 'CREDIT']),
  amount: z.number().positive(),
});

export const createVoucherSchema = z.object({
  voucherNumber: z.string().min(1).max(50),
  type: z.enum(['RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA']).default('JOURNAL'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  narration: z.string().max(500).optional().nullable(),
  lines: z.array(voucherLineSchema).min(2, { message: 'A voucher must have at least 2 transaction lines.' }),
});

export type CreateVoucherDto = z.infer<typeof createVoucherSchema>;
export type VoucherLineDto = z.infer<typeof voucherLineSchema>;
