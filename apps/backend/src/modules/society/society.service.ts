import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { SocietyRepository } from './society.repository';
import { CreateSocietyDto } from './dto/create-society.dto';
import { UpdateSocietyDto } from './dto/update-society.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, userSocieties, roles, societies, subscriptions, plans, users } from '../../../database/schema';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { R2StorageService } from '@core/storage/r2-storage.service';

@Injectable()
export class SocietyService {
  constructor(
    private readonly societyRepository: SocietyRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly r2StorageService: R2StorageService,
  ) {}

  async create(dto: CreateSocietyDto, userId?: string) {
    const existing = await this.societyRepository.findBySlug(dto.slug);
    if (existing) {
      throw new BadRequestException('A society with this URL slug already exists.');
    }

    const society = await this.societyRepository.insert(dto);

    // Write audit log
    await this.logAction({
      societyId: society.id,
      userId,
      action: 'SOCIETY_CREATE',
      entityName: 'societies',
      entityId: society.id,
      newValues: society,
    });

    return society;
  }

  async findAll() {
    return this.societyRepository.findAll();
  }

  async findOne(id: string) {
    const details = await this.societyRepository.findDetailsById(id);
    if (!details) {
      throw new NotFoundException('Society profile not found.');
    }
    return details;
  }

  async getSubscriptionStatus(id: string) {
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
      .where(eq(societies.id, id))
      .limit(1);

    return rows[0] || null;
  }

  async findBySlug(slug: string) {
    const society = await this.societyRepository.findBySlug(slug);
    if (!society) {
      throw new NotFoundException('Society slug not resolved.');
    }
    return society;
  }

  async update(id: string, dto: UpdateSocietyDto, userId?: string) {
    const current = await this.societyRepository.findById(id);
    if (!current) {
      throw new NotFoundException('Society profile not found.');
    }

    const updated = await this.societyRepository.update(id, {
      ...dto,
      updatedAt: new Date(),
    });

    // Log the update audit
    await this.logAction({
      societyId: id,
      userId,
      action: 'SOCIETY_UPDATE',
      entityName: 'societies',
      entityId: id,
      oldValues: current,
      newValues: updated,
    });

    return updated;
  }

  async remove(id: string, userId?: string) {
    const current = await this.societyRepository.findById(id);
    if (!current) {
      throw new NotFoundException('Society profile not found.');
    }

    const deleted = await this.societyRepository.update(id, {
      deletedAt: new Date(),
      isActive: false,
    });

    await this.logAction({
      societyId: id,
      userId,
      action: 'SOCIETY_SOFT_DELETE',
      entityName: 'societies',
      entityId: id,
      oldValues: current,
    });

    return deleted;
  }

  /**
   * Bank Accounts Configuration Management
   */
  async getBankAccounts(societyId: string) {
    return this.societyRepository.getBankAccounts(societyId);
  }

  async addBankAccount(societyId: string, data: any, userId?: string) {
    const account = await this.societyRepository.addBankAccount(societyId, data);
    await this.logAction({
      societyId,
      userId,
      action: 'BANK_ACCOUNT_CREATE',
      entityName: 'bank_accounts',
      entityId: account.id,
      newValues: account,
    });
    return account;
  }

  async updateBankAccount(societyId: string, accountId: string, data: any, userId?: string) {
    const updated = await this.societyRepository.updateBankAccount(societyId, accountId, data);
    await this.logAction({
      societyId,
      userId,
      action: 'BANK_ACCOUNT_UPDATE',
      entityName: 'bank_accounts',
      entityId: accountId,
      newValues: updated,
    });
    return updated;
  }

  async deleteBankAccount(societyId: string, accountId: string, userId?: string) {
    const deleted = await this.societyRepository.deleteBankAccount(societyId, accountId);
    await this.logAction({
      societyId,
      userId,
      action: 'BANK_ACCOUNT_DELETE',
      entityName: 'bank_accounts',
      entityId: accountId,
    });
    return deleted;
  }

  /**
   * Generates a pre-signed Cloudflare R2 upload URL for society profile document uploads.
   */
  async generateUploadUrl(id: string, fileType: string, fileName: string, contentType?: string, fileSize?: number) {
    return this.r2StorageService.generatePresignedUploadUrl(id, {
      fileType: fileType as any,
      fileName,
      contentType: contentType || 'application/octet-stream',
      fileSize,
    });
  }

  /**
   * Retrieves change history & audit trails for society profile, settings, and bank accounts.
   */
  async getHistory(societyId: string) {
    const logs = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityName: auditLogs.entityName,
        entityId: auditLogs.entityId,
        oldValues: auditLogs.oldValues,
        newValues: auditLogs.newValues,
        createdAt: auditLogs.createdAt,
        userId: auditLogs.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        and(
          eq(auditLogs.societyId, societyId),
          inArray(auditLogs.entityName, ['societies', 'settings', 'bank_accounts'])
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    return logs;
  }

  /**
   * Evaluates society statutory registration renewal / expiry status.
   */
  async getRegistrationExpiry(societyId: string) {
    const soc = await this.societyRepository.findById(societyId);
    if (!soc) {
      throw new NotFoundException('Society profile not found.');
    }

    if (!soc.renewalDate) {
      return {
        renewalDate: null,
        registrationDate: soc.registrationDate ? String(soc.registrationDate).substring(0, 10) : null,
        registrationNumber: soc.registrationNumber,
        daysLeft: null,
        isExpired: false,
        isNearExpiry: false,
        status: 'NOT_SET',
      };
    }

    const renewalDateStr = String(soc.renewalDate).substring(0, 10);
    const renewalDate = new Date(renewalDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = renewalDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 3600 * 24));

    const isExpired = daysLeft < 0;
    const isNearExpiry = daysLeft >= 0 && daysLeft <= 60; // 60-day renewal notice window

    return {
      renewalDate: renewalDateStr,
      registrationDate: soc.registrationDate ? String(soc.registrationDate).substring(0, 10) : null,
      registrationNumber: soc.registrationNumber,
      daysLeft,
      isExpired,
      isNearExpiry,
      status: isExpired ? 'EXPIRED' : isNearExpiry ? 'NEAR_EXPIRY' : 'ACTIVE',
    };
  }

  /**
   * Internal helper to record mutation audit logs.
   */
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
      console.error('Failed to write audit logs:', err);
    }
  }
}
