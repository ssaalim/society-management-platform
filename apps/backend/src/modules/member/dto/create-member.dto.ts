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
  
  // Occupancy Type (Relation to Unit / Flat / Shop / Office)
  memberType: z.enum([
    'OWNER', 
    'CO_OWNER', 
    'TENANT', 
    'FAMILY_MEMBER',
    'ASSOCIATE_MEMBER'
  ]).default('OWNER'),

  // Society Committee Designations (Optional managing board roles)
  committeeDesignation: z.enum([
    'PRESIDENT',
    'VICE_PRESIDENT',
    'SECRETARY',
    'JOINT_SECRETARY',
    'TREASURER',
    'ACCOUNTANT',
    'AUDITOR',
    'COMMITTEE_MEMBER',
    'ESTATE_MANAGER',
    'MAINTENANCE_INCHARGE',
    'SECURITY_SUPERVISOR',
    'CULTURAL_SECRETARY',
    'LEGAL_ADVISOR',
    'NONE'
  ]).optional().nullable(),

  unitType: z.string().optional().nullable(),
  unitNumber: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  aadhaarUrl: z.string().url().optional().nullable(),
  panUrl: z.string().url().optional().nullable(),
  agreementUrl: z.string().url().optional().nullable(),
  policeVerificationUrl: z.string().url().optional().nullable(),
  emergencyContactName: z.string().max(150).optional().nullable(),
  emergencyContactPhone: z.string().max(15).optional().nullable(),
  status: z.string().default('ACTIVE'),
  canLogin: z.boolean().default(true),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().nullable(),
  role: z.string().optional().nullable(),
  familyMembers: z.array(familyMemberSchema).optional(),
  nominees: z.array(nomineeSchema).optional(),
});

export type CreateMemberDto = z.infer<typeof createMemberSchema>;
export type FamilyMemberDto = z.infer<typeof familyMemberSchema>;
export type NomineeDto = z.infer<typeof nomineeSchema>;
