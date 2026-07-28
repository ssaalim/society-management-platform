import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  notifications,
  notificationLogs, 
  notificationTemplates, 
  users, 
  userSocieties,
  roles,
  maintenanceBills,
  flatOwners,
  owners,
  flatTenants,
  tenants
} from '../../../database/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get activeTenantId() {
    return this.cls.get<string>('tenantId');
  }

  /**
   * Creates an in-app notification for a target user.
   */
  async createInAppNotification(data: {
    societyId?: string;
    recipientUserId: string;
    title: string;
    body: string;
    channel?: string;
  }) {
    const societyId = data.societyId || this.activeTenantId;
    if (!societyId || !data.recipientUserId) return null;

    try {
      const record = await this.db.insert(notifications).values({
        id: require('crypto').randomUUID(),
        societyId,
        recipientUserId: data.recipientUserId,
        recipientContact: 'IN_APP',
        channel: data.channel || 'IN_APP',
        title: data.title,
        body: data.body,
        status: 'SENT',
        sentAt: new Date(),
      }).returning();

      return record[0];
    } catch (err) {
      console.error('Failed to create in-app notification:', err);
      return null;
    }
  }

  /**
   * Dispatches notifications to all users holding specific roles in the society.
   */
  async notifyRoles(targetRoles: string[], title: string, body: string) {
    const societyId = this.activeTenantId;
    if (!societyId || targetRoles.length === 0) return;

    try {
      const targetUsers = await this.db
        .select({ userId: userSocieties.userId })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.societyId, societyId),
            inArray(roles.name, targetRoles)
          )
        );

      const uniqueUserIds = Array.from(new Set(targetUsers.map((u) => u.userId)));

      await Promise.all(
        uniqueUserIds.map((userId) =>
          this.createInAppNotification({
            societyId,
            recipientUserId: userId,
            title,
            body,
          })
        )
      );
    } catch (err) {
      console.error('Failed to notify roles:', err);
    }
  }

  /**
   * Retrieves in-app notifications for the requesting user.
   */
  async getUserNotifications(userId: string) {
    const societyId = this.activeTenantId;

    const list = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.societyId, societyId),
          eq(notifications.recipientUserId, userId)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCount = list.filter((n) => n.status !== 'READ').length;

    return {
      list,
      unreadCount,
    };
  }

  /**
   * Marks a specific notification as READ.
   */
  async markAsRead(notificationId: string, userId: string) {
    await this.db
      .update(notifications)
      .set({ status: 'READ' })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientUserId, userId)
        )
      );

    return { success: true };
  }

  /**
   * Marks all notifications as READ for the user.
   */
  async markAllAsRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ status: 'READ' })
      .where(
        and(
          eq(notifications.societyId, this.activeTenantId),
          eq(notifications.recipientUserId, userId)
        )
      );

    return { success: true };
  }

  /**
   * Dispatches custom template notifications and logs delivery status.
   */
  async sendNotification(
    userId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH',
    templateName: string,
    variables: Record<string, string>,
    executorId?: string
  ) {
    const activeTenantId = this.activeTenantId;

    const template = await this.db.query.notificationTemplates.findFirst({
      where: and(
        eq(notificationTemplates.name, templateName),
        eq(notificationTemplates.societyId, activeTenantId)
      ),
    });

    const bodyText = template 
      ? this.interpolate(template.body, variables)
      : `Notification details: ${JSON.stringify(variables)}`;

    console.log(`[Notification Engine - ${channel}] Sending to user ${userId}: "${bodyText}"`);

    const logRecord = await this.db.insert(notificationLogs).values({
      id: require('crypto').randomUUID(),
      societyId: activeTenantId,
      userId,
      channel,
      status: 'SENT',
      attempts: 1,
    }).returning();

    return logRecord[0];
  }

  /**
   * Defaulters reminder sweep — sends dues notifications to residents and alerts board.
   */
  async runDefaultersReminderSweep(executorId?: string) {
    const activeTenantId = this.activeTenantId;

    const defaulters = await this.db
      .select({
        billId: maintenanceBills.id,
        billNumber: maintenanceBills.billNumber,
        flatId: maintenanceBills.flatId,
        amount: maintenanceBills.totalAmount,
        ownerUserId: owners.userId,
        tenantUserId: tenants.userId,
      })
      .from(maintenanceBills)
      .leftJoin(flatOwners, eq(maintenanceBills.flatId, flatOwners.flatId))
      .leftJoin(owners, eq(flatOwners.ownerId, owners.id))
      .leftJoin(flatTenants, and(eq(maintenanceBills.flatId, flatTenants.flatId), eq(flatTenants.isActive, true)))
      .leftJoin(tenants, eq(flatTenants.tenantId, tenants.id))
      .where(
        and(
          eq(maintenanceBills.societyId, activeTenantId),
          inArray(maintenanceBills.status, ['UNPAID', 'OVERDUE'])
        )
      );

    let notifiedCount = 0;
    for (const d of defaulters) {
      const recipientId = d.tenantUserId || d.ownerUserId;
      if (recipientId) {
        await this.createInAppNotification({
          societyId: activeTenantId,
          recipientUserId: recipientId,
          title: '⚠️ Pending Maintenance Payment Reminder',
          body: `Invoice ${d.billNumber} has an outstanding balance of ₹${d.amount}. Please settle your dues to avoid late fee penalties.`,
        });
        notifiedCount++;
      }
    }

    // Alert Board & Accountant
    await this.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT'],
      '📢 Defaulters Sweep Dispatched',
      `Manual dues reminder sweep dispatched to ${notifiedCount} resident accounts with outstanding balances.`
    );

    return { count: notifiedCount };
  }

  private interpolate(body: string, vars: Record<string, string>): string {
    let result = body;
    Object.keys(vars).forEach((key) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
    });
    return result;
  }
}
