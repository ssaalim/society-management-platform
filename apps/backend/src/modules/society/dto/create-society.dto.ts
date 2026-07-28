import { z } from 'zod';

export const createSocietySchema = z.object({
  name: z.string().min(3, { message: 'Society name must be at least 3 characters.' }).max(255),
  slug: z.string().min(3, { message: 'Slug must be at least 3 characters.' }).max(100).regex(/^[a-z0-9-]+$/, {
    message: 'Slug can only contain lowercase alphanumeric characters and hyphens.',
  }),
  address: z.string().optional(),
  gstin: z.string().length(15, { message: 'GSTIN must be exactly 15 characters.' }).optional().nullable(),
  pan: z.string().length(10, { message: 'PAN must be exactly 10 characters.' }).optional().nullable(),
  tan: z.string().length(10, { message: 'TAN must be exactly 10 characters.' }).optional().nullable(),
  registrationNumber: z.string().max(100).optional().nullable(),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format.' }).optional().nullable(),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format.' }).optional().nullable(),
});

export type CreateSocietyDto = z.infer<typeof createSocietySchema>;
