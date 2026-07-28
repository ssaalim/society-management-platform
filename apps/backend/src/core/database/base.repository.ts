import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DRIZZLE_PROVIDER, DrizzleDB } from './database.module';
import { eq, and } from 'drizzle-orm';

/**
 * Global Base Repository for system-wide tables (e.g. societies, global settings, system users)
 * that do not require multi-tenant boundary checks.
 */
@Injectable()
export abstract class GlobalBaseRepository<TTable extends { id: any }> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly table: TTable,
  ) {}

  async findAll() {
    return this.db.select().from(this.table as any);
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(this.table as any)
      .where(eq((this.table as any).id, id));
    return results[0] || null;
  }

  async insert(data: any) {
    const results = await this.db
      .insert(this.table as any)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, data: any) {
    const results = await this.db
      .update(this.table as any)
      .set(data)
      .where(eq((this.table as any).id, id))
      .returning();
    return results[0] || null;
  }

  async delete(id: string) {
    const results = await this.db
      .delete(this.table as any)
      .where(eq((this.table as any).id, id))
      .returning();
    return results[0] || null;
  }
}

/**
 * Tenant-Isolated Base Repository. 
 * Automatically enforces the active tenant context (`societyId`) retrieved from AsyncLocalStorage (CLS context).
 * Ensures developers cannot accidentally leak cross-tenant information.
 */
@Injectable()
export abstract class TenantBaseRepository<TTable extends { societyId: any; id: any }> {
  constructor(
    @Inject(DRIZZLE_PROVIDER) protected readonly db: DrizzleDB,
    protected readonly cls: ClsService,
    protected readonly table: TTable,
  ) {}

  /**
   * Retrieves the current request's tenant ID.
   * Throws an UnauthorizedException if accessed outside a valid tenant scope.
   */
  protected get activeTenantId(): string {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      throw new UnauthorizedException('Tenant scope is missing. Provide a valid x-tenant-id context header.');
    }
    return tenantId;
  }

  async findMany() {
    return this.db
      .select()
      .from(this.table as any)
      .where(eq((this.table as any).societyId, this.activeTenantId));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(this.table as any)
      .where(
        and(
          eq((this.table as any).id, id),
          eq((this.table as any).societyId, this.activeTenantId),
        ),
      );
    return results[0] || null;
  }

  async insert(data: any) {
    // Force active tenant context on write
    const payload = { ...data, societyId: this.activeTenantId };
    const results = await this.db
      .insert(this.table as any)
      .values(payload)
      .returning();
    return results[0];
  }

  async update(id: string, data: any) {
    const results = await this.db
      .update(this.table as any)
      .set(data)
      .where(
        and(
          eq((this.table as any).id, id),
          eq((this.table as any).societyId, this.activeTenantId),
        ),
      )
      .returning();
    return results[0] || null;
  }

  async delete(id: string) {
    const results = await this.db
      .delete(this.table as any)
      .where(
        and(
          eq((this.table as any).id, id),
          eq((this.table as any).societyId, this.activeTenantId),
        ),
      )
      .returning();
    return results[0] || null;
  }
}
