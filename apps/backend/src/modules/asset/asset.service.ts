import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  assets, 
  assetLogs 
} from '../../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ClsService } from 'nestjs-cls';
import { CreateAssetLogDto } from './dto/create-asset-log.dto';

@Injectable()
export class AssetService {
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
      .from(assets)
      .where(eq(assets.societyId, this.activeTenantId));
  }

  async createAssetLog(assetId: string, dto: CreateAssetLogDto, executorId?: string) {
    const asset = await this.db.query.assets.findFirst({
      where: and(
        eq(assets.id, assetId),
        eq(assets.societyId, this.activeTenantId)
      ),
    });

    if (!asset) {
      throw new NotFoundException('Asset record not found.');
    }

    const logRecord = await this.db.insert(assetLogs).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      assetId,
      type: dto.type,
      description: dto.description,
      cost: dto.cost.toFixed(2),
      date: dto.date,
      status: dto.status,
    }).returning();

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'ASSET_LOG_CREATE',
      entityName: 'asset_logs',
      entityId: logRecord[0].id,
      newValues: logRecord[0],
    });

    return logRecord[0];
  }

  async getCostAnalysis() {
    return this.db
      .select({
        assetId: assetLogs.assetId,
        assetName: assets.name,
        type: assetLogs.type,
        totalCost: sql<string>`sum(${assetLogs.cost}::numeric)`,
      })
      .from(assetLogs)
      .innerJoin(assets, eq(assetLogs.assetId, assets.id))
      .where(eq(assetLogs.societyId, this.activeTenantId))
      .groupBy(assetLogs.assetId, assets.name, assetLogs.type);
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
