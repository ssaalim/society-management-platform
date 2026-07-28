import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { PaymentRepository } from './payment.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  receipts, 
  maintenanceBills, 
  vouchers, 
  transactions 
} from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {}

  /**
   * Fetches payment receipts roster scoped by tenant and user role.
   */
  async findAll(filters: { search?: string; status?: string; mine?: boolean }, userId?: string) {
    return this.paymentRepository.searchReceipts({ ...filters, userId });
  }

  /**
   * Initializes order checkout payload (Mocking Razorpay Gateway Order API).
   */
  async createOrder(dto: CreateOrderDto, executorId?: string) {
    const orderId = `order_${Math.random().toString(36).substring(2, 15)}`;
    
    await this.logAction({
      societyId: this.paymentRepository['activeTenantId'],
      userId: executorId,
      action: 'PAYMENT_ORDER_CREATE',
      entityName: 'receipts',
      newValues: { orderId, amount: dto.amount, billId: dto.billId },
    });

    return {
      id: orderId,
      amount: dto.amount * 100, // Razorpay works in paise
      currency: 'INR',
      status: 'created',
    };
  }

  /**
   * Captures online payments capture events (Mocking Razorpay capturing webhook).
   */
  async capturePaymentWebhook(payload: {
    billId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    amount: number;
  }, executorId?: string) {
    const activeTenantId = this.paymentRepository['activeTenantId'];

    const bill = await this.db.query.maintenanceBills.findFirst({
      where: eq(maintenanceBills.id, payload.billId),
    });

    if (!bill) {
      throw new NotFoundException('Bill invoice context not found.');
    }

    const payAmount = Number(payload.amount);
    const invoiceAmount = Number(bill.totalAmount);

    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (payAmount < invoiceAmount) {
      nextStatus = 'PARTIAL';
    }

    const bankLedger = await this.paymentRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.paymentRepository.findLedgerByName('Maintenance Receivables');

    let receiptRecord = null;

    await this.db.transaction(async (tx) => {
      // 1. Update bill status
      await tx
        .update(maintenanceBills)
        .set({ status: nextStatus })
        .where(eq(maintenanceBills.id, payload.billId));

      // 2. Insert receipt
      const receiptsList = await tx.insert(receipts).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        billId: payload.billId,
        receiptNumber: `REC-ONLINE-${Date.now()}`,
        amountPaid: payAmount.toFixed(2),
        paymentMode: 'RAZORPAY',
        paymentDate: new Date().toISOString().substring(0, 10),
        referenceNumber: payload.razorpayPaymentId,
        status: 'CLEARED',
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: payload.razorpayPaymentId,
        razorpaySignature: payload.razorpaySignature,
      }).returning();

      receiptRecord = receiptsList[0];

      // 3. Post double-entry payment receipt voucher
      const voucherId = require('crypto').randomUUID();
      await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: `VOU-${receiptRecord.receiptNumber}`,
        type: 'RECEIPT',
        date: new Date().toISOString().substring(0, 10),
        narration: `Razorpay Online Payment captured for Bill ID: ${payload.billId}`,
      });

      // Debit Bank Account
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: bankLedger.id,
        type: 'DEBIT',
        amount: payAmount.toFixed(2),
      });

      // Credit Receivables
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: receivablesLedger.id,
        type: 'CREDIT',
        amount: payAmount.toFixed(2),
      });
    });

    // 4. Trigger notifications dispatchers (SMS, Email, WhatsApp confirmations)
    await this.dispatchPaymentNotifications(receiptRecord);

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'PAYMENT_CAPTURE_ONLINE',
      entityName: 'receipts',
      entityId: payload.billId,
      newValues: receiptRecord,
    });

    return receiptRecord;
  }

  /**
   * Reverse payment logs and logs refunded amount.
   */
  async refundPayment(receiptId: string, dto: RefundPaymentDto, executorId?: string) {
    const activeTenantId = this.paymentRepository['activeTenantId'];

    const receipt = await this.paymentRepository.findById(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt record not found.');
    }

    if (receipt.status === 'REFUNDED') {
      throw new BadRequestException('Receipt is already refunded.');
    }

    const bankLedger = await this.paymentRepository.findLedgerByName('Bank Account SBI');
    const refundsLedger = await this.paymentRepository.findLedgerByName('Refund Expense Accounts');

    await this.db.transaction(async (tx) => {
      // 1. Update receipt status
      await tx
        .update(receipts)
        .set({ 
          status: 'REFUNDED', 
          refundedAmount: dto.refundAmount.toString(),
          cancellationReason: dto.reason 
        })
        .where(eq(receipts.id, receiptId));

      // 2. Post reverse journal double-entry voucher
      const voucherId = require('crypto').randomUUID();
      await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: `VOU-REFUND-${receipt.receiptNumber}`,
        type: 'JOURNAL',
        date: new Date().toISOString().substring(0, 10),
        narration: `Refund issued for Receipt ${receipt.receiptNumber}. Reason: ${dto.reason}`,
      });

      // Debit Refund Expense Accounts
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: refundsLedger.id,
        type: 'DEBIT',
        amount: dto.refundAmount.toFixed(2),
      });

      // Credit Bank Account
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: bankLedger.id,
        type: 'CREDIT',
        amount: dto.refundAmount.toFixed(2),
      });
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'PAYMENT_REFUND_POST',
      entityName: 'receipts',
      entityId: receiptId,
      newValues: { receiptId, refundAmount: dto.refundAmount },
    });

    return { success: true };
  }

  /**
   * Cancels payment receipts and posts reverse adjustments.
   */
  async cancelPayment(receiptId: string, reason: string, executorId?: string) {
    const activeTenantId = this.paymentRepository['activeTenantId'];

    const receipt = await this.paymentRepository.findById(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt record not found.');
    }

    if (receipt.status === 'CANCELLED') {
      throw new BadRequestException('Receipt is already cancelled.');
    }

    const bankLedger = await this.paymentRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.paymentRepository.findLedgerByName('Maintenance Receivables');

    await this.db.transaction(async (tx) => {
      // 1. Update receipt status
      await tx
        .update(receipts)
        .set({ 
          status: 'CANCELLED', 
          cancellationReason: reason 
        })
        .where(eq(receipts.id, receiptId));

      // 2. Set invoice status back to unpaid
      await tx
        .update(maintenanceBills)
        .set({ status: 'UNPAID' })
        .where(eq(maintenanceBills.id, receipt.billId));

      // 3. Post reverse double-entry vouchers
      const voucherId = require('crypto').randomUUID();
      await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: `VOU-CANCEL-${receipt.receiptNumber}`,
        type: 'JOURNAL',
        date: new Date().toISOString().substring(0, 10),
        narration: `Payment Cancellation for Receipt ${receipt.receiptNumber}. Reason: ${reason}`,
      });

      // Debit Receivables Account
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: receivablesLedger.id,
        type: 'DEBIT',
        amount: receipt.amountPaid,
      });

      // Credit Bank Account
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: bankLedger.id,
        type: 'CREDIT',
        amount: receipt.amountPaid,
      });
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'PAYMENT_CANCEL_POST',
      entityName: 'receipts',
      entityId: receiptId,
      newValues: { receiptId, reason },
    });

    return { success: true };
  }

  /**
   * Triggers communication notifications checks (Mock email, SMS, WhatsApp triggers).
   */
  private async dispatchPaymentNotifications(receipt: any) {
    console.log(`[Notification Email] Payment confirmation receipt ${receipt.receiptNumber} dispatched to flat owner.`);
    console.log(`[Notification SMS] ₹${receipt.amountPaid} credited successfully toward maintenance.`);
    console.log(`[Notification WhatsApp] Receipt details confirmation card dispatched.`);
  }

  private async logAction(data: {
    societyId?: string;
    userId?: string;
    action: string;
    entityName: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
  }) {
    try {
      await this.db.insert(auditLogs).values({
        societyId: data.societyId || null,
        userId: data.userId || null,
        action: data.action,
        entityName: data.entityName,
        entityId: data.entityId || null,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
      });
    } catch (err) {
      console.error('Failed to log audit action:', err);
    }
  }
}
