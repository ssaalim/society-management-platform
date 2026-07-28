import { z } from 'zod';
import { createFlatSchema } from './create-flat.dto';

export const updateFlatSchema = createFlatSchema.partial().extend({
  // Tenancy assignment fields (optional)
  ownerId: z.string().uuid().optional().nullable(),
  tenantId: z.string().uuid().optional().nullable(),
  leaseStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  leaseEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  rentalAgreementUrl: z.string().url().optional().nullable(),
  policeVerificationUrl: z.string().url().optional().nullable(),
  tenantNocUrl: z.string().url().optional().nullable(),
  emergencyContactName: z.string().max(150).optional().nullable(),
  emergencyContactPhone: z.string().max(15).optional().nullable(),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  moveOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export type UpdateFlatDto = z.infer<typeof updateFlatSchema>;
