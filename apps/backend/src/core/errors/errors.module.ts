import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ErrorLogService } from './error-log.service';
import { ClientErrorsController, ErrorsAdminController } from './errors.controller';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [ClientErrorsController, ErrorsAdminController],
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorsModule {}
