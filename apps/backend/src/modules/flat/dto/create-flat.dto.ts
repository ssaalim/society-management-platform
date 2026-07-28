import { z } from 'zod';

export const createFlatSchema = z.object({
  floorId: z.string().uuid({ message: 'Invalid floor UUID.' }).optional().nullable(),
  number: z.string().min(1).max(50),
  sqftArea: z.number().positive({ message: 'Area must be a positive number.' }),
  carpetArea: z.number().positive().optional().nullable(),
  terraceArea: z.number().positive().optional().nullable(),
  flatType: z.string().max(50),
  ownerId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  leaseStart: z.string().optional().nullable(),
  leaseEnd: z.string().optional().nullable(),
  rentalAgreementUrl: z.string().optional().nullable(),
  policeVerificationUrl: z.string().optional().nullable(),
  tenantNocUrl: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  moveInDate: z.string().optional().nullable(),
});

export type CreateFlatDto = z.infer<typeof createFlatSchema>;
