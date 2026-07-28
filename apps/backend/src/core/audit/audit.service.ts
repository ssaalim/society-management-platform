import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../context/tenant-context.service';

export interface AuditLogDto {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Logs an action performed in the system.
   * Future implementation: Persist this to a dedicated audit logs database table.
   */
  async log(payload: AuditLogDto): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const userId = this.tenantContext.getUserId();

    const auditEntry = {
      ...payload,
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
    };

    // For now, we only log it via Pino
    this.logger.log(`Audit Event: ${JSON.stringify(auditEntry)}`);
    
    // TODO: Implement database persistence here
  }
}
