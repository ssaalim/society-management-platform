import { Module } from '@nestjs/common';
import { FlatController } from './flat.controller';
import { FlatService } from './flat.service';
import { FlatRepository } from './flat.repository';

@Module({
  controllers: [FlatController],
  providers: [FlatService, FlatRepository],
  exports: [FlatService, FlatRepository],
})
export class FlatModule {}
