import { Controller, Post, Body, Get, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
  ) {}

  @ApiOperation({ summary: 'Login with email and password to receive JWT token' })
  @Post('login')
  async login(@Body() body: { email: string; password?: string }) {
    const result = await this.authService.login(body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Register a new user account' })
  @Post('register')
  async register(@Body() body: { email: string; password?: string; name?: string; mobile?: string }) {
    const result = await this.authService.register(body);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Dev login endpoint for test picker.
   */
  @ApiOperation({ summary: '[DEV] Quick login with email to get user profile and token' })
  @Post('dev-login')
  async devLogin(@Body() body: { email: string; password?: string }) {
    const result = await this.authService.login({
      email: body.email,
      password: body.password || 'password123',
    });

    return {
      success: true,
      data: {
        devToken: result.token,
        token: result.token,
        user: result.user,
        memberships: result.memberships,
      },
    };
  }

  /**
   * List available demo users for picker.
   */
  @ApiOperation({ summary: 'List demo users for login picker' })
  @Get('dev-users')
  async listDevUsers() {
    const users = await this.userService.findAllUsers();
    return {
      success: true,
      data: users,
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
