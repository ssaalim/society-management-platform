import { z } from 'zod';
import { createSocietySchema } from './create-society.dto';

export const updateSocietySchema = createSocietySchema.partial().extend({
  logoUrl: z.string().url().optional().nullable(),
  registrationCertificateUrl: z.string().url().optional().nullable(),
  byeLawsUrl: z.string().url().optional().nullable(),
  bankPassbookUrl: z.string().url().optional().nullable(),
});

export type UpdateSocietyDto = z.infer<typeof updateSocietySchema>;
