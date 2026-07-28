import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { MaintenanceRepository } from './maintenance.repository';
import { GenerateBillsDto } from './dto/generate-bills.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { evaluateFormula } from './helpers/formula-parser';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  maintenanceBills, 
  billItems, 
  receipts, 
  flats, 
  settings, 
  vouchers, 
  transactions,
  flatOwners,
  owners,
  userSocieties,
  roles
} from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

import { NotificationService } from '../notification/notification.service';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly maintenanceRepository: MaintenanceRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Generates maintenance invoices for flats in the active society sweep.
   */
  async generateBills(dto: GenerateBillsDto, executorId?: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];


    // 1. Resolve active society maintenance formula settings
    const currentConfig = await this.getConfig();
    const calcType = currentConfig.calculationType;

    // 2. Fetch all active flats inside society scope
    let targetFlats = await this.db
      .select()
      .from(flats)
      .where(
        and(
          eq(flats.societyId, activeTenantId),
          eq(flats.deletedAt, null as any)
        )
      );

    if (dto.flatIds && dto.flatIds.length > 0) {
      targetFlats = targetFlats.filter((f) => dto.flatIds!.includes(f.id));
    }

    const generatedCount = targetFlats.length;
    const generatedBillsList = [];

    // Ledgers resolution for double-entry postings
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');
    const incomeLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Income');

    // Resolve head categories for itemized billing details
    const baseHead = await this.maintenanceRepository.findOrCreateHead('Base Maintenance');
    const parkingHead = await this.maintenanceRepository.findOrCreateHead('Parking Charges');
    const waterHead = await this.maintenanceRepository.findOrCreateHead('Water Charges');

    const formula = currentConfig.maintenanceFormula || '(area * rate) + parking + water';

    const generationType = dto.generationType || 'SINGLE';
    
    // Compute billing periods based on generation type
    let billingPeriods: { start: string, end: string }[] = [];
    
    if (generationType === 'PER_MONTH') {
      const start = new Date(dto.periodStart);
      const end = new Date(dto.periodEnd);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      
      while (current <= end) {
        const periodStart = new Date(Math.max(current.getTime(), start.getTime()));
        const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        const periodEnd = new Date(Math.min(nextMonth.getTime() - 1, end.getTime()));
        
        billingPeriods.push({
          start: periodStart.toISOString().substring(0, 10),
          end: periodEnd.toISOString().substring(0, 10),
        });
        current = nextMonth;
      }
    } else {
      billingPeriods.push({
        start: dto.periodStart,
        end: dto.periodEnd,
      });
    }

    for (const flat of targetFlats) {
      // 3. Resolve rate and base amount according to active calculation mode
      let rate = 3.5;
      let baseAmount = 0;
      const area = Number(flat.sqftArea) || 1000;

      if (calcType === 'PER_SQ_FT') {
        rate = Number(currentConfig.perSqFtRate) || 3.5;
        baseAmount = area * rate;
      } else if (calcType === 'PER_FLAT_TYPE') {
        const flatTypeRates: any = currentConfig.perFlatTypeRates || {};
        rate = Number(flatTypeRates[flat.flatType]) || Number(currentConfig.flatRateSameForAll) || 2500;
        baseAmount = rate;
      } else if (calcType === 'FLAT_RATE_SAME_FOR_ALL') {
        rate = Number(currentConfig.flatRateSameForAll) || 2500;
        baseAmount = rate;
      } else {
        rate = 3.5;
        baseAmount = area * rate;
      }

      const parkingCharge = 500;
      const waterCharge = 250;
      const sinkingCharge = 150;

      const variables = {
        area,
        rate,
        base: baseAmount,
        parking: parkingCharge,
        water: waterCharge,
        sinking: sinkingCharge,
      };

      // 4. Calculate total maintenance using algebraic formula evaluator
      let calculatedTotal = baseAmount + parkingCharge + waterCharge;
      try {
        calculatedTotal = evaluateFormula(formula, variables);
      } catch (e) {
        console.warn(`Formula evaluation fallback for Flat ${flat.number}:`, e);
      }

      for (const period of billingPeriods) {
        // Generate invoice coordinates
        const billNumber = `INV-${new Date().getFullYear()}-${flat.number}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 5. Write invoice transaction block
        await this.db.transaction(async (tx) => {
          const newBills = await tx.insert(maintenanceBills).values({
            societyId: activeTenantId,
            flatId: flat.id,
            billNumber,
            billingPeriodStart: period.start,
            billingPeriodEnd: period.end,
            dueDate: dto.dueDate,
            totalAmount: calculatedTotal.toString(),
            status: 'UNPAID',
          }).returning();

        const bill = newBills[0];

        // 6. Write detailed line items (bill_items breakdown)
        await tx.insert(billItems).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          billId: bill.id,
          headId: baseHead.id,
          amount: baseAmount.toFixed(2),
        });

        await tx.insert(billItems).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          billId: bill.id,
          headId: parkingHead.id,
          amount: parkingCharge.toFixed(2),
        });

        await tx.insert(billItems).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          billId: bill.id,
          headId: waterHead.id,
          amount: waterCharge.toFixed(2),
        });

        // 7. Post double-entry bookkeeping journal voucher
        const voucherId = require('crypto').randomUUID();
        await tx.insert(vouchers).values({
          id: voucherId,
          societyId: activeTenantId,
          voucherNumber: `VOU-${billNumber}`,
          type: 'JOURNAL',
          date: new Date().toISOString().substring(0, 10),
          narration: `Maintenance Invoice generation for Flat ${flat.number}`,
        });

        // Debit Receivables Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: receivablesLedger.id,
          type: 'DEBIT',
          amount: calculatedTotal.toString(),
        });
        // Credit Income Account
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: incomeLedger.id,
          type: 'CREDIT',
          amount: calculatedTotal.toString(),
        });

        generatedBillsList.push(bill);
      });
      } // End of billingPeriods loop

    }

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'BILL_SWEEP_GENERATE',
      entityName: 'maintenance_bills',
      newValues: { count: generatedCount },
    });

    // Dispatch real-time board notifications
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      '📊 Bulk Maintenance Bills Generated',
      `Batch billing sweep executed. Generated ${generatedCount} maintenance invoices for society flats for period ${dto.periodStart} to ${dto.periodEnd}.`
    );

    return {
      count: generatedCount,
    };
  }

  async findAll(filters: { search?: string; status?: string; mine?: boolean }, userId?: string) {
    return this.maintenanceRepository.searchBills({ ...filters, userId });
  }

  async findOne(id: string) {
    const details = await this.maintenanceRepository.findBillDetails(id);
    if (!details) {
      throw new NotFoundException('Maintenance bill invoice not found in this society.');
    }
    return details;
  }

  /**
   * Records single or partial receipt payment with automated balance calculations & reminders.
   */
  async recordPayment(dto: CreateReceiptDto, executorId?: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    let isResident = false;
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, activeTenantId)
          )
        );
      if (userRoleQuery.length > 0) {
        isResident = ['OWNER', 'TENANT'].includes(userRoleQuery[0].roleName);
      }
    }

    const bill = await this.maintenanceRepository.findById(dto.billId);
    if (!bill) {
      throw new NotFoundException('Bill invoice not found.');
    }

    if (bill.status === 'PAID') {
      throw new BadRequestException('Invoice is already fully paid.');
    }

    const payAmount = Number(dto.amountPaid);
    const invoiceAmount = Number(bill.totalAmount);

    // Fetch existing receipts to compute total paid so far
    const existingReceipts = await this.db
      .select()
      .from(receipts)
      .where(eq(receipts.billId, dto.billId));

    const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
    const newTotalPaid = totalPaidSoFar + payAmount;
    const remainingBalance = Math.max(0, invoiceAmount - newTotalPaid);

    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (newTotalPaid < invoiceAmount) {
      nextStatus = 'PARTIAL';
    }

    const assetLedger = dto.paymentMode === 'CASH'
      ? await this.maintenanceRepository.findLedgerByName('Cash in Hand Account')
      : await this.maintenanceRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');

    let receiptRecord: any = null;

    await this.db.transaction(async (tx) => {
      // 1. Update invoice status
      if (!isResident) {
        await tx
          .update(maintenanceBills)
          .set({ status: nextStatus })
          .where(eq(maintenanceBills.id, dto.billId));
      }

      // 2. Insert receipt
      const receiptsList = await tx.insert(receipts).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        billId: dto.billId,
        receiptNumber: `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        amountPaid: payAmount.toFixed(2),
        paymentMode: dto.paymentMode,
        referenceNumber: dto.transactionId || null,
        depositAccountId: dto.depositAccountId || null,
        paymentDate: dto.paymentDate,
        status: isResident ? 'REVIEW' : 'CLEARED',
      }).returning();

      receiptRecord = receiptsList[0];

      // 3. Post double-entry payment receipt voucher
        if (!isResident) {
          const voucherId = require('crypto').randomUUID();
      await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: `VOU-${receiptRecord.receiptNumber}`,
        type: 'RECEIPT',
        date: dto.paymentDate,
        narration: `Maintenance Payment Receipt for Flat ID: ${bill.flatId}`,
      });

      // Debit Asset Account (Cash in Hand or Bank)
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: assetLedger.id,
        type: 'DEBIT',
        amount: payAmount.toFixed(2),
      });

      // Credit Receivables Account
      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: receivablesLedger.id,
        type: 'CREDIT',
        amount: payAmount.toFixed(2),
        });
      }
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'PAYMENT_RECEIPT_CREATE',
      entityName: 'receipts',
      entityId: receiptRecord.id,
      newValues: receiptRecord,
    });

    // Send automated partial payment reminder notification if balance remains
    if (nextStatus === 'PARTIAL') {
      const flatResident = await this.db.query.flatOwners.findFirst({
        where: eq(flatOwners.flatId, bill.flatId),
      });
      if (flatResident?.ownerId) {
        const ownerUser = await this.db.query.owners.findFirst({
          where: eq(owners.id, flatResident.ownerId),
        });
        if (ownerUser?.userId) {
          await this.notificationService.createInAppNotification({
            societyId: activeTenantId,
            recipientUserId: ownerUser.userId,
            title: '⚠️ Partial Maintenance Payment Received',
            body: `Partial payment of ₹${payAmount} logged for Invoice ${bill.billNumber}. Remaining balance due: ₹${remainingBalance.toFixed(2)}. Please settle remaining dues at your earliest convenience.`,
          });
        }
      }
    }

    // Dispatch real-time board notifications
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      `💰 ${nextStatus === 'PAID' ? 'Full' : 'Partial'} Payment Receipt Recorded`,
      `Payment receipt ${receiptRecord.receiptNumber} of ₹${payAmount} (${dto.paymentMode}) recorded against Invoice ${bill.billNumber}. Remaining due: ₹${remainingBalance.toFixed(2)}.`
    );

    return {
      ...receiptRecord,
      remainingBalance: remainingBalance.toFixed(2),
      status: nextStatus,
    };
  }

  /**
   * Records a lump-sum payment across multiple selected invoices.
   */
  async recordBulkPayment(dto: {
    billIds: string[];
    amountPaid: number;
    paymentMode: 'CASH' | 'UPI' | 'NEFT' | 'CHEQUE' | 'CARD';
    transactionId?: string | null;
    depositAccountId?: string | null;
    paymentDate: string;
  }, executorId?: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    let isResident = false;
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, activeTenantId)
          )
        );
      if (userRoleQuery.length > 0) {
        isResident = ['OWNER', 'TENANT'].includes(userRoleQuery[0].roleName);
      }
    }


    if (dto.billIds.length === 0) {
      throw new BadRequestException('At least one bill invoice must be selected.');
    }

    let remainingLumpSum = Number(dto.amountPaid);
    const createdReceipts: any[] = [];
    const updatedBills: string[] = [];

    const assetLedger = dto.paymentMode === 'CASH'
      ? await this.maintenanceRepository.findLedgerByName('Cash in Hand Account')
      : await this.maintenanceRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');

    for (const billId of dto.billIds) {
      if (remainingLumpSum <= 0) break;

      const bill = await this.maintenanceRepository.findById(billId);
      if (!bill || bill.status === 'PAID') continue;

      const existingReceipts = await this.db
        .select()
        .from(receipts)
        .where(eq(receipts.billId, billId));

      const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
      const invoiceAmount = Number(bill.totalAmount);
      const billDue = Math.max(0, invoiceAmount - totalPaidSoFar);

      if (billDue <= 0) continue;

      const payThisBill = Math.min(remainingLumpSum, billDue);
      const newTotalPaid = totalPaidSoFar + payThisBill;
      const remainingForBill = Math.max(0, invoiceAmount - newTotalPaid);
      const nextStatus: 'PAID' | 'PARTIAL' = newTotalPaid >= invoiceAmount ? 'PAID' : 'PARTIAL';

      let receiptRecord: any = null;

      await this.db.transaction(async (tx) => {
        if (!isResident) {
          await tx
            .update(maintenanceBills)
            .set({ status: nextStatus })
            .where(eq(maintenanceBills.id, billId));
        }

        const receiptsList = await tx.insert(receipts).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          billId,
          receiptNumber: `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          amountPaid: payThisBill.toFixed(2),
          paymentMode: dto.paymentMode,
          referenceNumber: dto.transactionId || null,
          depositAccountId: dto.depositAccountId || null,
          paymentDate: dto.paymentDate,
          status: isResident ? 'REVIEW' : 'CLEARED',
        }).returning();

        receiptRecord = receiptsList[0];

        const voucherId = require('crypto').randomUUID();
        await tx.insert(vouchers).values({
          id: voucherId,
          societyId: activeTenantId,
          voucherNumber: `VOU-${receiptRecord.receiptNumber}`,
          type: 'RECEIPT',
          date: dto.paymentDate,
          narration: `Bulk Payment Receipt for Invoice: ${bill.billNumber}`,
        });

        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: assetLedger.id,
          type: 'DEBIT',
          amount: payThisBill.toFixed(2),
        });

        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: receivablesLedger.id,
          type: 'CREDIT',
          amount: payThisBill.toFixed(2),
        });
      });

      createdReceipts.push(receiptRecord);
      updatedBills.push(bill.billNumber);
      remainingLumpSum -= payThisBill;

      // Partial payment reminder trigger
      if (nextStatus === 'PARTIAL') {
        const flatResident = await this.db.query.flatOwners.findFirst({
          where: eq(flatOwners.flatId, bill.flatId),
        });
        if (flatResident?.ownerId) {
          const ownerUser = await this.db.query.owners.findFirst({
            where: eq(owners.id, flatResident.ownerId),
          });
          if (ownerUser?.userId) {
            await this.notificationService.createInAppNotification({
              societyId: activeTenantId,
              recipientUserId: ownerUser.userId,
              title: '⚠️ Partial Maintenance Payment Received',
              body: `Partial payment of ₹${payThisBill} logged for Invoice ${bill.billNumber}. Remaining balance due: ₹${remainingForBill.toFixed(2)}.`,
            });
          }
        }
      }
    }

    // Notify Board & Accountant
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      '💳 Multi-Invoice Bulk Payment Recorded',
      `Lump-sum payment of ₹${dto.amountPaid} (${dto.paymentMode}) applied across ${createdReceipts.length} invoices (${updatedBills.join(', ')}).`
    );

    return {
      receiptsCreated: createdReceipts.length,
      totalApplied: (dto.amountPaid - remainingLumpSum).toFixed(2),
      unappliedBalance: remainingLumpSum.toFixed(2),
      receipts: createdReceipts,
    };
  }

  /**
   * Resolves active society maintenance calculation settings.
   */
  async getConfig() {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];
    const settingList = await this.db.select().from(settings).where(eq(settings.societyId, activeTenantId));
    
    if (settingList.length === 0) {
      return {
        calculationType: 'PER_SQ_FT',
        perSqFtRate: '3.50',
        flatRateSameForAll: '2500.00',
        perFlatTypeRates: { "1BHK": 1500, "2BHK": 2500, "3BHK": 3500, "Shop": 4000 },
        maintenanceFormula: '(area * rate) + parking + water',
      };
    }

    const s = settingList[0];
    let parsedFlatTypeRates = {};
    try {
      parsedFlatTypeRates = JSON.parse(s.perFlatTypeRates || '{}');
    } catch (e) {
      parsedFlatTypeRates = { "1BHK": 1500, "2BHK": 2500, "3BHK": 3500, "Shop": 4000 };
    }

    return {
      id: s.id,
      calculationType: s.calculationType || 'PER_SQ_FT',
      perSqFtRate: s.perSqFtRate || '3.50',
      flatRateSameForAll: s.flatRateSameForAll || '2500.00',
      perFlatTypeRates: parsedFlatTypeRates,
      maintenanceFormula: s.maintenanceFormula,
      billingFrequency: s.billingFrequency,
      invoiceDueDays: s.invoiceDueDays,
    };
  }

  /**
   * Updates society maintenance calculation configuration mode and rates.
   */
  async updateConfig(dto: {
    calculationType?: string;
    perSqFtRate?: string | number;
    flatRateSameForAll?: string | number;
    perFlatTypeRates?: Record<string, number> | string;
    maintenanceFormula?: string;
  }) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];
    const settingList = await this.db.select().from(settings).where(eq(settings.societyId, activeTenantId));

    const flatTypeRatesStr = typeof dto.perFlatTypeRates === 'object'
      ? JSON.stringify(dto.perFlatTypeRates)
      : dto.perFlatTypeRates;

    const payload: any = {
      updatedAt: new Date(),
    };
    if (dto.calculationType) payload.calculationType = dto.calculationType;
    if (dto.perSqFtRate !== undefined) payload.perSqFtRate = String(dto.perSqFtRate);
    if (dto.flatRateSameForAll !== undefined) payload.flatRateSameForAll = String(dto.flatRateSameForAll);
    if (flatTypeRatesStr !== undefined) payload.perFlatTypeRates = flatTypeRatesStr;
    if (dto.maintenanceFormula !== undefined) payload.maintenanceFormula = dto.maintenanceFormula;

    if (settingList.length === 0) {
      await this.db.insert(settings).values({
        societyId: activeTenantId,
        ...payload,
      });
    } else {
      await this.db.update(settings).set(payload).where(eq(settings.societyId, activeTenantId));
    }

    return this.getConfig();
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

  async approvePayment(receiptId: string, approverId: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    const receipt = await this.db.query.receipts.findFirst({
      where: and(eq(receipts.id, receiptId), eq(receipts.societyId, activeTenantId)),
    });

    if (!receipt) throw new NotFoundException('Receipt not found.');
    if (receipt.status !== 'REVIEW') throw new BadRequestException('Receipt is not pending review.');

    const bill = await this.maintenanceRepository.findById(receipt.billId);
    if (!bill) throw new NotFoundException('Invoice not found for this receipt.');

    const invoiceAmount = Number(bill.totalAmount);
    const existingReceipts = await this.db
      .select()
      .from(receipts)
      .where(and(eq(receipts.billId, receipt.billId), eq(receipts.status, 'CLEARED')));
    const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
    const newTotalPaid = totalPaidSoFar + Number(receipt.amountPaid);
    
    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (newTotalPaid < invoiceAmount) {
      nextStatus = 'PARTIAL';
    }

    const assetLedger = receipt.paymentMode === 'CASH'
      ? await this.maintenanceRepository.findLedgerByName('Cash in Hand Account')
      : await this.maintenanceRepository.findLedgerByName('Bank Account SBI');
    const receivablesLedger = await this.maintenanceRepository.findLedgerByName('Maintenance Receivables');

    await this.db.transaction(async (tx) => {
      // Approve receipt
      await tx
        .update(receipts)
        .set({ status: 'CLEARED', approvedBy: approverId, rejectionReason: null })
        .where(eq(receipts.id, receiptId));

      // Update bill
      await tx
        .update(maintenanceBills)
        .set({ status: nextStatus })
        .where(eq(maintenanceBills.id, bill.id));

      // Post ledgers
      const voucherId = require('crypto').randomUUID();
      await tx.insert(vouchers).values({
        id: voucherId,
        societyId: activeTenantId,
        voucherNumber: `VOU-${receipt.receiptNumber}`,
        type: 'RECEIPT',
        date: receipt.paymentDate,
        narration: `Approved Maintenance Payment Receipt for Flat ID: ${bill.flatId}`,
      });

      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: assetLedger.id,
        type: 'DEBIT',
        amount: Number(receipt.amountPaid).toFixed(2),
      });

      await tx.insert(transactions).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        voucherId,
        ledgerId: receivablesLedger.id,
        type: 'CREDIT',
        amount: Number(receipt.amountPaid).toFixed(2),
      });
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: approverId,
      action: 'PAYMENT_RECEIPT_APPROVED',
      entityName: 'receipts',
      entityId: receipt.id,
      newValues: { amount: receipt.amountPaid, status: 'CLEARED' },
    });

    return { message: 'Payment approved successfully.' };
  }

  async rejectPayment(receiptId: string, reason: string, rejectorId: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    const receipt = await this.db.query.receipts.findFirst({
      where: and(eq(receipts.id, receiptId), eq(receipts.societyId, activeTenantId)),
    });

    if (!receipt) throw new NotFoundException('Receipt not found.');
    if (receipt.status !== 'REVIEW') throw new BadRequestException('Receipt is not pending review.');

    await this.db.transaction(async (tx) => {
      await tx
        .update(receipts)
        .set({ status: 'REJECTED', rejectionReason: reason })
        .where(eq(receipts.id, receiptId));
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: rejectorId,
      action: 'PAYMENT_RECEIPT_REJECTED',
      entityName: 'receipts',
      entityId: receipt.id,
      newValues: { reason },
    });

    return { message: 'Payment rejected.' };
  }
}
