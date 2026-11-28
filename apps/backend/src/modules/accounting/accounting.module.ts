import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingRepository } from './accounting.repository';
import { NotificationModule } from '../notification/notification.module';
import { RecurringExpenseController } from './recurring-expense.controller';
import { RecurringExpenseService } from './recurring-expense.service';
import { RecurringExpenseScheduler } from './recurring-expense.scheduler';

@Module({
  imports: [NotificationModule],
  controllers: [AccountingController, RecurringExpenseController],
  providers: [AccountingService, AccountingRepository, RecurringExpenseService, RecurringExpenseScheduler],
  exports: [AccountingService, AccountingRepository],
})
export class AccountingModule {}
