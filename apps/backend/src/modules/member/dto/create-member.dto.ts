import { z } from 'zod';

export const familyMemberSchema = z.object({
  name: z.string().min(1).max(150),
  relation: z.string().min(1).max(50),
  mobile: z.string().max(15).optional().nullable(),
  aadhaar: z.string().max(12).optional().nullable(),
});

export const nomineeSchema = z.object({
  name: z.string().min(1).max(150),
  relation: z.string().min(1).max(50),
  mobile: z.string().max(15).optional().nullable(),
  sharePercentage: z.number().min(0).max(100).default(100),
});

export const createMemberSchema = z.object({
  userId: z.string().uuid({ message: 'Invalid user UUID.' }).optional(),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  mobile: z.string().max(15).optional().nullable(),
  membershipNumber: z.string().max(50).optional(),
  memberType: z.enum(['OWNER', 'CO_OWNER', 'TENANT']).default('OWNER'),
  photoUrl: z.string().url().optional().nullable(),
  aadhaarUrl: z.string().url().optional().nullable(),
  panUrl: z.string().url().optional().nullable(),
  agreementUrl: z.string().url().optional().nullable(),
  policeVerificationUrl: z.string().url().optional().nullable(),
  emergencyContactName: z.string().max(150).optional().nullable(),
  emergencyContactPhone: z.string().max(15).optional().nullable(),
  status: z.string().default('ACTIVE'),
  familyMembers: z.array(familyMemberSchema).optional(),
  nominees: z.array(nomineeSchema).optional(),
});

export type CreateMemberDto = z.infer<typeof createMemberSchema>;
export type FamilyMemberDto = z.infer<typeof familyMemberSchema>;
export type NomineeDto = z.infer<typeof nomineeSchema>;
