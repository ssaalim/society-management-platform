import { Injectable, Inject } from '@nestjs/common';
import { 
  societies, 
  subscriptions, 
  plans, 
  featureFlags, 
  systemLogs,
  users,
  userSocieties,
  ledgers,
  roles
} from '../../../database/schema';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { eq, and, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SuperAdminRepository {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {}

  /**
   * Aggregates platformwide multi-tenant analytical stats.
   */
  async getPlatformSummary() {
    const societiesCount = await this.db
      .select({ count: sql<number>`count(${societies.id})::integer` })
      .from(societies);

    const activeSubs = await this.db
      .select({
        mrr: sql<string>`sum(${plans.price}::numeric)`,
        count: sql<number>`count(${subscriptions.id})::integer`,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.status, 'ACTIVE'));

    return {
      societiesCount: societiesCount[0]?.count || 0,
      activeSubscriptions: activeSubs[0]?.count || 0,
      monthlyRecurringRevenue: Number(activeSubs[0]?.mrr) || 0,
    };
  }

  async getSystemLogs() {
    return this.db
      .select()
      .from(systemLogs)
      .limit(50);
  }

  async getFeatureFlags() {
    return this.db
      .select()
      .from(featureFlags);
  }

  async createSocietyWithSetup(societyData: any, presidentData: any, executorId?: string) {
    return this.db.transaction(async (tx) => {
      // 1. Create the Society
      const societyId = require('crypto').randomUUID();
      const newSociety = await tx.insert(societies).values({
        id: societyId,
        name: societyData.name,
        slug: societyData.slug,
        address: societyData.address || null,
        registrationNumber: societyData.registrationNumber || null,
        pan: societyData.pan || null,
        gstin: societyData.gstin || null,
      }).returning();

      // 2. Setup President User
      const userId = require('crypto').randomUUID();
      const existingUser = await tx.select().from(users).where(eq(users.email, presidentData.email)).limit(1);
      
      let finalUserId = existingUser[0]?.id;
      
      if (!finalUserId) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await tx.insert(users).values({
          id: userId,
          email: presidentData.email,
          password: hashedPassword,
          name: presidentData.name,
          mobile: presidentData.mobile,
          defaultSocietyId: societyId,
        });
        finalUserId = userId;
      }

      // 3. Map user as PRESIDENT
      let role = await tx.select().from(roles).where(eq(roles.name, 'PRESIDENT')).limit(1);
      let presidentRoleId = role[0]?.id;

      if (!presidentRoleId) {
        const [newRole] = await tx.insert(roles).values({
          id: require('crypto').randomUUID(),
          name: 'PRESIDENT',
          description: 'Society President / Chairman',
        }).returning();
        presidentRoleId = newRole.id;
      }
      
      if (presidentRoleId) {
        await tx.insert(userSocieties).values({
          id: require('crypto').randomUUID(),
          userId: finalUserId,
          societyId: societyId,
          roleId: presidentRoleId,
        });
        
        // If an executorId is provided and is different from the president's ID, also map them so they can view the society
        if (executorId && executorId !== finalUserId) {
          const executorUser = await tx.select().from(users).where(eq(users.id, executorId)).limit(1);
          if (executorUser[0]) {
            await tx.insert(userSocieties).values({
              id: require('crypto').randomUUID(),
              userId: executorId,
              societyId: societyId,
              roleId: presidentRoleId,
            });
          }
        }
      }

      // 4. Create Default Ledgers
      const defaultLedgers = [
        { id: require('crypto').randomUUID(), societyId, name: 'Bank Account - Main', group: 'ASSETS', code: 'BANK-01', isActive: true },
        { id: require('crypto').randomUUID(), societyId, name: 'Cash in Hand Account', group: 'ASSETS', code: 'CASH-01', isActive: true },
        { id: require('crypto').randomUUID(), societyId, name: 'Maintenance Dues Receivables', group: 'ASSETS', code: 'REC-01', isActive: true },
        { id: require('crypto').randomUUID(), societyId, name: 'Vendor & Service Payables', group: 'LIABILITIES', code: 'PAY-01', isActive: true },
        { id: require('crypto').randomUUID(), societyId, name: 'Maintenance Charges Income', group: 'INCOME', code: 'INC-01', isActive: true },
        { id: require('crypto').randomUUID(), societyId, name: 'General Expenses', group: 'EXPENSES', code: 'EXP-01', isActive: true },
      ];
      
      // @ts-ignore
      await tx.insert(ledgers).values(defaultLedgers);

      return newSociety[0];
    });
  }

  /**
   * Returns all societies joined with their subscription and plan details.
   */
  async getSocietiesWithSubscriptions() {
    return this.db
      .select({
        id: societies.id,
        name: societies.name,
        slug: societies.slug,
        address: societies.address,
        registrationNumber: societies.registrationNumber,
        pan: societies.pan,
        gstin: societies.gstin,
        createdAt: societies.createdAt,
        subscriptionId: subscriptions.id,
        subscriptionStatus: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        planId: plans.id,
        planName: plans.name,
        planPrice: plans.price,
        maxFlats: plans.maxFlats,
        maxStorageGb: plans.maxStorageGb,
        daysLeft: sql<number>`case 
          when ${subscriptions.endDate} is not null then (${subscriptions.endDate}::date - CURRENT_DATE)
          else null 
        end::integer`,
      })
      .from(societies)
      .leftJoin(subscriptions, eq(societies.id, subscriptions.societyId))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .orderBy(societies.name);
  }

  /**
   * Returns all available pricing plans.
   */
  async getPlans() {
    return this.db
      .select()
      .from(plans)
      .orderBy(plans.price);
  }

  /**
   * Assigns or updates a subscription plan for a society.
   */
  async assignOrRenewSubscription(data: {
    societyId: string;
    planId: string;
    startDate: string;
    endDate: string;
    status?: string;
  }) {
    const existing = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.societyId, data.societyId))
      .limit(1);

    const isExpired = new Date(data.endDate) < new Date(new Date().setHours(0, 0, 0, 0));
    const status = data.status || (isExpired ? 'EXPIRED' : 'ACTIVE');

    if (existing.length > 0) {
      const [updated] = await this.db
        .update(subscriptions)
        .set({
          planId: data.planId,
          startDate: data.startDate,
          endDate: data.endDate,
          status,
        })
        .where(eq(subscriptions.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(subscriptions)
      .values({
        id: require('crypto').randomUUID(),
        societyId: data.societyId,
        planId: data.planId,
        startDate: data.startDate,
        endDate: data.endDate,
        status,
      })
      .returning();
    return created;
  }

  /**
   * Fetches active subscriptions expiring within the given number of days.
   */
  async getExpiringSoon(days: number = 30) {
    return this.db
      .select({
        societyId: societies.id,
        societyName: societies.name,
        societySlug: societies.slug,
        subscriptionId: subscriptions.id,
        planName: plans.name,
        endDate: subscriptions.endDate,
        daysLeft: sql<number>`(${subscriptions.endDate}::date - CURRENT_DATE)::integer`,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .innerJoin(societies, eq(subscriptions.societyId, societies.id))
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        sql`${subscriptions.endDate}::date - CURRENT_DATE <= ${days} AND ${subscriptions.endDate}::date - CURRENT_DATE >= 0`
      );
  }

  /**
   * Fetches subscription status for a specific society.
   */
  async getSocietySubscriptionStatus(societyId: string) {
    const rows = await this.db
      .select({
        societyId: societies.id,
        societyName: societies.name,
        subscriptionId: subscriptions.id,
        status: subscriptions.status,
        startDate: subscriptions.startDate,
        endDate: subscriptions.endDate,
        planName: plans.name,
        planPrice: plans.price,
        daysLeft: sql<number>`case 
          when ${subscriptions.endDate} is not null then (${subscriptions.endDate}::date - CURRENT_DATE)
          else null 
        end::integer`,
      })
      .from(societies)
      .leftJoin(subscriptions, eq(societies.id, subscriptions.societyId))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(societies.id, societyId))
      .limit(1);

    return rows[0] || null;
  }
}
