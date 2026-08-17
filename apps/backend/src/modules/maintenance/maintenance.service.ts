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
  roles,
  parkingSlots
} from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

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
          isNull(flats.deletedAt)
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
      const sqftAreaType = currentConfig.sqftAreaType || 'SUPER_BUILTUP';
      const superBuiltupArea = Number(flat.sqftArea) || 1000;
      const carpetArea = Number(flat.carpetArea) > 0 ? Number(flat.carpetArea) : superBuiltupArea;
      const area = sqftAreaType === 'CARPET_AREA' ? carpetArea : superBuiltupArea;

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

      // Fetch parking slots allocated to this flat
      const flatParkingSlots = await this.db
        .select()
        .from(parkingSlots)
        .where(
          and(
            eq(parkingSlots.societyId, activeTenantId),
            eq(parkingSlots.flatId, flat.id)
          )
        );

      let openParkingTotal = 0;
      let stiltParkingTotal = 0;
      for (const slot of flatParkingSlots) {
        const explicitCharge = Number(slot.charges);
        const slotType = (slot.type || 'OPEN').toUpperCase();
        if (slotType === 'COVERED' || slotType === 'STILT') {
          stiltParkingTotal += explicitCharge > 0 ? explicitCharge : 500;
        } else {
          openParkingTotal += explicitCharge > 0 ? explicitCharge : 250;
        }
      }

      const parkingCharge = openParkingTotal + stiltParkingTotal;
      const parkingSlotsCount = flatParkingSlots.length;
      const waterCharge = 250;
      const sinkingCharge = 150;

      const variables = {
        area,
        super_builtup_area: superBuiltupArea,
        carpet_area: carpetArea,
        rate,
        base: baseAmount,
        parking: parkingCharge,
        parking_open: openParkingTotal,
        parking_stilt: stiltParkingTotal,
        parking_slots: parkingSlotsCount,
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

        if (parkingCharge > 0) {
          await tx.insert(billItems).values({
            id: require('crypto').randomUUID(),
            societyId: activeTenantId,
            billId: bill.id,
            headId: parkingHead.id,
            amount: parkingCharge.toFixed(2),
          });
        }

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

  async getSocietyDuesTransparency() {
    return this.maintenanceRepository.getSocietyDuesTransparency();
  }

  async findOne(id: string) {
    const details = await this.maintenanceRepository.findBillDetails(id);
    if (!details) {
      throw new NotFoundException('Maintenance bill invoice not found in this society.');
    }

    const config = await this.getConfig();
    const dueDateStr = details.dueDate ? String(details.dueDate).substring(0, 10) : null;
    const dueDateObj = dueDateStr ? new Date(dueDateStr) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueDays = 0;
    let isOverdue = false;
    let effectiveOverdueDays = 0;
    let calculatedLateFee = 0;

    if (dueDateObj && today > dueDateObj && details.status !== 'PAID') {
      isOverdue = true;
      overdueDays = Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 3600 * 24)));
      const gracePeriod = Number(config.penaltyGracePeriodDays) || 0;
      effectiveOverdueDays = Math.max(0, overdueDays - gracePeriod);

      const remainingPrincipal = Number(details.remainingBalance || details.amount || 0);

      if (effectiveOverdueDays > 0 && remainingPrincipal > 0) {
        if (config.penaltyType === 'PERCENTAGE') {
          const rate = Number(config.penaltyInterestRate) || 12;
          calculatedLateFee = Math.round((remainingPrincipal * (rate / 100) * (effectiveOverdueDays / 365)) * 100) / 100;
        } else if (config.penaltyType === 'FIXED_PER_MONTH') {
          const flatAmt = Number(config.penaltyFlatAmount) || 200;
          const months = Math.max(1, Math.ceil(effectiveOverdueDays / 30));
          calculatedLateFee = flatAmt * months;
        } else if (config.penaltyType === 'FIXED_ONE_TIME') {
          calculatedLateFee = Number(config.penaltyFlatAmount) || 200;
        } else {
          calculatedLateFee = 0;
        }
      }
    }

    return {
      ...details,
      isOverdue,
      overdueDays,
      effectiveOverdueDays,
      calculatedLateFee,
      totalPayableWithLateFee: (Number(details.remainingBalance || 0) + calculatedLateFee).toFixed(2),
      penaltySettings: {
        penaltyType: config.penaltyType,
        penaltyInterestRate: config.penaltyInterestRate,
        penaltyFlatAmount: config.penaltyFlatAmount,
        penaltyGracePeriodDays: config.penaltyGracePeriodDays,
      },
    };
  }

  /**
   * Records single or partial receipt payment with automated balance calculations, late fee settlement, and discounts.
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
    const lateFeeApplied = Number(dto.lateFeeApplied || 0);
    const lateFeeWaived = Number(dto.lateFeeWaived || 0);
    const discountAmount = Number(dto.discountAmount || 0);
    const discountReason = dto.discountReason || null;

    // Fetch existing receipts to compute total paid so far
    const existingReceipts = await this.db
      .select()
      .from(receipts)
      .where(eq(receipts.billId, dto.billId));

    const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0) - Number(r.lateFeeApplied || 0) + Number(r.discountAmount || 0), 0);
    
    // Amount from this payment that goes towards clearing the principal bill
    const principalClearedThisPayment = Math.max(0, payAmount - lateFeeApplied + discountAmount);
    const newTotalSettled = totalPaidSoFar + principalClearedThisPayment;
    const remainingBalance = Math.max(0, invoiceAmount - newTotalSettled);

    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (remainingBalance > 0.01) {
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

      // 2. Insert receipt with late fee and discount audit trail
      const receiptsList = await tx.insert(receipts).values({
        id: require('crypto').randomUUID(),
        societyId: activeTenantId,
        billId: dto.billId,
        receiptNumber: `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        amountPaid: payAmount.toFixed(2),
        lateFeeApplied: lateFeeApplied.toFixed(2),
        lateFeeWaived: lateFeeWaived.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        discountReason: discountReason,
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
          narration: `Maintenance Payment Receipt for Flat ID: ${bill.flatId}${discountAmount > 0 ? ` (Discount: ₹${discountAmount})` : ''}${lateFeeApplied > 0 ? ` (Late Fee: ₹${lateFeeApplied})` : ''}`,
        });

        // Debit Asset Account (Cash in Hand or Bank) for amount physically received
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: assetLedger.id,
          type: 'DEBIT',
          amount: payAmount.toFixed(2),
        });

        // Credit Receivables Account for principal portion cleared
        await tx.insert(transactions).values({
          id: require('crypto').randomUUID(),
          societyId: activeTenantId,
          voucherId,
          ledgerId: receivablesLedger.id,
          type: 'CREDIT',
          amount: principalClearedThisPayment.toFixed(2),
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
        sqftAreaType: 'SUPER_BUILTUP',
        flatRateSameForAll: '2500.00',
        flatTypes: ['1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse', 'Shop'],
        perFlatTypeRates: { '1BHK': 1500, '2BHK': 2500, '3BHK': 3500, '4BHK': 4500, 'Penthouse': 5500, 'Shop': 4000 },
        maintenanceFormula: '(area * rate) + parking + water',
        penaltyType: 'PERCENTAGE',
        penaltyInterestRate: '12.00',
        penaltyFlatAmount: '200.00',
        penaltyGracePeriodDays: 0,
      };
    }

    const s = settingList[0];
    let parsedFlatTypeRates: Record<string, number> = {};
    try {
      parsedFlatTypeRates = JSON.parse(s.perFlatTypeRates || '{}');
    } catch (e) {
      parsedFlatTypeRates = { '1BHK': 1500, '2BHK': 2500, '3BHK': 3500, '4BHK': 4500, 'Penthouse': 5500, 'Shop': 4000 };
    }

    let parsedFlatTypes: string[] = [];
    try {
      parsedFlatTypes = JSON.parse((s as any).flatTypes || '[]');
    } catch (e) {
      parsedFlatTypes = [];
    }

    if (!parsedFlatTypes || parsedFlatTypes.length === 0) {
      const keys = Object.keys(parsedFlatTypeRates);
      parsedFlatTypes = keys.length > 0 ? keys : ['1BHK', '2BHK', '3BHK', '4BHK', 'Penthouse', 'Shop'];
    }

    return {
      id: s.id,
      calculationType: s.calculationType || 'PER_SQ_FT',
      perSqFtRate: s.perSqFtRate || '3.50',
      sqftAreaType: (s as any).sqftAreaType || 'SUPER_BUILTUP',
      flatRateSameForAll: s.flatRateSameForAll || '2500.00',
      flatTypes: parsedFlatTypes,
      perFlatTypeRates: parsedFlatTypeRates,
      maintenanceFormula: s.maintenanceFormula,
      billingFrequency: s.billingFrequency,
      invoiceDueDays: s.invoiceDueDays,
      penaltyType: (s as any).penaltyType || 'PERCENTAGE',
      penaltyInterestRate: (s as any).penaltyInterestRate || '12.00',
      penaltyFlatAmount: (s as any).penaltyFlatAmount || '200.00',
      penaltyGracePeriodDays: (s as any).penaltyGracePeriodDays ?? 0,
    };
  }

  /**
   * Updates society maintenance calculation configuration mode and rates.
   */
  async updateConfig(dto: {
    calculationType?: string;
    perSqFtRate?: string | number;
    sqftAreaType?: string;
    flatRateSameForAll?: string | number;
    perFlatTypeRates?: Record<string, number> | string;
    flatTypes?: string[] | string;
    maintenanceFormula?: string;
    penaltyType?: string;
    penaltyInterestRate?: string | number;
    penaltyFlatAmount?: string | number;
    penaltyGracePeriodDays?: number;
  }) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];
    const settingList = await this.db.select().from(settings).where(eq(settings.societyId, activeTenantId));

    const flatTypeRatesStr = typeof dto.perFlatTypeRates === 'object'
      ? JSON.stringify(dto.perFlatTypeRates)
      : dto.perFlatTypeRates;

    const flatTypesStr = Array.isArray(dto.flatTypes)
      ? JSON.stringify(dto.flatTypes)
      : (typeof dto.flatTypes === 'string' ? dto.flatTypes : undefined);

    const payload: any = {
      updatedAt: new Date(),
    };
    if (dto.calculationType) payload.calculationType = dto.calculationType;
    if (dto.perSqFtRate !== undefined) payload.perSqFtRate = String(dto.perSqFtRate);
    if (dto.sqftAreaType !== undefined) payload.sqftAreaType = dto.sqftAreaType;
    if (dto.flatRateSameForAll !== undefined) payload.flatRateSameForAll = String(dto.flatRateSameForAll);
    if (flatTypeRatesStr !== undefined) payload.perFlatTypeRates = flatTypeRatesStr;
    if (flatTypesStr !== undefined) payload.flatTypes = flatTypesStr;
    if (dto.maintenanceFormula !== undefined) payload.maintenanceFormula = dto.maintenanceFormula;
    if (dto.penaltyType !== undefined) payload.penaltyType = dto.penaltyType;
    if (dto.penaltyInterestRate !== undefined) payload.penaltyInterestRate = String(dto.penaltyInterestRate);
    if (dto.penaltyFlatAmount !== undefined) payload.penaltyFlatAmount = String(dto.penaltyFlatAmount);
    if (dto.penaltyGracePeriodDays !== undefined) payload.penaltyGracePeriodDays = Number(dto.penaltyGracePeriodDays);

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
