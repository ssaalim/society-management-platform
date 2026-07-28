import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgresModule from 'postgres';
import * as schema from '../../../database/schema';

// Handle ESM/CJS interop – postgres is ESM-only
const postgres = (postgresModule as any).default || postgresModule;

export const DRIZZLE_PROVIDER = 'DRIZZLE_PROVIDER';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL') || 'postgresql://postgres:postgrespassword@localhost:5432/society_db';
        const client = postgres(url, { prepare: false }); // prepare: false works better in serverless/pooled architectures (like Supabase PgBouncer/Supavisor)
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE_PROVIDER],
})
export class DatabaseModule {}
export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;
