import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { staff, auditLogs } from '../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get activeTenantId() {
    return this.cls.get<string>('tenantId');
  }

  async findAll() {
    return this.db
      .select()
      .from(staff)
      .where(eq(staff.societyId, this.activeTenantId))
      .orderBy(desc(staff.createdAt));
  }

  async findOne(id: string) {
    const member = await this.db.query.staff.findFirst({
      where: and(
        eq(staff.id, id),
        eq(staff.societyId, this.activeTenantId)
      ),
    });

    if (!member) {
      throw new NotFoundException('Staff member not found.');
    }

    return member;
  }

  async create(dto: {
    name: string;
    mobile: string;
    role: string;
    salary?: string | number;
    isAvailable?: boolean;
  }, executorId?: string) {
    if (!dto.name || !dto.mobile || !dto.role) {
      throw new BadRequestException('Name, mobile number, and role are required.');
    }

    const newStaff = await this.db.insert(staff).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      name: dto.name.trim(),
      mobile: dto.mobile.trim(),
      role: dto.role.trim().toUpperCase(),
      salary: dto.salary !== undefined ? String(dto.salary) : '0.00',
      isAvailable: dto.isAvailable !== undefined ? dto.isAvailable : true,
    }).returning();

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'STAFF_CREATE',
      entityName: 'staff',
      entityId: newStaff[0].id,
      newValues: newStaff[0],
    });

    return newStaff[0];
  }

  async update(id: string, dto: {
    name?: string;
    mobile?: string;
    role?: string;
    salary?: string | number;
    isAvailable?: boolean;
  }, executorId?: string) {
    const current = await this.findOne(id);

    const updatePayload: any = { updatedAt: new Date() };
    if (dto.name !== undefined) updatePayload.name = dto.name.trim();
    if (dto.mobile !== undefined) updatePayload.mobile = dto.mobile.trim();
    if (dto.role !== undefined) updatePayload.role = dto.role.trim().toUpperCase();
    if (dto.salary !== undefined) updatePayload.salary = String(dto.salary);
    if (dto.isAvailable !== undefined) updatePayload.isAvailable = dto.isAvailable;

    const updated = await this.db
      .update(staff)
      .set(updatePayload)
      .where(and(eq(staff.id, id), eq(staff.societyId, this.activeTenantId)))
      .returning();

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'STAFF_UPDATE',
      entityName: 'staff',
      entityId: id,
      oldValues: current,
      newValues: updated[0],
    });

    return updated[0];
  }

  async remove(id: string, executorId?: string) {
    const current = await this.findOne(id);

    const deleted = await this.db
      .delete(staff)
      .where(and(eq(staff.id, id), eq(staff.societyId, this.activeTenantId)))
      .returning();

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'STAFF_DELETE',
      entityName: 'staff',
      entityId: id,
      oldValues: current,
    });

    return { success: true, deleted: deleted[0] };
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
