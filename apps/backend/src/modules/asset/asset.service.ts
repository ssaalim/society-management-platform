import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  assets, 
  assetLogs 
} from '../../../database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
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
      .where(eq(assets.societyId, this.activeTenantId))
      .orderBy(assets.createdAt);
  }

  async createAsset(dto: {
    name: string;
    type: string;
    purchaseDate?: string;
    cost?: number;
    warrantyExpiry?: string;
    amcProvider?: string;
    amcCost?: number;
    nextServiceDate?: string;
  }, executorId?: string) {
    const newAsset = await this.db.insert(assets).values({
      id: require('crypto').randomUUID(),
      societyId: this.activeTenantId,
      name: dto.name,
      type: dto.type,
      purchaseDate: dto.purchaseDate || null,
      cost: dto.cost != null ? dto.cost.toFixed(2) : null,
      warrantyExpiry: dto.warrantyExpiry || null,
      amcProvider: dto.amcProvider || null,
      amcCost: dto.amcCost != null ? dto.amcCost.toFixed(2) : null,
      nextServiceDate: dto.nextServiceDate || null,
    }).returning();

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'ASSET_CREATE',
      entityName: 'assets',
      entityId: newAsset[0].id,
      newValues: newAsset[0],
    });

    return newAsset[0];
  }

  async updateAsset(assetId: string, dto: {
    name?: string;
    type?: string;
    purchaseDate?: string;
    cost?: number;
    warrantyExpiry?: string;
    amcProvider?: string;
    amcCost?: number;
    nextServiceDate?: string;
  }, executorId?: string) {
    const existing = await this.db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.societyId, this.activeTenantId)),
    });
    if (!existing) throw new NotFoundException('Asset not found.');

    const updated = await this.db.update(assets)
      .set({
        name: dto.name ?? existing.name,
        type: dto.type ?? existing.type,
        purchaseDate: dto.purchaseDate ?? existing.purchaseDate,
        cost: dto.cost != null ? dto.cost.toFixed(2) : existing.cost,
        warrantyExpiry: dto.warrantyExpiry ?? existing.warrantyExpiry,
        amcProvider: dto.amcProvider ?? existing.amcProvider,
        amcCost: dto.amcCost != null ? dto.amcCost.toFixed(2) : existing.amcCost,
        nextServiceDate: dto.nextServiceDate ?? existing.nextServiceDate,
        updatedAt: new Date(),
      })
      .where(and(eq(assets.id, assetId), eq(assets.societyId, this.activeTenantId)))
      .returning();

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'ASSET_UPDATE',
      entityName: 'assets',
      entityId: assetId,
      oldValues: existing,
      newValues: updated[0],
    });

    return updated[0];
  }

  async deleteAsset(assetId: string, executorId?: string) {
    const existing = await this.db.query.assets.findFirst({
      where: and(eq(assets.id, assetId), eq(assets.societyId, this.activeTenantId)),
    });
    if (!existing) throw new NotFoundException('Asset not found.');

    await this.db.delete(assets)
      .where(and(eq(assets.id, assetId), eq(assets.societyId, this.activeTenantId)));

    await this.logAction({
      societyId: this.activeTenantId,
      userId: executorId,
      action: 'ASSET_DELETE',
      entityName: 'assets',
      entityId: assetId,
      oldValues: existing,
    });

    return { success: true };
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
