import { Module } from '@nestjs/common';
import { SuperAdminController } from './superadmin.controller';
import { SuperAdminService } from './superadmin.service';
import { SuperAdminRepository } from './superadmin.repository';

@Module({
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminRepository],
  exports: [SuperAdminService, SuperAdminRepository],
})
export class SuperAdminModule {}
