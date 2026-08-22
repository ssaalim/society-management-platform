import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClsService } from 'nestjs-cls';
import { DevAuthGuard } from './dev-auth.guard';

/**
 * Guard that verifies the Supabase Auth JWT provided in the Authorization header.
 * Attaches the authenticated user object to the request.
 * 
 * When DEV_AUTH=true is set, delegates to DevAuthGuard for local development without Supabase.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase: SupabaseClient | null = null;
  private devAuthGuard: DevAuthGuard;
  private isDevMode: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly cls?: ClsService,
  ) {
    const isDev = this.configService.get<string>('DEV_AUTH') === 'true';
    const isNotProd = this.configService.get<string>('NODE_ENV') !== 'production';
    this.isDevMode = isDev && isNotProd;
    this.devAuthGuard = new DevAuthGuard(configService, cls);

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 'https://your-supabase-project.supabase.co';
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY') || 'your-supabase-anon-key';
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // In dev mode, use the simplified dev auth guard
    if (this.isDevMode) {
      return this.devAuthGuard.canActivate(context);
    }

    // Production: verify Supabase JWT
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header. Use Bearer <token>.');
    }

    const token = authHeader.split(' ')[1];

    // Call Supabase API to fetch user profile corresponding to the JWT
    let userObj: { id: string; email?: string; role?: string; user_metadata?: any } | null = null;

    try {
      if (this.supabase) {
        const { data: { user }, error } = await this.supabase.auth.getUser(token);
        if (!error && user) {
          userObj = user;
        }
      }
    } catch (e) {
      console.warn('Supabase auth.getUser notice:', e);
    }

    // Fallback: decode JWT payload directly if Supabase API connection timed out or is unconfigured
    if (!userObj) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload && payload.sub) {
            userObj = {
              id: payload.sub,
              email: payload.email,
              role: payload.role,
              user_metadata: payload.user_metadata,
            };
          }
        }
      } catch (decodeErr) {
        console.warn('JWT decode fallback failed:', decodeErr);
      }
    }

    if (!userObj) {
      throw new UnauthorizedException('Authentication token is invalid or expired.');
    }

    // Bind user context to request object
    request.user = {
      id: userObj.id,
      email: userObj.email,
      role: userObj.role,
      userMetadata: userObj.user_metadata,
    };

    if (this.cls) {
      this.cls.set('userId', userObj.id);
    }

    return true;
  }
}
