import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  complaints, 
  staff,
  userSocieties,
  roles,
  flatOwners,
  flatTenants,
  flats
} from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';

import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ComplaintService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly notificationService: NotificationService,
  ) {}

  private get activeTenantId() {
    return this.cls.get<string>('tenantId');
  }

  async createComplaint(dto: { title: string; description: string; priority?: string; category?: string }, executorId: string) {
    const activeTenantId = this.activeTenantId;
    const ticketId = require('crypto').randomUUID();

    // Resolve user flat
    const userFlatOwner = await this.db.query.flatOwners.findFirst({
      where: eq(flatOwners.ownerId, executorId),
    });
    const userFlatTenant = await this.db.query.flatTenants.findFirst({
      where: eq(flatTenants.tenantId, executorId),
    });
    let targetFlatId = userFlatOwner?.flatId || userFlatTenant?.flatId;

    if (!targetFlatId) {
      const anyFlat = await this.db.query.flats.findFirst({
        where: eq(flats.societyId, activeTenantId),
      });
      targetFlatId = anyFlat?.id || '';
    }

    const newTicket = await this.db.insert(complaints).values({
      id: ticketId,
      societyId: activeTenantId,
      flatId: targetFlatId,
      raisedByUserId: executorId,
      title: dto.title,
      description: dto.description,
      priority: (dto.priority as any) || 'MEDIUM',
      status: 'OPEN',
      escalationLevel: 0,
    }).returning();

    await this.logAction({
      societyId: activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_CREATE',
      entityName: 'complaints',
      entityId: ticketId,
      newValues: newTicket[0],
    });

    // Notify Board, Committee Members & Accountant
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT', 'COMMITTEE_MEMBER'],
      `⚠️ New Complaint Raised: ${dto.title}`,
      `A new ${dto.priority || 'MEDIUM'} priority complaint "${dto.title}" has been logged by resident.`
    );

    return newTicket[0];
  }

  async findAll(filters: { status?: string; priority?: string }, executorId?: string) {
    let userRoleName = '';
    if (executorId) {
      const userRoleQuery = await this.db
        .select({ roleName: roles.name })
        .from(userSocieties)
        .innerJoin(roles, eq(userSocieties.roleId, roles.id))
        .where(
          and(
            eq(userSocieties.userId, executorId),
            eq(userSocieties.societyId, this.activeTenantId)
          )
        );
      if (userRoleQuery.length > 0) {
        userRoleName = userRoleQuery[0].roleName;
      }
    }

    const whereClauses = [eq(complaints.societyId, this.activeTenantId)];
    if (filters.status) {
      whereClauses.push(eq(complaints.status, filters.status));
    }
    if (filters.priority) {
      whereClauses.push(eq(complaints.priority, filters.priority));
    }

    // Role-based scoping: OWNER / TENANT / ACCOUNTANT only sees their own complaints
    if (['OWNER', 'TENANT', 'ACCOUNTANT'].includes(userRoleName) && executorId) {
      whereClauses.push(eq(complaints.raisedByUserId, executorId));
    }

    return this.db
      .select()
      .from(complaints)
      .where(and(...whereClauses));
  }

  async assignStaff(id: string, staffId: string | null, executorId?: string) {
    const ticket = await this.db.query.complaints.findFirst({
      where: and(
        eq(complaints.id, id),
        eq(complaints.societyId, this.activeTenantId)
      ),
    });

    if (!ticket) {
      throw new NotFoundException('Complaint ticket not found.');
    }

    await this.db
      .update(complaints)
      .set({ 
        assignedStaffId: staffId || null,
        status: staffId ? 'ASSIGNED' : 'OPEN'
      })
      .where(eq(complaints.id, id));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_ASSIGN_STAFF',
      entityName: 'complaints',
      entityId: id,
      newValues: { assignedStaffId: staffId },
    });

    return { success: true };
  }

  async escalateTicket(id: string, executorId?: string) {
    const ticket = await this.db.query.complaints.findFirst({
      where: and(
        eq(complaints.id, id),
        eq(complaints.societyId, this.activeTenantId)
      ),
    });

    if (!ticket) {
      throw new NotFoundException('Complaint ticket not found.');
    }

    const nextLevel = ticket.escalationLevel + 1;

    await this.db
      .update(complaints)
      .set({ 
        escalationLevel: nextLevel,
        escalatedAt: new Date(),
        status: 'OPEN' // Reset to open/attention status
      })
      .where(eq(complaints.id, id));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_ESCALATE',
      entityName: 'complaints',
      entityId: id,
      newValues: { escalationLevel: nextLevel, escalatedAt: new Date() },
    });

    return { success: true, escalationLevel: nextLevel };
  }

  async submitFeedback(id: string, feedback: string, executorId?: string) {
    const ticket = await this.db.query.complaints.findFirst({
      where: and(
        eq(complaints.id, id),
        eq(complaints.societyId, this.activeTenantId)
      ),
    });

    if (!ticket) {
      throw new NotFoundException('Complaint ticket not found.');
    }

    await this.db
      .update(complaints)
      .set({ 
        residentFeedback: feedback,
        status: 'CLOSED'
      })
      .where(eq(complaints.id, id));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_FEEDBACK_SUBMIT',
      entityName: 'complaints',
      entityId: id,
      newValues: { residentFeedback: feedback, status: 'CLOSED' },
    });

    return { success: true };
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
