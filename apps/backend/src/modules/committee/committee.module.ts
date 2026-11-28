import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { CommitteeController } from './committee.controller';
import { CommitteeService } from './committee.service';

@Module({
  imports: [NotificationModule],
  controllers: [CommitteeController],
  providers: [CommitteeService],
})
export class CommitteeModule {}
