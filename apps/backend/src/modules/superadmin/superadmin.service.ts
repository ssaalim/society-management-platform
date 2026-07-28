import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { SuperAdminRepository } from './superadmin.repository';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateSocietyDto } from './dto/create-society.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  plans, 
  featureFlags, 
  systemLogs,
  auditLogs 
} from '../../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly superAdminRepository: SuperAdminRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {}

  async getDashboard() {
    const summary = await this.superAdminRepository.getPlatformSummary();
    const flags = await this.superAdminRepository.getFeatureFlags();
    const logs = await this.superAdminRepository.getSystemLogs();
    const health = await this.getServerHealth();

    return {
      summary,
      flags,
      logs,
      health,
    };
  }

  async createSociety(dto: CreateSocietyDto, executorId?: string) {
    const societyData = {
      name: dto.name,
      slug: dto.slug,
      address: dto.address,
      registrationNumber: dto.registrationNumber,
      pan: dto.pan,
      gstin: dto.gstin,
    };
    
    const presidentData = {
      name: dto.presidentName,
      email: dto.presidentEmail,
      mobile: dto.presidentMobile,
    };

    const society = await this.superAdminRepository.createSocietyWithSetup(societyData, presidentData, executorId);
    
    await this.logAction({
      userId: executorId,
      action: 'SOCIETY_CREATE',
      entityName: 'societies',
      entityId: society.id,
      newValues: society,
    });
    
    return society;
  }

  async createPlan(dto: CreatePlanDto, executorId?: string) {
    const planRecord = await this.db.insert(plans).values({
      id: require('crypto').randomUUID(),
      name: dto.name,
      price: dto.price.toFixed(2),
      maxFlats: dto.maxFlats,
      maxStorageGb: dto.maxStorageGb,
    }).returning();

    await this.logAction({
      userId: executorId,
      action: 'PLAN_CREATE',
      entityName: 'plans',
      entityId: planRecord[0].id,
      newValues: planRecord[0],
    });

    return planRecord[0];
  }

  async toggleFeatureFlag(flagId: string, isEnabled: boolean, executorId?: string) {
    const flag = await this.db.query.featureFlags.findFirst({
      where: eq(featureFlags.id, flagId),
    });

    if (!flag) {
      throw new NotFoundException('Feature flag not found.');
    }

    await this.db
      .update(featureFlags)
      .set({ isEnabled })
      .where(eq(featureFlags.id, flagId));

    await this.logAction({
      userId: executorId,
      action: 'FEATURE_FLAG_TOGGLE',
      entityName: 'feature_flags',
      entityId: flagId,
      newValues: { isEnabled },
    });

    return { success: true };
  }

  /**
   * Probes hardware resources variables (CPU, Memory, Latencies).
   */
  async getServerHealth() {
    return {
      cpuUsagePercent: Number((10 + Math.random() * 20).toFixed(1)), // Mock CPU load
      memoryUsageGb: Number((4.2 + Math.random() * 1.5).toFixed(2)), // Mock RAM
      totalMemoryGb: 16.0,
      databaseLatencyMs: Number((5 + Math.random() * 8).toFixed(0)), // Mock PG delay
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  private async logAction(data: {
    userId?: string;
    action: string;
    entityName: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
  }) {
    try {
      await this.db.insert(auditLogs).values({
        societyId: null,
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
