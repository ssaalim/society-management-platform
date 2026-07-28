import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { SocietyRepository } from './society.repository';
import { CreateSocietyDto } from './dto/create-society.dto';
import { UpdateSocietyDto } from './dto/update-society.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, userSocieties, roles } from '../../../database/schema';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SocietyService {
  private supabase: SupabaseClient;

  constructor(
    private readonly societyRepository: SocietyRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 'https://placeholder.supabase.co';
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || 'placeholder-key';
    // Using service role to generate administrative pre-signed urls
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

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
   * Generates a Supabase pre-signed upload URL for society profile document uploads.
   */
  async generateUploadUrl(id: string, fileType: string, fileName: string) {
    const validTypes = ['logo', 'registration_certificate', 'pan', 'gst', 'bye_laws', 'bank_passbook'];
    if (!validTypes.includes(fileType)) {
      throw new BadRequestException(`Invalid file type upload scope: ${fileType}`);
    }

    // Path pattern: societies/{society_id}/{file_type}_{random_filename}
    const path = `societies/${id}/${fileType}_${fileName}`;
    const bucketName = 'documents'; // Target bucket name configured in Supabase Storage

    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new BadRequestException(`Failed to generate signed upload URL: ${error?.message || 'Unknown Storage error'}`);
    }

    return {
      uploadUrl: data.signedUrl,
      fileKey: path,
      publicUrl: `${this.configService.get('SUPABASE_URL')}/storage/v1/object/public/${bucketName}/${path}`,
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
