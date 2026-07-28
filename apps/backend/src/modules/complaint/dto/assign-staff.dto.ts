import { z } from 'zod';

export const assignStaffSchema = z.object({
  staffId: z.string().uuid().nullable().optional(),
});

export type AssignStaffDto = z.infer<typeof assignStaffSchema>;
