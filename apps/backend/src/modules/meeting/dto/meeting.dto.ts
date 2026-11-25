import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');
const instant = z.string().datetime({ offset: true, message: 'Use a date and time.' });

export const meetingSchema = z.object({
  title: z.string().trim().min(1).max(255),
  type: z.enum(['AGM', 'EGM', 'COMMITTEE', 'GENERAL']),
  audience: z.enum(['ALL_MEMBERS', 'COMMITTEE']),
  scheduledAt: instant,
  location: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().default(null),
  quorumRequired: z.coerce.number().int().min(1).max(100000).nullable().default(null),
  allowProxy: z.boolean().default(false),
  proxyLimit: z.coerce.number().int().min(1).max(20).default(1),
  proxiesCountForQuorum: z.boolean().default(false),
});
export type MeetingDto = z.infer<typeof meetingSchema>;

export const agendaItemSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().default(null),
  presenter: z.string().trim().max(150).nullable().default(null),
  position: z.coerce.number().int().min(0).max(999).optional(),
});
export type AgendaItemDto = z.infer<typeof agendaItemSchema>;

export const rsvpSchema = z.object({ response: z.enum(['ATTENDING', 'NOT_ATTENDING', 'TENTATIVE']) });
export const attendanceSchema = z.object({ userId: z.string().uuid(), present: z.boolean(), viaProxy: z.boolean().default(false) });
export const proxySchema = z
  .object({
    proxyUserId: z.string().uuid().nullable().default(null),
    proxyName: z.string().trim().max(150).nullable().default(null),
  })
  .refine((d) => d.proxyUserId || d.proxyName, { message: 'Choose a member or enter the name of your proxy.', path: ['proxyName'] });
export const recordProxySchema = z
  .object({
    memberUserId: z.string().uuid(),
    proxyUserId: z.string().uuid().nullable().default(null),
    proxyName: z.string().trim().max(150).nullable().default(null),
    note: z.string().trim().max(500).nullable().default(null),
  })
  .refine((d) => d.proxyUserId || d.proxyName, { message: 'Choose a member or enter the proxy’s name.', path: ['proxyName'] });
export const cancelSchema = z.object({ reason: z.string().trim().max(1000).nullable().default(null) });
export const minutesSchema = z.object({ content: z.string().max(100_000) });

export const actionItemSchema = z.object({
  title: z.string().trim().min(1).max(255),
  ownerUserId: z.string().uuid().nullable().default(null),
  dueDate: isoDate.nullable().default(null),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).default('OPEN'),
  notes: z.string().trim().max(2000).nullable().default(null),
  resolutionId: z.string().uuid().nullable().default(null),
});
export type ActionItemDto = z.infer<typeof actionItemSchema>;

export const actionStatusSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']), notes: z.string().trim().max(2000).nullable().optional() });

export const resolutionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().max(10_000).nullable().default(null),
  agendaItemId: z.string().uuid().nullable().default(null),
  proposedBy: z.string().trim().max(150).nullable().default(null),
  secondedBy: z.string().trim().max(150).nullable().default(null),
  voters: z.enum(['OWNERS', 'ALL_MEMBERS', 'COMMITTEE']).default('OWNERS'),
  onePerFlat: z.boolean().default(true),
  threshold: z.enum(['SIMPLE', 'TWO_THIRDS', 'THREE_QUARTERS']).default('SIMPLE'),
});
export type ResolutionDto = z.infer<typeof resolutionSchema>;

export const openVotingSchema = z.object({ deadline: instant });
export const voteSchema = z.object({
  choice: z.enum(['FOR', 'AGAINST', 'ABSTAIN']),
  /** Which flat to vote for, when the member has more than one; all of theirs otherwise. */
  flatId: z.string().uuid().nullable().default(null),
  /** A proxy voting for the member who appointed them. */
  onBehalfOf: z.string().uuid().nullable().default(null),
});
export const recordVoteSchema = z.object({
  userId: z.string().uuid(),
  flatId: z.string().uuid().nullable().default(null),
  choice: z.enum(['FOR', 'AGAINST', 'ABSTAIN']),
  note: z.string().trim().min(1, 'Say how the member confirmed their vote.').max(500),
});
