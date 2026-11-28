import { Controller, Post, Body, Get, Headers, UnauthorizedException, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { InviteService } from './invite.service';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly inviteService: InviteService,
  ) {}

  @ApiOperation({ summary: 'Office: make a one-time code for a member to set their password in the app' })
  @UseGuards(SupabaseAuthGuard, TenantGuard)
  @Post('invites')
  async invite(@Body() body: { userId: string }, @Req() req: any) {
    if (!body?.userId) throw new BadRequestException('Say who to invite.');
    return { success: true, data: await this.inviteService.create(req.headers['x-tenant-id'], body.userId, req.user.id) };
  }

  @ApiOperation({ summary: 'Check an invite code (who it is for)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invite/check')
  async checkInvite(@Body() body: { code: string }) {
    return { success: true, data: await this.inviteService.check(body?.code) };
  }

  @ApiOperation({ summary: 'Activate an account with an invite code and a new password (signs in)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invite/activate')
  async activate(@Body() body: { code: string; email: string; password: string }) {
    return { success: true, data: await this.inviteService.activate(body || ({} as any)) };
  }

  @ApiOperation({ summary: 'Login with email and password to receive JWT token' })
  @Post('login')
  async login(@Body() body: { email: string; password?: string }) {
    const result = await this.authService.login(body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Platform console sign-in (platform admins only)' })
  @Post('platform-login')
  async platformLogin(@Body() body: { email: string; password?: string }) {
    const result = await this.authService.platformLogin(body);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Optional sync webhook endpoint for backward compatibility.
   */
  @ApiOperation({ summary: 'User sync webhook endpoint' })
  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    return {
      success: true,
      message: 'Sync received.',
    };
  }
}
