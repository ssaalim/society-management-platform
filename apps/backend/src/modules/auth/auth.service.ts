import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { users, userSocieties, societies, roles, subscriptions, rolePermissions, permissions } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { UserService } from '../user/user.service';
import { jwtSecret } from '@core/auth/jwt-secret';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  /**
   * Verifies email + password and returns the user row. Shared by society sign-in and platform sign-in.
   */
  private async verifyCredentials(dto: { email: string; password?: string }) {
    if (!dto.email) {
      throw new BadRequestException('Email is required.');
    }
    const email = dto.email.trim().toLowerCase();
    const inputPassword = dto.password || '';

    const userRecord = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!userRecord) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!userRecord.isActive) {
      throw new UnauthorizedException('This account has been deactivated. Please contact support.');
    }

    let isPasswordValid = false;
    if (userRecord.password && (userRecord.password.startsWith('$2a$') || userRecord.password.startsWith('$2b$'))) {
      isPasswordValid = await bcrypt.compare(inputPassword, userRecord.password);
    } else if (userRecord.password) {
      // Legacy plain-text password (initial demo seed): must match exactly, then it is upgraded to bcrypt.
      isPasswordValid = inputPassword.length > 0 && userRecord.password === inputPassword;
    }
    // Accounts without a password cannot sign in until one is set.

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!userRecord.password || !userRecord.password.startsWith('$2')) {
      const hashed = await bcrypt.hash(inputPassword, 10);
      await this.db.update(users).set({ password: hashed }).where(eq(users.id, userRecord.id));
    }

    return userRecord;
  }

  /**
   * Society sign-in: returns a society-scoped JWT and the user's memberships. The token carries no society or role;
   * every request names its society (x-tenant-id) and the server checks membership in that society each time.
   */
  async login(dto: { email: string; password?: string }) {
    const userRecord = await this.verifyCredentials(dto);
    return this.sessionFor(userRecord);
  }

  /** A signed-in society session for this user: token plus memberships (used by login and invite activation). */
  async sessionFor(userRecord: typeof users.$inferSelect) {
    const profile = await this.userService.getUserMemberships(userRecord.id);

    const token = this.generateToken({
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name || userRecord.email.split('@')[0],
      scope: 'society',
    });

    return {
      token,
      user: profile.user,
      memberships: profile.memberships,
      isPlatformAdmin: userRecord.isPlatformAdmin,
    };
  }

  /**
   * Platform console sign-in (/platform). Only users flagged as platform admins get a platform-scoped token, which
   * the SuperAdminGuard requires and the TenantGuard refuses, so platform and society sessions never mix.
   */
  async platformLogin(dto: { email: string; password?: string }) {
    const userRecord = await this.verifyCredentials(dto);
    if (!userRecord.isPlatformAdmin) {
      throw new UnauthorizedException('This account is not a platform administrator.');
    }
    const token = this.generateToken({
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name || userRecord.email.split('@')[0],
      scope: 'platform',
    });
    return {
      token,
      admin: { id: userRecord.id, email: userRecord.email, name: userRecord.name },
    };
  }

  // No open sign-up: accounts are created by the society office and activated with an invite code (InviteService).


  /**
   * Signs a JWT payload using server's JWT_SECRET.
   */
  private generateToken(payload: { id: string; email: string; name: string; scope: 'society' | 'platform' }) {
    return this.jwtService.sign(
      {
        sub: payload.id,
        id: payload.id,
        email: payload.email,
        name: payload.name,
        scope: payload.scope,
      },
      {
        secret: jwtSecret(this.configService),
        expiresIn: payload.scope === 'platform' ? '12h' : '30d',
      },
    );
  }
}
