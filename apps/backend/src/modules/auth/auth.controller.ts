import { Controller, Post, Body, Get, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Webhook endpoint to sync users from Supabase Auth' })
  @Post('webhook')
  async handleSupabaseWebhook(
    @Headers('x-webhook-signature') signature: string,
    @Body() payload: any,
  ) {
    const expectedSecret = this.configService.get<string>('WEBHOOK_SECRET');
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    // Secure webhook invocation with secret check in production and when secret is configured
    if (isProduction || expectedSecret) {
      if (!expectedSecret || !signature || signature !== expectedSecret) {
        throw new UnauthorizedException('Invalid or missing webhook signature key.');
      }
    }

    const { event, record } = payload;

    // Supabase webhook payload structure contains 'record' detailing users
    if (record && (event === 'INSERT' || event === 'UPDATE')) {
      await this.userService.syncUser({
        id: record.id,
        email: record.email,
        name: record.raw_user_meta_data?.name,
        mobile: record.phone || record.raw_user_meta_data?.phone,
        avatarUrl: record.raw_user_meta_data?.avatar_url,
      });
    }

    return {
      success: true,
      message: 'User sync profile completed successfully.',
    };
  }

  /**
   * Dev-only login endpoint. Returns user profile + memberships given an email.
   * Only works when DEV_AUTH=true and NODE_ENV !== 'production'.
   */
  @ApiOperation({ summary: '[DEV ONLY] Login with email to get user profile and dev token' })
  @Post('dev-login')
  async devLogin(@Body() body: { email: string; password: string }) {
    const isDevMode = this.configService.get<string>('DEV_AUTH') === 'true';
    const isNotProd = this.configService.get<string>('NODE_ENV') !== 'production';
    if (!isDevMode || !isNotProd) {
      throw new BadRequestException('Dev login is strictly disabled in production environments.');
    }

    if (!body.email) {
      throw new BadRequestException('Email is required.');
    }

    // Find user by email using a raw query approach via the service
    const user = await this.userService.findByEmail(body.email);
    if (!user) {
      throw new BadRequestException('No test user found with this email. Run db:seed first.');
    }

    // Get memberships
    const profile = await this.userService.getUserMemberships(user.id);

    return {
      success: true,
      data: {
        devToken: user.id, // The dev token IS the user ID — used in x-dev-user-id header
        user: profile.user,
        memberships: profile.memberships,
      },
    };
  }

  /**
   * Dev-only: list all available test users for the dev login picker.
   * Only works when DEV_AUTH=true and NODE_ENV !== 'production'.
   */
  @ApiOperation({ summary: '[DEV ONLY] List all test users for dev login picker' })
  @Get('dev-users')
  async listDevUsers() {
    const isDevMode = this.configService.get<string>('DEV_AUTH') === 'true';
    const isNotProd = this.configService.get<string>('NODE_ENV') !== 'production';
    if (!isDevMode || !isNotProd) {
      throw new BadRequestException('Dev users listing is strictly disabled in production environments.');
    }

    const users = await this.userService.findAllUsers();
    return {
      success: true,
      data: users,
    };
  }
}
