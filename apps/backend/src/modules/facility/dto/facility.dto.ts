import { z } from 'zod';

const money = z.coerce.number().min(0).max(100_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');
/** A moment with its time zone, e.g. 2026-12-05T18:00:00+05:30. */
const instant = z.string().datetime({ offset: true, message: 'Use a date and time.' });

export const serviceChargeSchema = z.object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(2000).nullable().default(null),
    /** BOOKING reserves a slot that can't overlap another booking; SERVICE is a one-off service. */
    kind: z.enum(['BOOKING', 'SERVICE']).default('SERVICE'),
    pricing: z.enum(['FIXED', 'PER_HOUR', 'PER_DAY']).default('FIXED'),
    rate: money,
    depositAmount: money.default(0),
    gstRate: z.coerce.number().min(0).max(28).default(0),
    requiresApproval: z.boolean().default(true),
    residentCanRequest: z.boolean().default(true),
    isActive: z.boolean().default(true),
  });

export type ServiceChargeDto = z.infer<typeof serviceChargeSchema>;

export const serviceRequestSchema = z
  .object({
    chargeId: z.string().uuid(),
    /** Required for the office; a resident's own flat is used when omitted. */
    flatId: z.string().uuid().nullable().default(null),
    startAt: instant.nullable().default(null),
    endAt: instant.nullable().default(null),
    purpose: z.string().trim().max(1000).nullable().default(null),
  })
  .refine((d) => !d.startAt || !d.endAt || new Date(d.endAt) > new Date(d.startAt), {
    message: 'The end must be after the start.',
    path: ['endAt'],
  });

export type ServiceRequestDto = z.infer<typeof serviceRequestSchema>;

export const decisionSchema = z.object({ note: z.string().trim().max(1000).nullable().default(null) });

export const paymentSchema = z.object({
  paidAt: isoDate,
  paymentMode: z.enum(['CASH', 'UPI', 'NEFT', 'CHEQUE', 'CARD']),
  bankAccountId: z.string().uuid().nullable().default(null),
  reference: z.string().trim().max(100).nullable().default(null),
});

export type PaymentDto = z.infer<typeof paymentSchema>;

export const refundSchema = z.object({
  /** Amount returned to the member; the rest of the deposit is kept (damages) as income. */
  refundAmount: money,
  refundedAt: isoDate,
  paymentMode: z.enum(['CASH', 'UPI', 'NEFT', 'CHEQUE']),
  bankAccountId: z.string().uuid().nullable().default(null),
  note: z.string().trim().max(1000).nullable().default(null),
});

export type RefundDto = z.infer<typeof refundSchema>;
