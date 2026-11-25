import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { MeetingAccess } from './meeting-access.service';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';
import { ResolutionService } from './resolution.service';
import { MeetingRemindersScheduler } from './meeting-reminders.scheduler';

@Module({
  imports: [NotificationModule],
  controllers: [MeetingController],
  providers: [MeetingAccess, MeetingService, ResolutionService, MeetingRemindersScheduler],
})
export class MeetingModule {}
