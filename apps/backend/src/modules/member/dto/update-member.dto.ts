import { z } from 'zod';
import { createMemberSchema } from './create-member.dto';

export const updateMemberSchema = createMemberSchema.partial();

export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
