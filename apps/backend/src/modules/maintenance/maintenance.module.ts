import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRepository } from './maintenance.repository';
import { BillingCategoryService } from './billing-category.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceRepository, BillingCategoryService],
  exports: [MaintenanceService, MaintenanceRepository, BillingCategoryService],
})
export class MaintenanceModule {}
