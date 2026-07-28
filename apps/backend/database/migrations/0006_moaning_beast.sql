ALTER TABLE "receipts" ADD COLUMN "status" varchar(50) DEFAULT 'CLEARED' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "razorpay_order_id" varchar(100);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "razorpay_payment_id" varchar(100);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "razorpay_signature" varchar(255);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "refunded_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "cancellation_reason" text;