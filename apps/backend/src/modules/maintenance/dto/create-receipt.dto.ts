import { z } from 'zod';

export const createReceiptSchema = z.object({
  billId: z.string().uuid(),
  amountPaid: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'NEFT', 'CHEQUE', 'CARD']).default('UPI'),
  transactionId: z.string().max(100).optional().nullable(),
  depositAccountId: z.string().uuid().optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateReceiptDto = z.infer<typeof createReceiptSchema>;

export const bulkReceiptSchema = z.object({
  billIds: z.array(z.string().uuid()).min(1),
  amountPaid: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'NEFT', 'CHEQUE', 'CARD']).default('UPI'),
  transactionId: z.string().max(100).optional().nullable(),
  depositAccountId: z.string().uuid().optional().nullable(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type BulkReceiptDto = z.infer<typeof bulkReceiptSchema>;
