import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Support multiple environments (Railway will inject process.env directly)
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
}

export default defineConfig({
  schema: './database/schema.ts',
  out: './database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  verbose: true,
  strict: true,
});
