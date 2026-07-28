import { Module } from '@nestjs/common';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';
import { ResidentRepository } from './resident.repository';

@Module({
  controllers: [ResidentController],
  providers: [ResidentService, ResidentRepository],
  exports: [ResidentService, ResidentRepository],
})
export class ResidentModule {}
