import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';

/**
 * Development-only auth guard that bypasses Supabase JWT verification.
 * Accepts a simple `x-dev-user-id` header or `Authorization: DevUser <user_id>` to simulate login.
 * 
 * ONLY active when DEV_AUTH=true is set in environment variables.
 */
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try x-dev-user-id header first
    let userId = request.headers['x-dev-user-id'];

    // Fallback to Authorization: DevUser <id>
    if (!userId) {
      const authHeader = request.headers['authorization'];
      if (authHeader?.startsWith('DevUser ')) {
        userId = authHeader.split(' ')[1];
      }
    }

    if (!userId) {
      // If no dev header is present, reject
      return false;
    }

    // Bind mock user context to request
    request.user = {
      id: userId,
      email: `dev-${userId}@society.dev`,
      role: 'authenticated',
      userMetadata: {},
    };

    if (this.cls) {
      this.cls.set('userId', userId);
    }

    return true;
  }
}
