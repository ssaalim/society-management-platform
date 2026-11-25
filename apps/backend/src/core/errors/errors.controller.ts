import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { SuperAdminGuard } from '@core/auth/superadmin.guard';
import { jwtSecret } from '@core/auth/jwt-secret';
import { ErrorLogService } from './error-log.service';

const clientErrorSchema = z.object({
  code: z.string().regex(/^E-[0-9A-F]{4}$/).nullable().default(null),
  level: z.enum(['error', 'crash']).default('error'),
  message: z.string().min(1).max(2000),
  stack: z.string().max(6000).nullable().default(null),
  where: z.string().max(300).nullable().default(null),
  page: z.string().max(300).nullable().default(null),
  version: z.string().max(40).nullable().default(null),
  societyId: z.string().uuid().nullable().default(null),
  requestId: z.string().max(80).nullable().default(null),
  steps: z.array(z.string().max(120)).max(20).nullable().default(null),
  context: z.record(z.string(), z.unknown()).nullable().default(null),
});

/**
 * The app reports crashes here (screens that broke, failed scripts). Open to signed-out pages too, so a broken login
 * screen is still reported; the user is taken from the token when there is one. Rate limited per IP.
 */
@ApiTags('Support')
@Controller('support')
export class ClientErrorsController {
  constructor(
    private readonly errors: ErrorLogService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Raises a test server error (not in production), to check the error popup and log' })
  @Get('test-error')
  testError() {
    if (process.env.NODE_ENV === 'production') return { success: true, data: { skipped: true } };
    throw new Error('Test error from the support tools');
  }

  @ApiOperation({ summary: 'Report an app error (crash) with its code' })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('client-errors')
  async report(@Body() body: any, @Req() req: any) {
    const dto = clientErrorSchema.parse(body);
    let userId: string | null = null;
    const auth = String(req.headers?.authorization || '');
    if (auth.startsWith('Bearer ')) {
      try {
        const payload: any = this.jwt.verify(auth.slice(7), { secret: jwtSecret(this.config) });
        userId = payload?.sub || payload?.id || null;
      } catch {
        /* reported without a user */
      }
    }
    const code = await this.errors.record({ source: 'CLIENT', ...dto, userId, userAgent: req.headers?.['user-agent'] || null });
    return { success: true, data: { code } };
  }
}

/** Platform staff look error codes up here. */
@ApiTags('Support')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, SuperAdminGuard)
@Controller('superadmin/errors')
export class ErrorsAdminController {
  constructor(private readonly errors: ErrorLogService) {}

  @ApiOperation({ summary: 'Errors grouped by code, newest first' })
  @Get()
  async list(@Query('open') open?: string, @Query('search') search?: string) {
    return { success: true, data: await this.errors.list({ open: open === 'true', search: search?.trim() || undefined }) };
  }

  @ApiOperation({ summary: 'Mark an error code fixed (it reopens if it happens again)' })
  @Patch(':code')
  async resolve(@Param('code') code: string, @Body() body: any) {
    const resolved = z.object({ resolved: z.boolean() }).parse(body).resolved;
    return { success: true, data: await this.errors.setResolved(code, resolved) };
  }
}
