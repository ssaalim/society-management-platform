import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';

@Module({
  imports: [NotificationModule],
  controllers: [FacilityController],
  providers: [FacilityService],
})
export class FacilityModule {}
