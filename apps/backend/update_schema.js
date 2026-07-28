const fs = require('fs');
const file = '/Users/salimshaikh/Documents/societyApp/apps/backend/database/schema.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  status: varchar('status', { length: 50 }).default('CLEARED').notNull(), // CLEARED, BOUNCED, REFUNDED, CANCELLED, REVIEW, REJECTED
  razorpayOrderId: varchar('razorpay_order_id', { length: 100 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 100 }),
  razorpaySignature: varchar('razorpay_signature', { length: 255 }),
  refundedAmount: numeric('refunded_amount', { precision: 12, scale: 2 }),
  cancellationReason: text('cancellation_reason'),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  rejectionReason: text('rejection_reason'),
  userRemark: text('user_remark'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
`;

content = content.replace(/status: varchar\('status', \{ length: 50 \}\)\.default\('CLEARED'\)\.notNull\(\),.*[\s\S]*?createdAt: timestamp\('created_at', \{ withTimezone: true \}\)\.defaultNow\(\)\.notNull\(\),/, replacement.trim() + ',');

fs.writeFileSync(file, content);
