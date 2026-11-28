import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');
const money = z.coerce.number().min(0).max(1_000_000_000);

export const campaignSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(5000).nullable().default(null),
    targetAmount: money.refine((n) => n > 0, 'Enter the target amount.'),
    method: z.enum(['EQUAL', 'BY_AREA', 'BY_FLAT_TYPE', 'VOLUNTARY']),
    perFlatAmount: money.nullable().default(null),
    ratePerSqft: z.coerce.number().min(0).max(100_000).nullable().default(null),
    typeAmounts: z.record(z.string(), money).nullable().default(null),
    dueDate: isoDate.nullable().default(null),
    /** CASH: books only money received. ACCRUAL: issued shares are booked as receivables. */
    accountingMode: z.enum(['CASH', 'ACCRUAL']).default('CASH'),
  })
  .refine((d) => d.method !== 'EQUAL' || (d.perFlatAmount ?? 0) > 0, { message: 'Enter the amount per flat.', path: ['perFlatAmount'] })
  .refine((d) => d.method !== 'BY_AREA' || (d.ratePerSqft ?? 0) > 0, { message: 'Enter the rate per sq ft.', path: ['ratePerSqft'] })
  .refine((d) => d.method !== 'BY_FLAT_TYPE' || Object.values(d.typeAmounts || {}).some((n) => n > 0), {
    message: 'Enter an amount for at least one flat type.',
    path: ['typeAmounts'],
  });
export type CampaignDto = z.infer<typeof campaignSchema>;

/** The shares to issue, after the office has reviewed (and possibly changed or removed) the computed ones. */
export const issueSchema = z.object({
  shares: z.array(z.object({ flatId: z.string().uuid(), amount: money })).max(5000),
});

export const paymentSchema = z
  .object({
    shareId: z.string().uuid().nullable().default(null),
    flatId: z.string().uuid().nullable().default(null),
    payerName: z.string().trim().max(150).nullable().default(null),
    amount: money.refine((n) => n > 0, 'Enter the amount received.'),
    paidAt: isoDate,
    paymentMode: z.enum(['CASH', 'UPI', 'NEFT', 'CHEQUE', 'CARD']),
    bankAccountId: z.string().uuid().nullable().default(null),
    reference: z.string().trim().max(100).nullable().default(null),
  })
  .refine((d) => d.shareId || d.flatId || d.payerName, { message: 'Say who paid (a flat or a name).', path: ['payerName'] });
export type FundPaymentDto = z.infer<typeof paymentSchema>;

export const waiveSchema = z.object({ reason: z.string().trim().min(1, 'Give a reason.').max(500) });

export const expenseSchema = z.object({
  description: z.string().trim().min(1).max(255),
  vendorName: z.string().trim().max(150).nullable().default(null),
  billNumber: z.string().trim().max(100).nullable().default(null),
  amount: money.refine((n) => n > 0, 'Enter the amount.'),
  spentAt: isoDate,
  paymentMode: z.enum(['BANK', 'CASH']),
  bankAccountId: z.string().uuid().nullable().default(null),
  /** Set when the money bought a fixed asset: booked to this asset ledger, with the fund moved to the capital reserve. */
  assetName: z.string().trim().min(1).max(150).nullable().default(null),
});
export type FundExpenseDto = z.infer<typeof expenseSchema>;

/** A resident reports a payment they made (UPI, transfer, cheque); it counts once approved. */
export const claimSchema = z.object({
  shareId: z.string().uuid().nullable().default(null),
  flatId: z.string().uuid().nullable().default(null),
  amount: money.refine((n) => n > 0, 'Enter the amount you paid.'),
  paidAt: isoDate,
  paymentMode: z.enum(['UPI', 'NEFT', 'CHEQUE', 'CASH', 'CARD']),
  reference: z.string().trim().max(100).nullable().default(null),
  note: z.string().trim().max(500).nullable().default(null),
  proofUrl: z.string().trim().max(1000).nullable().default(null),
});
export type FundClaimDto = z.infer<typeof claimSchema>;

export const approveClaimSchema = z.object({
  bankAccountId: z.string().uuid().nullable().default(null),
  paidAt: isoDate.nullable().default(null),
});
export const reasonSchema = z.object({ reason: z.string().trim().min(1, 'Give a reason.').max(500) });
export const onlineOrderSchema = z.object({
  shareId: z.string().uuid().nullable().default(null),
  amount: z.coerce.number().min(1).max(10_000_000).nullable().default(null),
});
export const onlineVerifySchema = z.object({
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(200),
});
