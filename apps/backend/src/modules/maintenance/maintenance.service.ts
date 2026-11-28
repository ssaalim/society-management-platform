import { LedgerResolver } from '@core/accounting/ledger-resolver.service';
import { Injectable, NotFoundException, Inject, BadRequestException, ConflictException } from '@nestjs/common';
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
  parkingSlots,
  floors,
  wings,
  buildings,
  users,
} from '../../../database/schema';
import { eq, and, isNull, inArray, lte, gte, sql } from 'drizzle-orm';

import { NotificationService } from '../notification/notification.service';
import { BillingCategoryService } from './billing-category.service';

/** People who live in flats; what they report as paid waits for the office to approve it. */
const RESIDENT_ROLES = ['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'];

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly maintenanceRepository: MaintenanceRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
    private readonly billingCategoryService: BillingCategoryService,
    private readonly ledgerResolver: LedgerResolver,
  ) {}

  /**
   * Generates maintenance invoices for flats in the active society sweep.
   */
  /** Number of calendar months a billing period spans (a bill for Apr–Jun covers 3 months). */
  private monthsCovered(start: string, end: string): number {
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    return Math.max(1, (ey * 12 + em) - (sy * 12 + sm) + 1);
  }

  /** The bills a generation run would create: one plan for both the preview and the real run. */
  private async planBills(dto: GenerateBillsDto) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];

    // 1. Resolve active society maintenance formula settings
    const currentConfig = await this.getConfig();
    const calcType = currentConfig.calculationType;
    const formula = currentConfig.maintenanceFormula || '(area * rate) + parking + water';

    // 2. Active flats in this society, with their place and current owner for the preview and export
    let targetFlats = await this.db
      .select({
        flat: flats,
        floorNumber: floors.number,
        wingName: wings.name,
        buildingName: buildings.name,
      })
      .from(flats)
      .innerJoin(floors, eq(flats.floorId, floors.id))
      .innerJoin(wings, eq(floors.wingId, wings.id))
      .innerJoin(buildings, eq(wings.buildingId, buildings.id))
      .where(and(eq(flats.societyId, activeTenantId), isNull(flats.deletedAt)));

    if (dto.flatIds && dto.flatIds.length > 0) {
      targetFlats = targetFlats.filter((f) => dto.flatIds!.includes(f.flat.id));
    }
    targetFlats.sort((a, b) =>
      `${a.buildingName}|${a.wingName}|${a.flat.number}`.localeCompare(`${b.buildingName}|${b.wingName}|${b.flat.number}`, undefined, { numeric: true }),
    );
    // Billing category per unit, and the "commercial only" / "residential only" filter
    const categories = await this.billingCategoryService.list();
    const categoryByFlat = new Map(targetFlats.map((f) => [f.flat.id, this.billingCategoryService.resolve(categories, f.flat)]));
    if (dto.usage && dto.usage !== 'ALL') {
      targetFlats = targetFlats.filter((f) => categoryByFlat.get(f.flat.id)!.usage === dto.usage);
    }
    const flatIds = targetFlats.map((f) => f.flat.id);

    const ownerRows = flatIds.length
      ? await this.db
          .select({ flatId: flatOwners.flatId, name: users.name })
          .from(flatOwners)
          .innerJoin(owners, eq(flatOwners.ownerId, owners.id))
          .innerJoin(users, eq(owners.userId, users.id))
          .where(and(inArray(flatOwners.flatId, flatIds), eq(flatOwners.isCurrent, true), eq(owners.societyId, activeTenantId)))
      : [];
    const ownerByFlat = new Map<string, string>();
    for (const o of ownerRows) if (!ownerByFlat.has(o.flatId)) ownerByFlat.set(o.flatId, o.name || '');

    // 3. Billing periods
    const generationType = dto.generationType || 'SINGLE';
    const billingPeriods: { start: string; end: string; months: number }[] = [];
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
          months: 1,
        });
        current = nextMonth;
      }
    } else {
      billingPeriods.push({ start: dto.periodStart, end: dto.periodEnd, months: this.monthsCovered(dto.periodStart, dto.periodEnd) });
    }

    // 4. Overlap check: any existing bill for these flats that touches any month in the selected range
    const existing = flatIds.length
      ? await this.db
          .select({
            flatId: maintenanceBills.flatId,
            billNumber: maintenanceBills.billNumber,
            start: maintenanceBills.billingPeriodStart,
            end: maintenanceBills.billingPeriodEnd,
            status: maintenanceBills.status,
          })
          .from(maintenanceBills)
          .where(
            and(
              eq(maintenanceBills.societyId, activeTenantId),
              inArray(maintenanceBills.flatId, flatIds),
              lte(maintenanceBills.billingPeriodStart, dto.periodEnd),
              gte(maintenanceBills.billingPeriodEnd, dto.periodStart),
            ),
          )
      : [];
    const conflictsByFlat = new Map<string, { billNumber: string; start: string; end: string; status: string }[]>();
    for (const e of existing) {
      const list = conflictsByFlat.get(e.flatId) || [];
      list.push({ billNumber: e.billNumber, start: String(e.start), end: String(e.end), status: e.status });
      conflictsByFlat.set(e.flatId, list);
    }

    // 5. Monthly charge lines per unit (by its billing category), then per bill: lines x months, plus GST
    const round = (n: number) => Math.round(n * 100) / 100;
    const rows = [];
    for (const { flat, floorNumber, wingName, buildingName } of targetFlats) {
      const category = categoryByFlat.get(flat.id)!;
      const monthlyLines: { head: string; amount: number }[] = [];
      let rateApplied: number | null = null;

      if (category.calculationType === 'SOCIETY_FORMULA') {
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

        const variables: Record<string, number> = {
          area,
          sqft: area,
          sq_ft: area,
          sqfeet: area,
          sq_feet: area,
          sqft_area: area,
          super_builtup_area: superBuiltupArea,
          super_built_up_area: superBuiltupArea,
          builtup_area: superBuiltupArea,
          built_up_area: superBuiltupArea,
          carpet_area: carpetArea,
          carpet: carpetArea,
          rera_carpet_area: carpetArea,
          rate,
          per_sqft_rate: rate,
          base_rate: rate,
          base: baseAmount,
          base_amount: baseAmount,
          parking: parkingCharge,
          parking_open: openParkingTotal,
          open_parking: openParkingTotal,
          parking_stilt: stiltParkingTotal,
          stilt_parking: stiltParkingTotal,
          parking_slots: parkingSlotsCount,
          water: waterCharge,
          water_charge: waterCharge,
          sinking: sinkingCharge,
          sinking_fund: sinkingCharge,
          repair: 200,
          repairs: 200,
          repair_fund: 200,
          elevator: 150,
          lift: 150,
          security: 300,
          gym: 100,
          clubhouse: 100,
        };

        // 4. Calculate total maintenance using algebraic formula evaluator
        let calculatedTotal = baseAmount + parkingCharge + waterCharge;
        try {
          calculatedTotal = evaluateFormula(formula, variables);
        } catch (e) {
          console.warn(`Formula evaluation fallback for Flat ${flat.number}:`, e);
        }


        // Line items add up to the formula total: anything the formula adds beyond base, parking and water
        // (sinking fund, lift, repairs ...) becomes "Other charges".
        rateApplied = rate;
        monthlyLines.push({ head: 'Base Maintenance', amount: round(baseAmount) });
        if (parkingCharge > 0) monthlyLines.push({ head: 'Parking Charges', amount: round(parkingCharge) });
        monthlyLines.push({ head: 'Water Charges', amount: round(waterCharge) });
        const other = round(calculatedTotal - baseAmount - parkingCharge - waterCharge);
        if (Math.abs(other) >= 0.01) monthlyLines.push({ head: 'Other Charges', amount: other });
      } else {
        // Category rates: per sq ft or fixed, by floor, plus the category's own extras and (optionally) parking
        const slots = await this.db
          .select()
          .from(parkingSlots)
          .where(and(eq(parkingSlots.societyId, activeTenantId), eq(parkingSlots.flatId, flat.id)));
        const parking = slots.reduce((sum, slot) => {
          const explicit = Number(slot.charges);
          const covered = ['COVERED', 'STILT'].includes((slot.type || 'OPEN').toUpperCase());
          return sum + (explicit > 0 ? explicit : covered ? 500 : 250);
        }, 0);
        const superBuiltupArea = Number(flat.sqftArea) || 0;
        const carpetArea = Number(flat.carpetArea) > 0 ? Number(flat.carpetArea) : superBuiltupArea;
        const charges = this.billingCategoryService.monthlyCharges(category, { superBuiltupArea, carpetArea, floorNumber, parking });
        rateApplied = charges.rateApplied;
        monthlyLines.push({ head: `${category.name} Maintenance`, amount: charges.base });
        for (const [name, amount] of Object.entries(charges.extras)) monthlyLines.push({ head: name, amount });
        if (charges.parking > 0) monthlyLines.push({ head: 'Parking Charges', amount: round(charges.parking) });
      }

      const monthlySubtotal = round(monthlyLines.reduce((sum, l) => sum + l.amount, 0));
      const bills = billingPeriods.map((p) => {
        const lines = monthlyLines.map((l) => ({ head: l.head, amount: round(l.amount * p.months) }));
        const subtotal = round(lines.reduce((sum, l) => sum + l.amount, 0));
        const gst = this.billingCategoryService.gstFor(category, subtotal, p.months);
        return {
          start: p.start,
          end: p.end,
          months: p.months,
          lines,
          subtotal,
          gstRate: gst?.rate ?? null,
          gstAmount: gst?.amount ?? 0,
          amount: round(subtotal + (gst?.amount ?? 0)),
        };
      });

      rows.push({
        flatId: flat.id,
        flatNumber: flat.number,
        flatType: flat.flatType,
        floorNumber,
        wingName,
        buildingName,
        ownerName: ownerByFlat.get(flat.id) || null,
        category: { id: category.id, name: category.name, usage: category.usage, invoicePrefix: category.invoicePrefix },
        rateApplied,
        monthly: { lines: monthlyLines, total: monthlySubtotal },
        bills,
        subtotal: round(bills.reduce((sum, b) => sum + b.subtotal, 0)),
        gstAmount: round(bills.reduce((sum, b) => sum + b.gstAmount, 0)),
        total: round(bills.reduce((sum, b) => sum + b.amount, 0)),
        conflicts: conflictsByFlat.get(flat.id) || [],
      });
    }

    return {
      activeTenantId,
      periods: billingPeriods,
      dueDate: dto.dueDate,
      penaltyFromDate: dto.penaltyFromDate || null,
      rows,
    };
  }

  /** Dry run: what generation would create, with conflicts, without writing anything. */
  async previewBills(dto: GenerateBillsDto) {
    const plan = await this.planBills(dto);
    const conflicting = plan.rows.filter((r) => r.conflicts.length > 0);
    const billable = plan.rows.filter((r) => r.conflicts.length === 0);
    return {
      periods: plan.periods,
      dueDate: plan.dueDate,
      penaltyFromDate: plan.penaltyFromDate,
      rows: plan.rows,
      summary: {
        flats: plan.rows.length,
        conflictingFlats: conflicting.length,
        billableFlats: billable.length,
        billsToCreate: billable.reduce((n, r) => n + r.bills.length, 0),
        totalAmount: Math.round(billable.reduce((sum, r) => sum + r.total, 0) * 100) / 100,
        gstAmount: Math.round(billable.reduce((sum, r) => sum + r.gstAmount, 0) * 100) / 100,
      },
    };
  }

  async generateBills(dto: GenerateBillsDto, executorId?: string) {
    const plan = await this.planBills(dto);
    const activeTenantId = plan.activeTenantId;

    // Never bill a month twice. Without skipConflicts the whole run is refused and the conflicts are listed.
    const conflicting = plan.rows.filter((r) => r.conflicts.length > 0);
    if (conflicting.length > 0 && !dto.skipConflicts) {
      throw new ConflictException({
        message: `${conflicting.length} flat(s) already have bills for part of ${dto.periodStart} to ${dto.periodEnd}. Preview the run to see them, or choose to skip those flats.`,
        conflicts: conflicting.map((r) => ({ flatNumber: r.flatNumber, wingName: r.wingName, bills: r.conflicts })),
      });
    }
    const toBill = plan.rows.filter((r) => r.conflicts.length === 0);
    if (toBill.length === 0) {
      throw new BadRequestException('No flats left to bill for this period.');
    }

    // Ledgers resolution for double-entry postings
    const receivablesLedger = await this.ledgerResolver.system('RECEIVABLES');
    const incomeLedger = await this.ledgerResolver.system('MAINTENANCE_INCOME');

    const gstLedger = toBill.some((r) => r.gstAmount > 0) ? await this.ledgerResolver.system('GST_OUTPUT') : null;

    // Charge heads (line item names) are created on first use
    const headIds = new Map<string, string>();
    const headId = async (name: string) => {
      if (!headIds.has(name)) headIds.set(name, (await this.maintenanceRepository.findOrCreateHead(name)).id);
      return headIds.get(name)!;
    };
    for (const row of toBill) for (const b of row.bills) {
      for (const l of b.lines) await headId(l.head);
      if (b.gstAmount > 0) await headId(`GST @ ${b.gstRate}%`);
    }

    const batchId = require('crypto').randomUUID();
    const year = new Date().getFullYear();
    let billsCreated = 0;
    const billNumbersByFlat = new Map<string, string[]>();

    // One transaction for the whole run: either every bill is created or none is.
    await this.db.transaction(async (tx) => {
      for (const row of toBill) {
        const numbers: string[] = [];
        billNumbersByFlat.set(row.flatId, numbers);
        for (const b of row.bills) {
          const billNumber = `${row.category.invoicePrefix || 'INV'}-${year}-${row.flatNumber}-${Math.floor(1000 + Math.random() * 9000)}`;
          const [bill] = await tx.insert(maintenanceBills).values({
            societyId: activeTenantId,
            flatId: row.flatId,
            billNumber,
            billingPeriodStart: b.start,
            billingPeriodEnd: b.end,
            dueDate: dto.dueDate,
            totalAmount: b.amount.toFixed(2),
            subtotalAmount: b.subtotal.toFixed(2),
            gstRate: b.gstRate === null ? null : b.gstRate.toFixed(2),
            gstAmount: b.gstAmount > 0 ? b.gstAmount.toFixed(2) : null,
            billingCategoryId: row.category.id,
            status: 'UNPAID',
            penaltyFromDate: dto.penaltyFromDate || null,
            generationBatchId: batchId,
          }).returning();
          numbers.push(billNumber);
          billsCreated++;

          // Line items: one per charge (already multiplied by the months in this bill), then GST
          for (const l of b.lines) {
            if (l.amount === 0) continue;
            await tx.insert(billItems).values({ id: require('crypto').randomUUID(), societyId: activeTenantId, billId: bill.id, headId: headIds.get(l.head)!, amount: l.amount.toFixed(2) });
          }
          if (b.gstAmount > 0) {
            await tx.insert(billItems).values({ id: require('crypto').randomUUID(), societyId: activeTenantId, billId: bill.id, headId: headIds.get(`GST @ ${b.gstRate}%`)!, amount: b.gstAmount.toFixed(2) });
          }

          // Double-entry journal: debit receivables (total); credit income (subtotal) and GST payable (tax)
          const voucherId = require('crypto').randomUUID();
          await tx.insert(vouchers).values({
            id: voucherId,
            societyId: activeTenantId,
            voucherNumber: `VOU-${billNumber}`,
            type: 'JOURNAL',
            date: new Date().toISOString().substring(0, 10),
            narration: `Maintenance Invoice generation for Flat ${row.flatNumber}${b.gstAmount > 0 ? ` (incl. GST ₹${b.gstAmount.toFixed(2)})` : ''}`,
          });
          await tx.insert(transactions).values({ id: require('crypto').randomUUID(), societyId: activeTenantId, voucherId, ledgerId: receivablesLedger.id, type: 'DEBIT', amount: b.amount.toFixed(2) });
          await tx.insert(transactions).values({ id: require('crypto').randomUUID(), societyId: activeTenantId, voucherId, ledgerId: incomeLedger.id, type: 'CREDIT', amount: b.subtotal.toFixed(2) });
          if (b.gstAmount > 0 && gstLedger) {
            await tx.insert(transactions).values({ id: require('crypto').randomUUID(), societyId: activeTenantId, voucherId, ledgerId: gstLedger.id, type: 'CREDIT', amount: b.gstAmount.toFixed(2) });
          }
        }
      }
    });

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'BILL_SWEEP_GENERATE',
      entityName: 'maintenance_bills',
      newValues: { batchId, flats: toBill.length, bills: billsCreated, skippedFlats: conflicting.length },
    });

    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      '📊 Bulk Maintenance Bills Generated',
      `Batch billing sweep executed. Generated ${billsCreated} maintenance invoices for ${toBill.length} flats for period ${dto.periodStart} to ${dto.periodEnd}.`
    );

    return {
      count: toBill.length,
      billsCreated,
      skippedFlats: conflicting.map((r) => ({ flatNumber: r.flatNumber, wingName: r.wingName })),
      batchId,
      periods: plan.periods,
      dueDate: dto.dueDate,
      penaltyFromDate: dto.penaltyFromDate || null,
      // One row per flat, for the optional Excel / CSV download
      rows: toBill.map((r) => {
        const totals = new Map<string, number>();
        for (const b of r.bills) for (const l of b.lines) totals.set(l.head, Math.round(((totals.get(l.head) || 0) + l.amount) * 100) / 100);
        return {
          flatNumber: r.flatNumber,
          flatType: r.flatType,
          wingName: r.wingName,
          buildingName: r.buildingName,
          floorNumber: r.floorNumber,
          ownerName: r.ownerName,
          category: r.category.name,
          usage: r.category.usage,
          rateApplied: r.rateApplied,
          billNumbers: billNumbersByFlat.get(r.flatId) || [],
          months: r.bills.reduce((n, b) => n + b.months, 0),
          charges: Object.fromEntries(totals),
          subtotal: r.subtotal,
          gstAmount: r.gstAmount,
          total: r.total,
        };
      }),
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

    const societyConfig = await this.getConfig();
    // Late-fee rules: the bill's billing category may have its own (e.g. commercial units); unset fields fall back
    // to the society settings.
    let billCategory: any = null;
    if ((details as any).billingCategoryId) {
      billCategory = await this.billingCategoryService.get((details as any).billingCategoryId).catch(() => null);
    }
    const config = {
      ...societyConfig,
      penaltyType: billCategory?.penaltyType ?? societyConfig.penaltyType,
      penaltyInterestRate: billCategory?.penaltyInterestRate ?? societyConfig.penaltyInterestRate,
      penaltyFlatAmount: billCategory?.penaltyFlatAmount ?? societyConfig.penaltyFlatAmount,
      penaltyGracePeriodDays: billCategory?.penaltyGracePeriodDays ?? societyConfig.penaltyGracePeriodDays,
    };
    const dueDateStr = details.dueDate ? String(details.dueDate).substring(0, 10) : null;
    const dueDateObj = dueDateStr ? new Date(dueDateStr) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueDays = 0;
    let isOverdue = false;
    let effectiveOverdueDays = 0;
    let calculatedLateFee = 0;

    // A bill can carry its own penalty start date (set at generation, e.g. for advance quarterly bills).
    // Late fees then accrue from that date; otherwise from the due date plus the society's grace period.
    const penaltyFromStr = (details as any).penaltyFromDate ? String((details as any).penaltyFromDate).substring(0, 10) : null;
    const penaltyFromObj = penaltyFromStr ? new Date(penaltyFromStr) : null;

    if (dueDateObj && today > dueDateObj && details.status !== 'PAID') {
      isOverdue = true;
      overdueDays = Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 3600 * 24)));
      if (penaltyFromObj) {
        effectiveOverdueDays = today >= penaltyFromObj
          ? Math.floor((today.getTime() - penaltyFromObj.getTime()) / (1000 * 3600 * 24)) + 1
          : 0;
      } else {
        const gracePeriod = Number(config.penaltyGracePeriodDays) || 0;
        effectiveOverdueDays = Math.max(0, overdueDays - gracePeriod);
      }

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
      penaltyFromDate: penaltyFromStr,
      billingCategory: billCategory ? { id: billCategory.id, name: billCategory.name, usage: billCategory.usage } : null,
      penaltySettings: {
        source: billCategory && billCategory.penaltyType ? 'category' : 'society',
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
        isResident = RESIDENT_ROLES.includes(userRoleQuery[0].roleName);
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
    // Only money the office has cleared counts; a resident's own report (REVIEW) or a rejected one does not.
    const existingReceipts = await this.db
      .select()
      .from(receipts)
      .where(and(eq(receipts.billId, dto.billId), eq(receipts.status, 'CLEARED')));

    const totalPaidSoFar = existingReceipts.reduce((sum, r) => sum + Number(r.amountPaid || 0) - Number(r.lateFeeApplied || 0) + Number(r.discountAmount || 0), 0);
    
    // Amount from this payment that goes towards clearing the principal bill
    const principalClearedThisPayment = Math.max(0, payAmount - lateFeeApplied + discountAmount);
    const newTotalSettled = totalPaidSoFar + principalClearedThisPayment;
    const remainingBalance = Math.max(0, invoiceAmount - newTotalSettled);

    let nextStatus: 'PAID' | 'PARTIAL' = 'PAID';
    if (remainingBalance > 0.01) {
      nextStatus = 'PARTIAL';
    }

    // Cash, or the bank account the money was deposited in (the default one if none was picked).
    const assetLedger = await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.depositAccountId });
    const receivablesLedger = await this.ledgerResolver.system('RECEIVABLES');

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
        depositAccountId: assetLedger.bankAccountId,
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

    // A resident's report is not money received yet: ask the office to check it, and say nothing about "recorded".
    if (isResident) {
      await this.notificationService.notifyRoles(
        ['TREASURER', 'ACCOUNTANT', 'SECRETARY'],
        'Payment to approve',
        `₹${payAmount} reported paid by ${dto.paymentMode}${dto.transactionId ? ` (ref ${dto.transactionId})` : ''} for invoice ${bill.billNumber}. Check it against the bank statement, then approve or reject it.`,
      );
      return { ...receiptRecord, remainingBalance: Math.max(0, invoiceAmount - totalPaidSoFar).toFixed(2), status: 'REVIEW' };
    }

    // Send automated partial payment reminder notification if balance remains
    if (nextStatus === 'PARTIAL') {
      const flatResident = await this.db.query.flatOwners.findFirst({
        where: eq(flatOwners.flatId, bill.flatId),
      });
      if (flatResident?.ownerId) {
        const ownerUser = await this.db.query.owners.findFirst({
          where: and(eq(owners.id, flatResident.ownerId), eq(owners.societyId, activeTenantId)),
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
        isResident = RESIDENT_ROLES.includes(userRoleQuery[0].roleName);
      }
    }


    if (dto.billIds.length === 0) {
      throw new BadRequestException('At least one bill invoice must be selected.');
    }

    let remainingLumpSum = Number(dto.amountPaid);
    const createdReceipts: any[] = [];
    const updatedBills: string[] = [];

    // Cash, or the bank account the money was deposited in (the default one if none was picked).
    const assetLedger = await this.ledgerResolver.money({ mode: dto.paymentMode, bankAccountId: dto.depositAccountId });
    const receivablesLedger = await this.ledgerResolver.system('RECEIVABLES');

    for (const billId of dto.billIds) {
      if (remainingLumpSum <= 0) break;

      const bill = await this.maintenanceRepository.findById(billId);
      if (!bill || bill.status === 'PAID') continue;

      const existingReceipts = await this.db
        .select()
        .from(receipts)
        .where(and(eq(receipts.billId, billId), eq(receipts.status, 'CLEARED')));

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
          depositAccountId: assetLedger.bankAccountId,
          paymentDate: dto.paymentDate,
          status: isResident ? 'REVIEW' : 'CLEARED',
        }).returning();

        receiptRecord = receiptsList[0];
        // A resident's report is posted to the books only when the office approves it.
        if (isResident) return;

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

      // Partial payment reminder trigger (not for a resident's own, unapproved report)
      if (nextStatus === 'PARTIAL' && !isResident) {
        const flatResident = await this.db.query.flatOwners.findFirst({
          where: eq(flatOwners.flatId, bill.flatId),
        });
        if (flatResident?.ownerId) {
          const ownerUser = await this.db.query.owners.findFirst({
            where: and(eq(owners.id, flatResident.ownerId), eq(owners.societyId, activeTenantId)),
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

    if (isResident) {
      await this.notificationService.notifyRoles(
        ['TREASURER', 'ACCOUNTANT', 'SECRETARY'],
        'Payment to approve',
        `₹${dto.amountPaid} reported paid by ${dto.paymentMode}${dto.transactionId ? ` (ref ${dto.transactionId})` : ''} across ${createdReceipts.length} invoices (${updatedBills.join(', ')}). Check it, then approve or reject each receipt.`,
      );
      return {
        receiptsCreated: createdReceipts.length,
        totalApplied: (dto.amountPaid - remainingLumpSum).toFixed(2),
        unappliedBalance: remainingLumpSum.toFixed(2),
        receipts: createdReceipts,
        status: 'REVIEW',
      };
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

    const assetLedger = await this.ledgerResolver.money({ mode: receipt.paymentMode, bankAccountId: receipt.depositAccountId });
    const receivablesLedger = await this.ledgerResolver.system('RECEIVABLES');

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

    const remaining = Math.max(0, invoiceAmount - newTotalPaid);
    await this.tellFlat(
      bill.flatId,
      'Payment confirmed',
      `₹${Number(receipt.amountPaid)} for invoice ${bill.billNumber} is confirmed (receipt ${receipt.receiptNumber}).${remaining > 0.01 ? ` ₹${remaining.toFixed(2)} is still due.` : ' Thank you!'}`,
    );
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      `💰 ${nextStatus === 'PAID' ? 'Full' : 'Partial'} Payment Receipt Recorded`,
      `Payment receipt ${receipt.receiptNumber} of ₹${Number(receipt.amountPaid)} (${receipt.paymentMode}) approved against invoice ${bill.billNumber}. Remaining due: ₹${remaining.toFixed(2)}.`,
    );

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

    const bill = await this.maintenanceRepository.findById(receipt.billId);
    if (bill) {
      await this.tellFlat(
        bill.flatId,
        'Payment not confirmed',
        `The ₹${Number(receipt.amountPaid)} you reported for invoice ${bill.billNumber}${receipt.referenceNumber ? ` (ref ${receipt.referenceNumber})` : ''} was not confirmed: ${reason}. The amount is still due.`,
      );
    }

    return { message: 'Payment rejected.' };
  }

  /** Tells the people living in a flat (current owners and active tenants) through in-app notifications. */
  private async tellFlat(flatId: string, title: string, body: string) {
    const activeTenantId = this.maintenanceRepository['activeTenantId'];
    const rows = (await this.db.execute(sql`
      select o.user_id as "userId" from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
      where fo.flat_id = ${flatId} and o.user_id is not null
      union
      select t.user_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      where ft.flat_id = ${flatId} and t.user_id is not null
    `)) as unknown as { userId: string }[];
    for (const r of rows) {
      await this.notificationService.createInAppNotification({ societyId: activeTenantId, recipientUserId: r.userId, title, body });
    }
  }
}
