import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');

export const generateBillsSchema = z
  .object({
    billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']).default('MONTHLY'),
    periodStart: isoDate,
    periodEnd: isoDate,
    dueDate: isoDate,
    generationType: z.enum(['SINGLE', 'PER_MONTH']).default('SINGLE'),
    flatIds: z.array(z.string().uuid()).optional(),
    /** Late fees start on this date instead of due date + grace period. Optional. */
    penaltyFromDate: isoDate.optional().nullable(),
    /** When some flats are already billed for part of the period: false refuses, true skips those flats. */
    skipConflicts: z.boolean().default(false),
    /** Which units to bill: all, residential only, or commercial only (by billing category). */
    usage: z.enum(['ALL', 'RESIDENTIAL', 'COMMERCIAL']).default('ALL'),
  })
  .refine((d) => d.periodStart <= d.periodEnd, { message: 'Billing period end must be on or after its start.', path: ['periodEnd'] })
  .refine((d) => !d.penaltyFromDate || d.penaltyFromDate >= d.periodStart, {
    message: 'Penalty start date cannot be before the billing period starts.',
    path: ['penaltyFromDate'],
  });

export type GenerateBillsDto = z.infer<typeof generateBillsSchema>;
