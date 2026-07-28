import { Module } from '@nestjs/common';
import { SocietyController } from './society.controller';
import { SocietyService } from './society.service';
import { SocietyRepository } from './society.repository';

@Module({
  controllers: [SocietyController],
  providers: [SocietyService, SocietyRepository],
  exports: [SocietyService, SocietyRepository],
})
export class SocietyModule {}
