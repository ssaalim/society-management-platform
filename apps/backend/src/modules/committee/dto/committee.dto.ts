import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');

/** Committee posts; each is also the app role its holder gets while the term is current. */
export const COMMITTEE_POSTS = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'CULTURAL_SECRETARY',
  'COMMITTEE_MEMBER',
] as const;

export type CommitteePost = (typeof COMMITTEE_POSTS)[number];

export const termSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    startDate: isoDate,
    endDate: isoDate.nullable().default(null),
    electedOn: isoDate.nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { message: 'The term must end after it starts.', path: ['endDate'] });

export type TermDto = z.infer<typeof termSchema>;

export const positionSchema = z.object({
  memberId: z.string().uuid(),
  designation: z.enum(COMMITTEE_POSTS),
  responsibilities: z.string().trim().max(2000).nullable().default(null),
  bio: z.string().trim().max(2000).nullable().default(null),
  showContact: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  startDate: isoDate.nullable().default(null),
});

export type PositionDto = z.infer<typeof positionSchema>;

export const endPositionSchema = z.object({
  endDate: isoDate,
  reason: z.string().trim().max(500).nullable().default(null),
});

export const contactSchema = z.object({ showContact: z.boolean() });
