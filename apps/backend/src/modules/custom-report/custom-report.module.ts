import { Module } from '@nestjs/common';
import { CustomReportController } from './custom-report.controller';
import { CustomReportService } from './custom-report.service';

@Module({
  controllers: [CustomReportController],
  providers: [CustomReportService],
  exports: [CustomReportService],
})
export class CustomReportModule {}
