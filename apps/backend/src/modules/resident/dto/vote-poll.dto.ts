import { z } from 'zod';

export const votePollSchema = z.object({
  choice: z.enum(['YES', 'NO', 'ABSTAIN']),
});

export type VotePollDto = z.infer<typeof votePollSchema>;
