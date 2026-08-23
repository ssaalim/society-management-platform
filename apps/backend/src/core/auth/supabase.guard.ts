import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Backward compatibility alias for JwtAuthGuard.
 * Enables zero-refactor transition away from Supabase.
 */
@Injectable()
export class SupabaseAuthGuard extends JwtAuthGuard {}

export { JwtAuthGuard };
