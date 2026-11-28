import { z } from 'zod';

const money = z.coerce.number().min(0).max(10_000_000);

export const floorRateSchema = z
  .object({
    fromFloor: z.coerce.number().int().min(-5).max(200),
    toFloor: z.coerce.number().int().min(-5).max(200).nullable(),
    rate: money,
  })
  .refine((r) => r.toFloor === null || r.toFloor >= r.fromFloor, { message: '"To floor" must be at or above "From floor".' });

export const billingCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  usage: z.enum(['RESIDENTIAL', 'COMMERCIAL']),
  calculationType: z.enum(['SOCIETY_FORMULA', 'PER_SQ_FT', 'FIXED']),
  areaType: z.enum(['SUPER_BUILTUP', 'CARPET_AREA']).default('SUPER_BUILTUP'),
  rate: money.default(0),
  floorRates: z.array(floorRateSchema).max(50).default([]),
  extraCharges: z.record(z.string().trim().min(1).max(60), money).default({}),
  includeParking: z.boolean().default(true),
  flatTypes: z.array(z.string().trim().min(1).max(50)).max(100).default([]),
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and dashes only.')
    .default('INV'),
  gstEnabled: z.boolean().default(false),
  gstRate: z.coerce.number().min(0).max(28).default(18),
  gstThresholdMonthly: money.default(7500),
  penaltyType: z.enum(['PERCENTAGE', 'FIXED_PER_MONTH', 'FIXED_ONE_TIME', 'NONE']).nullable().default(null),
  penaltyInterestRate: z.coerce.number().min(0).max(100).nullable().default(null),
  penaltyFlatAmount: money.nullable().default(null),
  penaltyGracePeriodDays: z.coerce.number().int().min(0).max(365).nullable().default(null),
  sortOrder: z.coerce.number().int().default(0),
});

export type BillingCategoryDto = z.infer<typeof billingCategorySchema>;

export const assignCategorySchema = z.object({
  flatIds: z.array(z.string().uuid()).min(1).max(5000),
  /** null clears the manual assignment, so the unit follows its flat type again. */
  billingCategoryId: z.string().uuid().nullable(),
});
