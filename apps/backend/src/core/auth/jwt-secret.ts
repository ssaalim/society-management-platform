import { ConfigService } from '@nestjs/config';

const DEV_FALLBACK_SECRET = 'society-app-super-secret-jwt-key-2026';

/**
 * The JWT signing secret. Production must set JWT_SECRET: with the old public fallback anyone could mint tokens.
 */
export function jwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET must be set in production.');
  }
  return DEV_FALLBACK_SECRET;
}
