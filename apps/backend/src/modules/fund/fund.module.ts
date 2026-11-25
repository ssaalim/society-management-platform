import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { FundController, FundWebhookController } from './fund.controller';
import { RazorpayService } from './razorpay.service';
import { FundService } from './fund.service';

@Module({
  imports: [NotificationModule],
  controllers: [FundWebhookController, FundController],
  providers: [FundService, RazorpayService],
})
export class FundModule {}
