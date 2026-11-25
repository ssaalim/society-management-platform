import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { billingCategories, flats } from '../../../database/schema';
import { BillingCategoryDto } from './dto/billing-category.dto';

export type BillingCategory = typeof billingCategories.$inferSelect;

export interface FloorRate {
  fromFloor: number;
  toFloor: number | null;
  rate: number;
}

/** Monthly charges for one unit under its category, before multiplying by the months in a bill. */
export interface CategoryCharges {
  base: number;
  rateApplied: number;
  extras: Record<string, number>;
  parking: number;
}

/**
 * Billing categories decide how each unit's maintenance is calculated: the residential default follows the society's
 * existing settings and formula; commercial categories (shops, offices, ...) charge per sq ft or a fixed amount, can
 * vary by floor, add their own fixed extras, carry GST and have their own late-fee rules.
 */
@Injectable()
export class BillingCategoryService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  /** All categories of the society; creates the default "Residential" one the first time. */
  async list(): Promise<BillingCategory[]> {
    const rows = await this.db
      .select()
      .from(billingCategories)
      .where(eq(billingCategories.societyId, this.societyId))
      .orderBy(asc(billingCategories.sortOrder), asc(billingCategories.createdAt));
    if (rows.length > 0) return rows;

    const [created] = await this.db
      .insert(billingCategories)
      .values({
        societyId: this.societyId,
        name: 'Residential',
        usage: 'RESIDENTIAL',
        calculationType: 'SOCIETY_FORMULA',
        isDefault: true,
        sortOrder: 0,
      })
      .returning();
    return [created];
  }

  async get(id: string): Promise<BillingCategory> {
    const [row] = await this.db
      .select()
      .from(billingCategories)
      .where(and(eq(billingCategories.id, id), eq(billingCategories.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Billing category not found.');
    return row;
  }

  private toRow(dto: BillingCategoryDto) {
    return {
      name: dto.name,
      usage: dto.usage,
      calculationType: dto.calculationType,
      areaType: dto.areaType,
      rate: dto.rate.toFixed(2),
      floorRates: [...dto.floorRates].sort((a, b) => a.fromFloor - b.fromFloor),
      extraCharges: dto.extraCharges,
      includeParking: dto.includeParking,
      flatTypes: [...new Set(dto.flatTypes)],
      invoicePrefix: dto.invoicePrefix.toUpperCase(),
      gstEnabled: dto.gstEnabled,
      gstRate: dto.gstRate.toFixed(2),
      gstThresholdMonthly: dto.gstThresholdMonthly.toFixed(2),
      penaltyType: dto.penaltyType,
      penaltyInterestRate: dto.penaltyInterestRate === null ? null : dto.penaltyInterestRate.toFixed(2),
      penaltyFlatAmount: dto.penaltyFlatAmount === null ? null : dto.penaltyFlatAmount.toFixed(2),
      penaltyGracePeriodDays: dto.penaltyGracePeriodDays,
      sortOrder: dto.sortOrder,
      updatedAt: new Date(),
    };
  }

  /** A flat type belongs to at most one category, so a unit never matches two. */
  private async assertFlatTypesFree(flatTypes: string[], exceptId?: string) {
    if (flatTypes.length === 0) return;
    const others = (await this.list()).filter((c) => c.id !== exceptId);
    for (const t of flatTypes) {
      const owner = others.find((c) => (c.flatTypes as string[]).includes(t));
      if (owner) throw new BadRequestException(`Flat type "${t}" is already billed under "${owner.name}".`);
    }
  }

  async create(dto: BillingCategoryDto) {
    await this.assertFlatTypesFree(dto.flatTypes);
    const [row] = await this.db
      .insert(billingCategories)
      .values({ ...this.toRow(dto), societyId: this.societyId, isDefault: false })
      .returning();
    return row;
  }

  async update(id: string, dto: BillingCategoryDto) {
    const current = await this.get(id);
    await this.assertFlatTypesFree(dto.flatTypes, id);
    if (current.isDefault && dto.usage !== 'RESIDENTIAL') {
      throw new BadRequestException('The default category is residential.');
    }
    const [row] = await this.db
      .update(billingCategories)
      .set(this.toRow(dto))
      .where(and(eq(billingCategories.id, id), eq(billingCategories.societyId, this.societyId)))
      .returning();
    return row;
  }

  async remove(id: string) {
    const current = await this.get(id);
    if (current.isDefault) throw new BadRequestException('The default category cannot be deleted.');
    // Units assigned to it by hand fall back to matching by flat type.
    await this.db
      .update(flats)
      .set({ billingCategoryId: null })
      .where(and(eq(flats.societyId, this.societyId), eq(flats.billingCategoryId, id)));
    await this.db.delete(billingCategories).where(and(eq(billingCategories.id, id), eq(billingCategories.societyId, this.societyId)));
    return { deleted: true };
  }

  /** Manually put units in a category (or clear it with null). */
  async assignFlats(flatIds: string[], billingCategoryId: string | null) {
    if (billingCategoryId) await this.get(billingCategoryId);
    const updated = await this.db
      .update(flats)
      .set({ billingCategoryId, updatedAt: new Date() })
      .where(and(eq(flats.societyId, this.societyId), inArray(flats.id, flatIds)))
      .returning({ id: flats.id });
    return { updated: updated.length };
  }

  /** The category a unit is billed under: manual assignment, else its flat type, else the default. */
  resolve(categories: BillingCategory[], flat: { billingCategoryId: string | null; flatType: string }): BillingCategory {
    if (flat.billingCategoryId) {
      const manual = categories.find((c) => c.id === flat.billingCategoryId);
      if (manual) return manual;
    }
    const byType = categories.find((c) => (c.flatTypes as string[]).some((t) => t.toLowerCase() === flat.flatType.toLowerCase()));
    return byType || categories.find((c) => c.isDefault) || categories[0];
  }

  /** The rate for a floor: the matching floor band, else the category's base rate. */
  rateForFloor(category: BillingCategory, floorNumber: number): number {
    const band = (category.floorRates as FloorRate[]).find(
      (r) => floorNumber >= r.fromFloor && (r.toFloor === null || r.toFloor === undefined || floorNumber <= r.toFloor),
    );
    return band ? Number(band.rate) : Number(category.rate);
  }

  /** Monthly charges for a unit in a PER_SQ_FT or FIXED category. */
  monthlyCharges(
    category: BillingCategory,
    unit: { superBuiltupArea: number; carpetArea: number; floorNumber: number; parking: number },
  ): CategoryCharges {
    const rateApplied = this.rateForFloor(category, unit.floorNumber);
    const area = category.areaType === 'CARPET_AREA' ? unit.carpetArea : unit.superBuiltupArea;
    const base = category.calculationType === 'PER_SQ_FT' ? area * rateApplied : rateApplied;
    const extras: Record<string, number> = {};
    for (const [name, amount] of Object.entries((category.extraCharges as Record<string, number>) || {})) {
      if (Number(amount) > 0) extras[name] = Number(amount);
    }
    return {
      base: Math.round(base * 100) / 100,
      rateApplied,
      extras,
      parking: category.includeParking ? unit.parking : 0,
    };
  }

  /**
   * GST on a bill: when enabled for the category and the unit's maintenance per month is above the threshold, GST is
   * charged on the whole amount (CGST + SGST halves shown on the invoice).
   */
  gstFor(category: BillingCategory, subtotal: number, months: number): { rate: number; amount: number } | null {
    if (!category.gstEnabled) return null;
    const perMonth = subtotal / Math.max(1, months);
    if (perMonth <= Number(category.gstThresholdMonthly)) return null;
    const rate = Number(category.gstRate);
    return { rate, amount: Math.round(subtotal * rate) / 100 };
  }
}
