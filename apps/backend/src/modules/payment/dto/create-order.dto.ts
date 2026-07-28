import { z } from 'zod';

export const createOrderSchema = z.object({
  billId: z.string().uuid(),
  amount: z.number().positive(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
