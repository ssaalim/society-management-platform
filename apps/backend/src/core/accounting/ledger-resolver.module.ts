import { Global, Module } from '@nestjs/common';
import { LedgerResolver } from './ledger-resolver.service';

@Global()
@Module({
  providers: [LedgerResolver],
  exports: [LedgerResolver],
})
export class LedgerResolverModule {}
