import { z } from 'zod';

export const generateBillsSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']).default('MONTHLY'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generationType: z.enum(['SINGLE', 'PER_MONTH']).default('SINGLE'),
  flatIds: z.array(z.string().uuid()).optional(),
});

export type GenerateBillsDto = z.infer<typeof generateBillsSchema>;
