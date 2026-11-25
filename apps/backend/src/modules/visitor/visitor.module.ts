import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { VisitorController } from './visitor.controller';
import { VisitorService } from './visitor.service';

@Module({
  imports: [NotificationModule],
  controllers: [VisitorController],
  providers: [VisitorService],
})
export class VisitorModule {}
