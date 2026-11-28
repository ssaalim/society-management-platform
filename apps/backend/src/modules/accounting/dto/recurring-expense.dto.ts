import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');
const money = z.coerce.number().min(0).max(100_000_000);

export const recurringExpenseSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    expenseHead: z.string().trim().min(1).max(255),
    vendorName: z.string().trim().max(255).nullable().default(null),
    staffId: z.string().uuid().nullable().default(null),
    /** FIXED: same amount every time. VARIABLE: amount is an estimate, always reviewed (electricity). STAFF_SALARY: the staff member's salary. */
    amountType: z.enum(['FIXED', 'VARIABLE', 'STAFF_SALARY']).default('FIXED'),
    amount: money.default(0),
    frequency: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']).default('MONTHLY'),
    dayOfMonth: z.coerce.number().int().min(1).max(28).default(1),
    startDate: isoDate,
    endDate: isoDate.nullable().default(null),
    autoPost: z.boolean().default(false),
    postAs: z.enum(['PAID', 'UNPAID']).default('UNPAID'),
    paymentMode: z.enum(['BANK', 'CASH']).default('BANK'),
    /** Bank account to pay from; null uses the society's default bank account. */
    bankAccountId: z.string().uuid().nullable().default(null),
    notes: z.string().trim().max(2000).nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.amountType !== 'STAFF_SALARY' || !!d.staffId, { message: 'Pick the staff member whose salary this is.', path: ['staffId'] })
  .refine((d) => d.amountType === 'VARIABLE' || d.amountType === 'STAFF_SALARY' || d.amount > 0, { message: 'Enter the amount.', path: ['amount'] })
  .refine((d) => !(d.autoPost && d.amountType === 'VARIABLE'), {
    message: 'Expenses whose amount changes every time must be reviewed before posting.',
    path: ['autoPost'],
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { message: 'The end date must be after the start date.', path: ['endDate'] });

export type RecurringExpenseDto = z.infer<typeof recurringExpenseSchema>;

/** Confirming a drafted expense: the actual bill amount and how it was settled. */
export const postDraftSchema = z.object({
  amount: z.coerce.number().positive().max(100_000_000),
  date: isoDate,
  billNumber: z.string().trim().max(100).nullable().default(null),
  status: z.enum(['PAID', 'UNPAID']),
  paymentMode: z.enum(['BANK', 'CASH']).default('BANK'),
  bankAccountId: z.string().uuid().nullable().default(null),
  expenseHead: z.string().trim().min(1).max(255).optional(),
});

export type PostDraftDto = z.infer<typeof postDraftSchema>;
