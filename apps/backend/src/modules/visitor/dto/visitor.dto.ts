import { z } from 'zod';

const instant = z.string().datetime({ offset: true, message: 'Use a date and time.' });
const mobile = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{7,15}$/, 'Enter a valid mobile number.')
  .transform((s) => s.replace(/\s+/g, ''));

export const VISITOR_TYPES = ['GUEST', 'DELIVERY', 'CAB', 'SERVICE'] as const;
export const HELP_CATEGORIES = ['MAID', 'COOK', 'DRIVER', 'NANNY', 'CLEANER', 'OTHER'] as const;

/** A walk-in logged by the guard. */
export const walkInSchema = z.object({
  flatId: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  mobile,
  type: z.enum(VISITOR_TYPES).default('GUEST'),
  company: z.string().trim().max(100).nullable().default(null),
  vehicleNumber: z.string().trim().max(50).nullable().default(null),
  headcount: z.coerce.number().int().min(1).max(100).default(1),
  purpose: z.string().trim().max(500).nullable().default(null),
  gateNo: z.string().trim().max(50).nullable().default(null),
  /** The guard phoned the resident, who agreed: let them in straight away. */
  confirmedByPhone: z.boolean().default(false),
});
export type WalkInDto = z.infer<typeof walkInSchema>;

export const decisionSchema = z.object({ approve: z.boolean(), note: z.string().trim().max(500).nullable().default(null) });

export const passSchema = z
  .object({
    flatId: z.string().uuid().nullable().default(null),
    guestName: z.string().trim().min(1).max(150),
    guestMobile: mobile.nullable().default(null),
    type: z.enum(VISITOR_TYPES).default('GUEST'),
    vehicleNumber: z.string().trim().max(50).nullable().default(null),
    validFrom: instant,
    validUntil: instant,
    maxUses: z.coerce.number().int().min(1).max(50).default(1),
    notes: z.string().trim().max(500).nullable().default(null),
  })
  .refine((d) => new Date(d.validUntil) > new Date(d.validFrom), { message: 'The pass must end after it starts.', path: ['validUntil'] })
  .refine((d) => new Date(d.validUntil).getTime() - new Date(d.validFrom).getTime() <= 31 * 86400_000, {
    message: 'A pass can be valid for at most 31 days.',
    path: ['validUntil'],
  });
export type PassDto = z.infer<typeof passSchema>;

export const codeEntrySchema = z.object({ flatId: z.string().uuid().nullable().default(null), gateNo: z.string().trim().max(50).nullable().default(null) });

export const dailyHelpSchema = z.object({
  name: z.string().trim().min(1).max(150),
  mobile,
  category: z.enum(HELP_CATEGORIES),
  flatId: z.string().uuid().nullable().default(null),
});
export type DailyHelpDto = z.infer<typeof dailyHelpSchema>;
