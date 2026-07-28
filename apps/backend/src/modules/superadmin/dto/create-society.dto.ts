import { z } from 'zod';

export const createSocietySchema = z.object({
  name: z.string().min(3, { message: 'Society name is required and must be at least 3 characters.' }),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.' }),
  address: z.string().optional(),
  registrationNumber: z.string().optional(),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  
  // President details
  presidentName: z.string().min(2, { message: 'President name is required.' }),
  presidentEmail: z.string().email({ message: 'Valid president email is required.' }),
  presidentMobile: z.string().min(10, { message: 'President mobile is required.' }),
});

export type CreateSocietyDto = z.infer<typeof createSocietySchema>;
