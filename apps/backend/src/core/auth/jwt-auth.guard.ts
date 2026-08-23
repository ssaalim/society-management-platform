import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { DevAuthGuard } from './dev-auth.guard';

/**
 * Native JWT Authentication Guard.
 * Verifies JWT signature from 'Authorization: Bearer <token>' header,
 * extracts user context and attaches it to request.user and ClsService.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private devAuthGuard: DevAuthGuard;
  private isDevMode: boolean;
  private jwtService: JwtService;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly cls?: ClsService,
    @Optional() jwtService?: JwtService,
  ) {
    const isDev = this.configService.get<string>('DEV_AUTH') === 'true';
    const isNotProd = this.configService.get<string>('NODE_ENV') !== 'production';
    this.isDevMode = isDev && isNotProd;
    this.devAuthGuard = new DevAuthGuard(configService, cls);

    const secret = this.configService.get<string>('JWT_SECRET') || 'society-app-super-secret-jwt-key-2026';
    this.jwtService = jwtService || new JwtService({ secret });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    // If dev auth header is explicitly passed in dev mode, allow dev-auth
    if (this.isDevMode && request.headers['x-dev-user-id']) {
      return this.devAuthGuard.canActivate(context);
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In dev mode fallback to dev auth if no Bearer token
      if (this.isDevMode) {
        return this.devAuthGuard.canActivate(context);
      }
      throw new UnauthorizedException('Missing or malformed Authorization header. Use Bearer <token>.');
    }

    const token = authHeader.split(' ')[1];

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'society-app-super-secret-jwt-key-2026';
      const payload = this.jwtService.verify(token, { secret });

      if (!payload || (!payload.sub && !payload.id)) {
        throw new UnauthorizedException('Invalid token payload.');
      }

      const userId = payload.sub || payload.id;
      const user = {
        id: userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };

      request.user = user;

      if (this.cls) {
        this.cls.set('userId', userId);
      }

      return true;
    } catch (err: any) {
      // If token expired or signature failed, check if dev mode fallback
      if (this.isDevMode) {
        return this.devAuthGuard.canActivate(context);
      }
      throw new UnauthorizedException(err.message || 'Authentication token is invalid or expired.');
    }
  }
}
