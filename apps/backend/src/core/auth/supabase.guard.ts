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
    this.isDevMode = this.configService.get<string>('DEV_AUTH') === 'true';
    this.devAuthGuard = new DevAuthGuard(configService, cls);

    if (!this.isDevMode) {
      const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || 'https://your-supabase-project.supabase.co';
      const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY') || 'your-supabase-anon-key';
      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
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
    const { data: { user }, error } = await this.supabase!.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Authentication token is invalid or expired.');
    }

    // Bind user context to request object
    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      userMetadata: user.user_metadata,
    };

    if (this.cls) {
      this.cls.set('userId', user.id);
    }

    return true;
  }
}
