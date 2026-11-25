import { Injectable, NotFoundException, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  complaints, 
  staff,
  userSocieties,
  roles,
  flatOwners,
  flatTenants,
  flats,
  users,
  floors,
  wings
} from '../../../database/schema';
import { eq, and, desc, sql, isNull, asc } from 'drizzle-orm';
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

  /** The caller's flats in this society (current owner or active tenant) and whether they are a resident. */
  private async flatContext(userId: string): Promise<{ isResident: boolean; flatIds: string[] }> {
    const [membership] = await this.db
      .select({ roleName: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(userSocieties.roleId, roles.id))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, this.activeTenantId)));
    const isResident = !membership || ['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'].includes(membership.roleName);
    const rows = (await this.db.execute(sql`
      select fo.flat_id as "flatId" from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
      where o.user_id = ${userId} and o.society_id = ${this.activeTenantId}
      union
      select ft.flat_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      where t.user_id = ${userId} and ft.society_id = ${this.activeTenantId}
    `)) as unknown as { flatId: string }[];
    return { isResident, flatIds: rows.map((r) => r.flatId) };
  }

  /** Flats this person can tag on a complaint: their own as a resident, every flat for the office. */
  async flatOptions(userId: string) {
    const { isResident, flatIds } = await this.flatContext(userId);
    if (isResident && !flatIds.length) return { isResident, flats: [] };
    const rows = await this.db
      .select({ id: flats.id, number: flats.number, wing: wings.name })
      .from(flats)
      .leftJoin(floors, eq(floors.id, flats.floorId))
      .leftJoin(wings, eq(wings.id, floors.wingId))
      .where(and(eq(flats.societyId, this.activeTenantId), isNull(flats.deletedAt), isResident ? sql`${flats.id} in ${flatIds}` : undefined))
      .orderBy(asc(wings.name), asc(flats.number));
    return {
      isResident,
      flats: rows
        .map((r) => ({ id: r.id, label: r.wing ? `${r.wing}-${r.number}` : r.number }))
        .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true })),
    };
  }

  async createComplaint(dto: { title: string; description: string; priority?: string; category?: string; flatId?: string }, executorId: string) {
    const activeTenantId = this.activeTenantId;
    const ticketId = require('crypto').randomUUID();

    // Residents raise complaints for their own flat; the office can tag any flat, or none for a common area.
    const { isResident, flatIds } = await this.flatContext(executorId);
    let targetFlatId: string | null = dto.flatId || null;
    if (targetFlatId) {
      const [flat] = await this.db
        .select({ id: flats.id })
        .from(flats)
        .where(and(eq(flats.id, targetFlatId), eq(flats.societyId, activeTenantId)));
      if (!flat) throw new BadRequestException('That flat is not part of this society.');
      if (isResident && !flatIds.includes(targetFlatId)) {
        throw new ForbiddenException('You can raise complaints only for your own flat, or leave the flat empty for a common area.');
      }
    } else if (isResident && flatIds.length === 1) {
      targetFlatId = flatIds[0];
    }

    const newTicket = await this.db.insert(complaints).values({
      id: ticketId,
      societyId: activeTenantId,
      flatId: targetFlatId,
      raisedByUserId: executorId,
      title: dto.title.trim(),
      description: dto.description.trim(),
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

    // Notify Board, Committee Members & Estate Incharge
    await this.notificationService.notifyRoles(
      ['PRESIDENT', 'SECRETARY', 'TREASURER', 'ACCOUNTANT', 'COMMITTEE_MEMBER', 'ESTATE_MANAGER', 'MAINTENANCE_INCHARGE'],
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

    // Role-based scoping: Standard residents only see their own complaints
    if (['OWNER', 'TENANT'].includes(userRoleName) && executorId) {
      whereClauses.push(eq(complaints.raisedByUserId, executorId));
    }

    const rows = await this.db
      .select({
        id: complaints.id,
        societyId: complaints.societyId,
        flatId: complaints.flatId,
        flatNumber: flats.number,
        raisedByUserId: complaints.raisedByUserId,
        raisedByName: users.name,
        raisedByEmail: users.email,
        assignedStaffId: complaints.assignedStaffId,
        assignedStaffName: complaints.assignedStaffName,
        staffDatabaseName: staff.name,
        staffRole: staff.role,
        title: complaints.title,
        description: complaints.description,
        status: complaints.status,
        priority: complaints.priority,
        resolutionComment: complaints.resolutionComment,
        resolvedAt: complaints.resolvedAt,
        residentFeedback: complaints.residentFeedback,
        rating: complaints.rating,
        escalationLevel: complaints.escalationLevel,
        escalatedAt: complaints.escalatedAt,
        createdAt: complaints.createdAt,
        updatedAt: complaints.updatedAt,
      })
      .from(complaints)
      .leftJoin(flats, eq(complaints.flatId, flats.id))
      .leftJoin(users, eq(complaints.raisedByUserId, users.id))
      .leftJoin(staff, eq(complaints.assignedStaffId, staff.id))
      .where(and(...whereClauses))
      .orderBy(desc(complaints.createdAt));

    return rows.map((r) => ({
      ...r,
      assignedStaffName: r.assignedStaffName || r.staffDatabaseName || null,
    }));
  }

  async getStaffList() {
    return this.db
      .select({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        phone: staff.mobile,
        isAvailable: staff.isAvailable,
      })
      .from(staff)
      .where(
        and(
          eq(staff.societyId, this.activeTenantId),
          eq(staff.isAvailable, true)
        )
      );
  }

  async assignStaff(id: string, dto: { staffId?: string; staffName?: string }, executorId?: string) {
    const ticket = await this.db.query.complaints.findFirst({
      where: and(
        eq(complaints.id, id),
        eq(complaints.societyId, this.activeTenantId)
      ),
    });

    if (!ticket) {
      throw new NotFoundException('Complaint ticket not found.');
    }

    let resolvedStaffName = dto.staffName || null;
    if (dto.staffId && !resolvedStaffName) {
      const staffMember = await this.db.query.staff.findFirst({
        where: and(eq(staff.id, dto.staffId), eq(staff.societyId, this.activeTenantId)),
      });
      if (!staffMember) {
        throw new NotFoundException('Staff member not found in this society.');
      }
      resolvedStaffName = staffMember ? `${staffMember.name} (${staffMember.role})` : null;
    }

    await this.db
      .update(complaints)
      .set({ 
        assignedStaffId: dto.staffId || null,
        assignedStaffName: resolvedStaffName,
        status: (dto.staffId || resolvedStaffName) ? 'ASSIGNED' : 'OPEN',
        updatedAt: new Date(),
      })
      .where(and(eq(complaints.id, id), eq(complaints.societyId, this.activeTenantId)));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_ASSIGN_STAFF',
      entityName: 'complaints',
      entityId: id,
      newValues: { assignedStaffId: dto.staffId, assignedStaffName: resolvedStaffName },
    });

    return { 
      success: true, 
      assignedStaffId: dto.staffId || null, 
      assignedStaffName: resolvedStaffName 
    };
  }

  async resolveComplaint(id: string, dto: { resolutionComment: string }, executorId?: string) {
    const ticket = await this.db.query.complaints.findFirst({
      where: and(
        eq(complaints.id, id),
        eq(complaints.societyId, this.activeTenantId)
      ),
    });

    if (!ticket) {
      throw new NotFoundException('Complaint ticket not found.');
    }

    const resolvedAt = new Date();
    await this.db
      .update(complaints)
      .set({ 
        resolutionComment: dto.resolutionComment.trim(),
        resolvedAt,
        status: 'RESOLVED',
        updatedAt: resolvedAt,
      })
      .where(and(eq(complaints.id, id), eq(complaints.societyId, this.activeTenantId)));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_RESOLVE',
      entityName: 'complaints',
      entityId: id,
      newValues: { resolutionComment: dto.resolutionComment, resolvedAt, status: 'RESOLVED' },
    });

    return { success: true, status: 'RESOLVED' };
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
        status: 'OPEN',
        updatedAt: new Date(),
      })
      .where(and(eq(complaints.id, id), eq(complaints.societyId, this.activeTenantId)));

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

  async submitFeedback(id: string, dto: { feedback: string; rating?: number }, executorId?: string) {
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
        residentFeedback: dto.feedback.trim(),
        rating: dto.rating || 5,
        status: 'CLOSED',
        updatedAt: new Date(),
      })
      .where(and(eq(complaints.id, id), eq(complaints.societyId, this.activeTenantId)));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'COMPLAINT_FEEDBACK_SUBMIT',
      entityName: 'complaints',
      entityId: id,
      newValues: { residentFeedback: dto.feedback, rating: dto.rating || 5, status: 'CLOSED' },
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
