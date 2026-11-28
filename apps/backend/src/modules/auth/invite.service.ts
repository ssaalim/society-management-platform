import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, roles, societies, userInvites, userSocieties, users } from '../../../database/schema';
import { AuthService } from './auth.service';

/** Who may invite members to the app. */
const OFFICE = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'ACCOUNTANT', 'ESTATE_MANAGER'];
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const VALID_DAYS = 7;

const normalise = (code: string) => (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hash = (code: string) => createHash('sha256').update(normalise(code)).digest('hex');
const pretty = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/**
 * Invite-only sign-up: the office makes a one-time code for a member already added to the society; the member enters
 * it in the app and chooses their own password. The same code resets a forgotten password. Only a hash is stored.
 */
@Injectable()
export class InviteService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly auth: AuthService,
  ) {}

  private async roleIn(userId: string, societyId: string) {
    const [row] = await this.db
      .select({ role: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, societyId)));
    return row?.role || null;
  }

  async create(societyId: string, userId: string, createdBy: string) {
    const myRole = await this.roleIn(createdBy, societyId);
    if (!myRole || !OFFICE.includes(myRole)) throw new ForbiddenException('Only the society office can invite members.');
    if (!(await this.roleIn(userId, societyId))) throw new NotFoundException('This person is not a member of the society.');
    const [user] = await this.db.select({ id: users.id, name: users.name, email: users.email, mobile: users.mobile }).from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found.');
    const [society] = await this.db.select({ name: societies.name }).from(societies).where(eq(societies.id, societyId));

    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    const expiresAt = new Date(Date.now() + VALID_DAYS * 86400_000);
    await this.db.transaction(async (tx) => {
      // A new code replaces any earlier unused one.
      await tx.update(userInvites).set({ expiresAt: new Date() }).where(and(eq(userInvites.userId, userId), isNull(userInvites.usedAt)));
      await tx.insert(userInvites).values({ societyId, userId, codeHash: hash(code), expiresAt, createdBy });
    });
    await this.db
      .insert(auditLogs)
      .values({ societyId, userId: createdBy, action: 'USER_INVITE_CREATE', entityName: 'users', entityId: userId, newValues: { expiresAt } } as any)
      .catch(() => undefined);

    const shown = pretty(code);
    return {
      code: shown,
      expiresAt,
      email: user.email,
      mobile: user.mobile,
      name: user.name,
      message:
        `Hello ${(user.name || '').replace(/\s*\(.*\)$/, '') || 'there'}, you are invited to ${society?.name || 'your society'} on the Housive app. ` +
        `Install the app, tap "Have an invite code?" and enter ${shown} with your email ${user.email}. The code works once and expires in ${VALID_DAYS} days.`,
    };
  }

  private async find(code: string) {
    if (normalise(code).length !== 8) throw new BadRequestException('Enter the 8-character code from your society.');
    const [row] = await this.db
      .select({ invite: userInvites, email: users.email, name: users.name, societyName: societies.name })
      .from(userInvites)
      .innerJoin(users, eq(users.id, userInvites.userId))
      .innerJoin(societies, eq(societies.id, userInvites.societyId))
      .where(eq(userInvites.codeHash, hash(code)));
    if (!row || row.invite.usedAt || row.invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This code is not valid any more. Ask your society office for a new one.');
    }
    return row;
  }

  /** What the app shows before the member chooses a password. */
  async check(code: string) {
    const row = await this.find(code);
    return { email: row.email, name: (row.name || '').replace(/\s*\(.*\)$/, ''), societyName: row.societyName };
  }

  /** Sets the password, uses up the code and signs the member in. The email must match, as a second check. */
  async activate(dto: { code: string; email: string; password: string }) {
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('Choose a password of at least 8 characters.');
    const row = await this.find(dto.code);
    if (row.email.toLowerCase() !== (dto.email || '').trim().toLowerCase()) {
      throw new BadRequestException('That email does not match this invite. Use the email your society office has for you.');
    }
    const [taken] = await this.db
      .update(userInvites)
      .set({ usedAt: new Date() })
      .where(and(eq(userInvites.id, row.invite.id), isNull(userInvites.usedAt)))
      .returning({ id: userInvites.id });
    if (!taken) throw new BadRequestException('This code has already been used.');
    const [user] = await this.db
      .update(users)
      .set({ password: await bcrypt.hash(dto.password, 10), isActive: true, updatedAt: new Date() })
      .where(eq(users.id, row.invite.userId))
      .returning();
    await this.db
      .insert(auditLogs)
      .values({ societyId: row.invite.societyId, userId: user.id, action: 'USER_INVITE_ACTIVATE', entityName: 'users', entityId: user.id, newValues: null } as any)
      .catch(() => undefined);
    return this.auth.sessionFor(user);
  }
}
