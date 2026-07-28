import { z } from 'zod';

export const createAssetLogSchema = z.object({
  type: z.enum(['MAINTENANCE', 'REPAIR']),
  description: z.string().min(1).max(500),
  cost: z.number().nonnegative().default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['SCHEDULED', 'COMPLETED']).default('COMPLETED'),
});

export type CreateAssetLogDto = z.infer<typeof createAssetLogSchema>;
