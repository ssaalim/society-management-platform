import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  maxFlats: z.number().int().positive().default(100),
  maxStorageGb: z.number().int().positive().default(10),
});

export type CreatePlanDto = z.infer<typeof createPlanSchema>;
