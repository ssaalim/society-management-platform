import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { TenantContextService } from '../context/tenant-context.service';

@Global()
@Module({
  providers: [AuditService, TenantContextService],
  exports: [AuditService, TenantContextService],
})
export class AuditModule {}
