import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { randomInt } from 'crypto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, dailyHelp, dailyHelpFlats, flats, floors, roles, userSocieties, users, visitorPasses, visitors, wings } from '../../../database/schema';
import { NotificationService } from '../notification/notification.service';
import { DailyHelpDto, PassDto, WalkInDto } from './dto/visitor.dto';

type Visit = typeof visitors.$inferSelect;

/** Who works the gate (guard desk) and sees the whole log. */
const GATE_ROLES = ['SECURITY_SUPERVISOR', 'ESTATE_MANAGER', 'SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY'];
/** How long a walk-in waits for the resident before the gate stops showing it. */
const WAIT_WINDOW_MS = 12 * 3600_000;
const TYPE_LABEL: Record<string, string> = { GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab', SERVICE: 'Service', DAILY_HELP: 'Daily help' };
const fmtTime = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

interface Actor {
  userId: string;
  role: string;
  isGate: boolean;
  flatIds: string[];
}

/**
 * Visitors: the guard logs walk-ins and the flat's residents approve them in the app (or confirm by phone); residents
 * create guest passes with a 6-digit code / QR checked at the gate; daily help (maids, drivers) have a permanent code
 * and their entries and exits are logged; the office sees the full log.
 */
@Injectable()
export class VisitorService {
  private readonly logger = new Logger(VisitorService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly notificationService: NotificationService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  private async actor(userId: string): Promise<Actor> {
    const [row] = await this.db
      .select({ role: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, this.societyId)));
    const role = row?.role || '';
    return { userId, role, isGate: GATE_ROLES.includes(role), flatIds: await this.flatsOf(userId) };
  }

  /** Flats a user owns or rents in this society. */
  private async flatsOf(userId: string): Promise<string[]> {
    const rows = (await this.db.execute(sql`
      select fo.flat_id as "flatId" from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
      where o.user_id = ${userId} and o.society_id = ${this.societyId}
      union
      select ft.flat_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      where t.user_id = ${userId} and ft.society_id = ${this.societyId}
    `)) as unknown as { flatId: string }[];
    return rows.map((r) => r.flatId);
  }

  /** People living in / owning a flat (who get the gate notifications). */
  private async residentsOf(flatId: string): Promise<string[]> {
    const rows = (await this.db.execute(sql`
      select o.user_id as "userId" from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
      where fo.flat_id = ${flatId} and o.society_id = ${this.societyId}
      union
      select t.user_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      where ft.flat_id = ${flatId} and ft.society_id = ${this.societyId}
    `)) as unknown as { userId: string }[];
    return rows.map((r) => r.userId);
  }

  private async assertGate(userId: string): Promise<Actor> {
    const a = await this.actor(userId);
    if (!a.isGate) throw new ForbiddenException('Only security and the society office can do this.');
    return a;
  }

  private async assertFlat(flatId: string) {
    const [f] = await this.db.select({ id: flats.id }).from(flats).where(and(eq(flats.id, flatId), eq(flats.societyId, this.societyId)));
    if (!f) throw new BadRequestException('That flat is not part of this society.');
  }

  private flatLabel() {
    return sql<string>`(select coalesce(w.name || '-', '') || f.number from flats f left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id where f.id = ${visitors.flatId})`;
  }

  private visitColumns() {
    return {
      visit: visitors,
      flatLabel: this.flatLabel(),
      decidedByName: sql<string | null>`(select u.name from users u where u.id = ${visitors.decidedBy})`,
    };
  }

  private shape(r: { visit: Visit; flatLabel: string; decidedByName: string | null }) {
    const waitingTooLong = r.visit.status === 'PENDING' && Date.now() - new Date(r.visit.entryTime).getTime() > WAIT_WINDOW_MS;
    return { ...r.visit, flatLabel: r.flatLabel, decidedByName: r.decidedByName, typeLabel: TYPE_LABEL[r.visit.type] || r.visit.type, noResponse: waitingTooLong };
  }

  private async visit(id: string): Promise<Visit> {
    const [v] = await this.db.select().from(visitors).where(and(eq(visitors.id, id), eq(visitors.societyId, this.societyId)));
    if (!v) throw new NotFoundException('Visitor not found.');
    return v;
  }

  private async visitView(id: string) {
    const [r] = await this.db.select(this.visitColumns()).from(visitors).where(eq(visitors.id, id));
    return this.shape(r);
  }

  // ---------------------------------------------------------------- gate desk

  /** What the guard needs now: waiting for residents, approved but not in yet, and inside. */
  async gate(userId: string) {
    await this.assertGate(userId);
    const since = new Date(Date.now() - WAIT_WINDOW_MS);
    const rows = await this.db
      .select(this.visitColumns())
      .from(visitors)
      .where(
        and(
          eq(visitors.societyId, this.societyId),
          or(
            and(inArray(visitors.status, ['PENDING', 'APPROVED', 'DENIED']), gte(visitors.entryTime, since)),
            eq(visitors.status, 'INSIDE'),
          ),
        ),
      )
      .orderBy(desc(visitors.entryTime));
    const all = rows.map((r) => this.shape(r));
    return {
      waiting: all.filter((v) => v.status === 'PENDING'),
      approved: all.filter((v) => v.status === 'APPROVED'),
      denied: all.filter((v) => v.status === 'DENIED').slice(0, 10),
      inside: all.filter((v) => v.status === 'INSIDE'),
    };
  }

  /** The guard logs a walk-in. It waits for the resident's approval unless they already confirmed by phone. */
  async logWalkIn(dto: WalkInDto, userId: string) {
    await this.assertGate(userId);
    await this.assertFlat(dto.flatId);
    const now = new Date();
    const confirmed = dto.confirmedByPhone;
    const { confirmedByPhone, ...fields } = dto;
    const [row] = await this.db
      .insert(visitors)
      .values({
        ...fields,
        societyId: this.societyId,
        entryTime: now,
        status: confirmed ? 'INSIDE' : 'PENDING',
        enteredAt: confirmed ? now : null,
        approvalMethod: confirmed ? 'GUARD_CALL' : null,
        decidedBy: confirmed ? userId : null,
        decidedAt: confirmed ? now : null,
        decisionNote: confirmed ? 'Resident confirmed by phone' : null,
        loggedBy: userId,
      })
      .returning();
    const view = await this.visitView(row.id);
    const who = `${dto.name}${dto.headcount > 1 ? ` (+${dto.headcount - 1})` : ''}${dto.company ? `, ${dto.company}` : ''}`;
    await this.tellFlat(
      dto.flatId,
      confirmed ? `${TYPE_LABEL[dto.type]} let in` : `${TYPE_LABEL[dto.type]} at the gate`,
      confirmed ? `${who} was let in after you confirmed by phone.` : `${who} is at the gate for ${view.flatLabel}. Open Visitors to allow or deny.`,
    );
    await this.audit(userId, confirmed ? 'VISITOR_LET_IN' : 'VISITOR_LOGGED', row.id, { name: dto.name, flatId: dto.flatId });
    return view;
  }

  /** A resident of the flat approves or denies a waiting visitor. */
  async residentDecision(id: string, approve: boolean, note: string | null, userId: string) {
    const v = await this.visit(id);
    const me = await this.actor(userId);
    if (!me.flatIds.includes(v.flatId)) throw new NotFoundException('Visitor not found.');
    return this.decide(v, approve, note, userId, 'RESIDENT_APP');
  }

  /** The guard records the resident's answer given on the phone (or turns the visitor away). */
  async guardDecision(id: string, approve: boolean, note: string | null, userId: string) {
    await this.assertGate(userId);
    const v = await this.visit(id);
    return this.decide(v, approve, note || (approve ? 'Resident confirmed by phone' : null), userId, 'GUARD_CALL', approve);
  }

  private async decide(v: Visit, approve: boolean, note: string | null, userId: string, method: string, letInNow = false) {
    if (v.status !== 'PENDING') throw new ConflictException(v.status === 'DENIED' ? 'This visitor was already turned away.' : 'Someone has already answered for this visitor.');
    const now = new Date();
    const [row] = await this.db
      .update(visitors)
      .set({
        status: approve ? (letInNow ? 'INSIDE' : 'APPROVED') : 'DENIED',
        enteredAt: approve && letInNow ? now : null,
        approvalMethod: approve ? method : null,
        decidedBy: userId,
        decidedAt: now,
        decisionNote: note,
      })
      .where(and(eq(visitors.id, v.id), eq(visitors.status, 'PENDING')))
      .returning({ id: visitors.id });
    if (!row) throw new ConflictException('Someone has already answered for this visitor.');
    await this.audit(userId, approve ? 'VISITOR_APPROVED' : 'VISITOR_DENIED', v.id, { method, note });
    return this.visitView(v.id);
  }

  async letIn(id: string, userId: string) {
    await this.assertGate(userId);
    const [row] = await this.db
      .update(visitors)
      .set({ status: 'INSIDE', enteredAt: new Date() })
      .where(and(eq(visitors.id, id), eq(visitors.societyId, this.societyId), eq(visitors.status, 'APPROVED')))
      .returning({ id: visitors.id });
    if (!row) throw new ConflictException('Only approved visitors can be let in.');
    return this.visitView(id);
  }

  async markExit(id: string, userId: string) {
    await this.assertGate(userId);
    const [row] = await this.db
      .update(visitors)
      .set({ status: 'EXITED', exitTime: new Date() })
      .where(and(eq(visitors.id, id), eq(visitors.societyId, this.societyId), eq(visitors.status, 'INSIDE')))
      .returning({ id: visitors.id });
    if (!row) throw new ConflictException('This visitor is not marked as inside.');
    return this.visitView(id);
  }

  // ---------------------------------------------------------------- codes (passes and daily help)

  /** A fresh 6-digit code not used by a live pass or daily help in this society. */
  private async newCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = String(randomInt(100000, 1000000));
      const [pass] = await this.db
        .select({ id: visitorPasses.id })
        .from(visitorPasses)
        .where(and(eq(visitorPasses.societyId, this.societyId), eq(visitorPasses.code, code), gt(visitorPasses.validUntil, new Date()), isNull(visitorPasses.revokedAt)));
      const [help] = await this.db
        .select({ id: dailyHelp.id })
        .from(dailyHelp)
        .where(and(eq(dailyHelp.societyId, this.societyId), eq(dailyHelp.code, code)));
      if (!pass && !help) return code;
    }
    throw new ConflictException('Could not create a code. Please try again.');
  }

  /** What a code at the gate stands for: a guest pass or a daily help, and whether it is valid now. */
  async checkCode(code: string, userId: string) {
    await this.assertGate(userId);
    const clean = code.replace(/\D/g, '');
    const now = new Date();
    const [pass] = await this.db
      .select({ pass: visitorPasses, flatLabel: sql<string>`(select coalesce(w.name || '-', '') || f.number from flats f left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id where f.id = ${visitorPasses.flatId})`, hostName: users.name })
      .from(visitorPasses)
      .leftJoin(users, eq(users.id, visitorPasses.createdBy))
      .where(and(eq(visitorPasses.societyId, this.societyId), eq(visitorPasses.code, clean)))
      .orderBy(desc(visitorPasses.createdAt))
      .limit(1);
    if (pass) {
      const p = pass.pass;
      const problem = p.revokedAt
        ? 'This pass was cancelled by the resident.'
        : now < p.validFrom
          ? `This pass is valid from ${fmtTime(p.validFrom)}.`
          : now > p.validUntil
            ? 'This pass has expired.'
            : p.usesCount >= p.maxUses
              ? 'This pass has already been used.'
              : null;
      return { kind: 'PASS' as const, valid: !problem, problem, pass: { ...p, flatLabel: pass.flatLabel, hostName: pass.hostName } };
    }
    const [help] = await this.db.select().from(dailyHelp).where(and(eq(dailyHelp.societyId, this.societyId), eq(dailyHelp.code, clean)));
    if (help) {
      const helpFlats = await this.helpFlats(help.id);
      const [inside] = await this.db
        .select({ id: visitors.id })
        .from(visitors)
        .where(and(eq(visitors.dailyHelpId, help.id), eq(visitors.status, 'INSIDE')));
      const problem = !help.isActive ? 'This person is blocked by the society office.' : !helpFlats.length ? 'Not linked to any flat.' : null;
      return { kind: 'DAILY_HELP' as const, valid: !problem, problem, help: { ...help, flats: helpFlats, insideVisitId: inside?.id || null } };
    }
    throw new NotFoundException('No pass or daily help with this code.');
  }

  /** Lets someone in on a code: a valid pass (used once more) or daily help (for one of their flats). */
  async enterWithCode(code: string, flatId: string | null, gateNo: string | null, userId: string) {
    const check = await this.checkCode(code, userId);
    if (!check.valid) throw new ConflictException(check.problem);
    const now = new Date();

    if (check.kind === 'PASS') {
      const p = check.pass;
      const visitId = await this.db.transaction(async (tx) => {
        const [used] = await tx
          .update(visitorPasses)
          .set({ usesCount: sql`${visitorPasses.usesCount} + 1` })
          .where(and(eq(visitorPasses.id, p.id), lt(visitorPasses.usesCount, visitorPasses.maxUses), isNull(visitorPasses.revokedAt)))
          .returning({ id: visitorPasses.id });
        if (!used) throw new ConflictException('This pass has already been used.');
        const [row] = await tx
          .insert(visitors)
          .values({
            societyId: this.societyId,
            flatId: p.flatId,
            name: p.guestName,
            mobile: p.guestMobile || '-',
            type: p.type,
            vehicleNumber: p.vehicleNumber,
            purpose: p.notes,
            entryTime: now,
            enteredAt: now,
            status: 'INSIDE',
            approvalMethod: 'PASS',
            decidedBy: p.createdBy,
            decidedAt: p.createdAt,
            loggedBy: userId,
            passId: p.id,
            gateNo,
          })
          .returning({ id: visitors.id });
        return row.id;
      });
      if (p.createdBy) {
        await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId: p.createdBy, title: 'Your guest has arrived', body: `${p.guestName} came in with your pass.` });
      }
      await this.audit(userId, 'VISITOR_PASS_USED', visitId, { passId: p.id });
      return this.visitView(visitId);
    }

    const h = check.help;
    if (h.insideVisitId) throw new ConflictException(`${h.name} is already inside. Mark their exit first.`);
    const target = flatId ? h.flats.find((f) => f.flatId === flatId) : h.flats.length === 1 ? h.flats[0] : null;
    if (!target) throw new BadRequestException(`Which flat is ${h.name} going to? (${h.flats.map((f) => f.flatLabel).join(', ')})`);
    const [row] = await this.db
      .insert(visitors)
      .values({
        societyId: this.societyId,
        flatId: target.flatId,
        name: h.name,
        mobile: h.mobile,
        type: 'DAILY_HELP',
        company: h.category,
        entryTime: now,
        enteredAt: now,
        status: 'INSIDE',
        approvalMethod: 'DAILY_HELP',
        loggedBy: userId,
        dailyHelpId: h.id,
        gateNo,
      })
      .returning({ id: visitors.id });
    return this.visitView(row.id);
  }

  // ---------------------------------------------------------------- resident

  /** Visits to my flats in the last 60 days, waiting ones first. */
  async mine(userId: string) {
    const me = await this.actor(userId);
    if (!me.flatIds.length) return { flats: [], visits: [] };
    const rows = await this.db
      .select(this.visitColumns())
      .from(visitors)
      .where(and(eq(visitors.societyId, this.societyId), inArray(visitors.flatId, me.flatIds), gte(visitors.entryTime, new Date(Date.now() - 60 * 86400_000))))
      .orderBy(desc(visitors.entryTime))
      .limit(300);
    const visits = rows.map((r) => this.shape(r));
    visits.sort((a, b) => Number(b.status === 'PENDING' && !b.noResponse) - Number(a.status === 'PENDING' && !a.noResponse));
    return { flats: await this.flatOptions(me.flatIds), visits };
  }

  private async flatOptions(flatIds: string[]) {
    if (!flatIds.length) return [];
    const rows = await this.db
      .select({ id: flats.id, number: flats.number, wing: wings.name })
      .from(flats)
      .leftJoin(floors, eq(floors.id, flats.floorId))
      .leftJoin(wings, eq(wings.id, floors.wingId))
      .where(inArray(flats.id, flatIds));
    return rows.map((r) => ({ id: r.id, label: r.wing ? `${r.wing}-${r.number}` : r.number }));
  }

  // ---------------------------------------------------------------- passes

  async listPasses(userId: string) {
    const me = await this.actor(userId);
    if (!me.flatIds.length) return [];
    const rows = await this.db
      .select()
      .from(visitorPasses)
      .where(and(eq(visitorPasses.societyId, this.societyId), inArray(visitorPasses.flatId, me.flatIds), gte(visitorPasses.validUntil, new Date(Date.now() - 7 * 86400_000))))
      .orderBy(desc(visitorPasses.validFrom));
    const now = new Date();
    return rows.map((p) => ({
      ...p,
      state: p.revokedAt ? 'CANCELLED' : p.usesCount >= p.maxUses ? 'USED' : now > p.validUntil ? 'EXPIRED' : now < p.validFrom ? 'UPCOMING' : 'ACTIVE',
    }));
  }

  async createPass(dto: PassDto, userId: string) {
    const me = await this.actor(userId);
    const flatId = dto.flatId || me.flatIds[0];
    if (!flatId || !me.flatIds.includes(flatId)) throw new ForbiddenException('You can create passes only for your own flat.');
    if (new Date(dto.validUntil).getTime() <= Date.now()) throw new BadRequestException('The pass must still be valid in the future.');
    const [row] = await this.db
      .insert(visitorPasses)
      .values({
        ...dto,
        flatId,
        societyId: this.societyId,
        createdBy: userId,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        code: await this.newCode(),
      })
      .returning();
    await this.audit(userId, 'VISITOR_PASS_CREATE', row.id, { guestName: dto.guestName });
    return { ...row, state: new Date() < row.validFrom ? 'UPCOMING' : 'ACTIVE' };
  }

  async revokePass(id: string, userId: string) {
    const me = await this.actor(userId);
    const [p] = await this.db.select().from(visitorPasses).where(and(eq(visitorPasses.id, id), eq(visitorPasses.societyId, this.societyId)));
    if (!p || !me.flatIds.includes(p.flatId)) throw new NotFoundException('Pass not found.');
    await this.db.update(visitorPasses).set({ revokedAt: new Date() }).where(eq(visitorPasses.id, id));
    return { id, state: 'CANCELLED' };
  }

  // ---------------------------------------------------------------- daily help

  private async helpFlats(helpId: string) {
    const rows = (await this.db.execute(sql`
      select dhf.flat_id as "flatId", coalesce(w.name || '-', '') || f.number as "flatLabel"
      from daily_help_flats dhf join flats f on f.id = dhf.flat_id
      left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id
      where dhf.daily_help_id = ${helpId}
      order by 2
    `)) as unknown as { flatId: string; flatLabel: string }[];
    return rows;
  }

  /** Residents: helpers of their flats with the last 30 days of entries. Gate/office: everyone. */
  async listDailyHelp(userId: string) {
    const me = await this.actor(userId);
    const helpers = await this.db
      .select()
      .from(dailyHelp)
      .where(
        and(
          eq(dailyHelp.societyId, this.societyId),
          me.isGate
            ? undefined
            : me.flatIds.length
              ? sql`${dailyHelp.id} in (select daily_help_id from daily_help_flats where flat_id in ${me.flatIds})`
              : sql`false`,
        ),
      )
      .orderBy(dailyHelp.name);
    const out = [];
    for (const h of helpers) {
      const linked = await this.helpFlats(h.id);
      const visibleFlats = me.isGate ? linked.map((f) => f.flatId) : linked.filter((f) => me.flatIds.includes(f.flatId)).map((f) => f.flatId);
      const visits = visibleFlats.length
        ? await this.db
            .select({ id: visitors.id, flatId: visitors.flatId, enteredAt: visitors.enteredAt, exitTime: visitors.exitTime, status: visitors.status })
            .from(visitors)
            .where(and(eq(visitors.dailyHelpId, h.id), inArray(visitors.flatId, visibleFlats), gte(visitors.entryTime, new Date(Date.now() - 30 * 86400_000))))
            .orderBy(desc(visitors.entryTime))
            .limit(60)
        : [];
      out.push({
        ...h,
        // Residents see only their own flats among the helper's employers.
        flats: me.isGate ? linked : linked.filter((f) => me.flatIds.includes(f.flatId)),
        otherFlatsCount: me.isGate ? 0 : linked.length - visibleFlats.length,
        code: me.isGate || visibleFlats.length ? h.code : null,
        isInside: visits.some((v) => v.status === 'INSIDE'),
        recent: visits,
      });
    }
    return out;
  }

  /** Adds a helper to a flat; someone already registered (same mobile) is linked instead of duplicated. */
  async addDailyHelp(dto: DailyHelpDto, userId: string) {
    const me = await this.actor(userId);
    const flatId = dto.flatId || (!me.isGate ? me.flatIds[0] : null);
    if (!flatId) throw new BadRequestException('Choose the flat.');
    if (!me.isGate && !me.flatIds.includes(flatId)) throw new ForbiddenException('You can add help only to your own flat.');
    await this.assertFlat(flatId);

    let [help] = await this.db.select().from(dailyHelp).where(and(eq(dailyHelp.societyId, this.societyId), eq(dailyHelp.mobile, dto.mobile)));
    const existed = !!help;
    if (!help) {
      [help] = await this.db
        .insert(dailyHelp)
        .values({ societyId: this.societyId, name: dto.name, mobile: dto.mobile, category: dto.category, code: await this.newCode(), createdBy: userId })
        .returning();
    } else if (!help.isActive) {
      throw new ConflictException(`${help.name} has been blocked by the society office. Please contact the office.`);
    }
    await this.db.insert(dailyHelpFlats).values({ societyId: this.societyId, dailyHelpId: help.id, flatId, addedBy: userId }).onConflictDoNothing();
    await this.audit(userId, 'DAILY_HELP_ADD', help.id, { flatId, name: help.name });
    return { ...help, linkedExisting: existed };
  }

  async removeDailyHelp(helpId: string, flatId: string, userId: string) {
    const me = await this.actor(userId);
    if (!me.isGate && !me.flatIds.includes(flatId)) throw new ForbiddenException('You can remove help only from your own flat.');
    const [h] = await this.db.select({ id: dailyHelp.id }).from(dailyHelp).where(and(eq(dailyHelp.id, helpId), eq(dailyHelp.societyId, this.societyId)));
    if (!h) throw new NotFoundException('Not found.');
    await this.db.delete(dailyHelpFlats).where(and(eq(dailyHelpFlats.dailyHelpId, helpId), eq(dailyHelpFlats.flatId, flatId)));
    await this.audit(userId, 'DAILY_HELP_REMOVE', helpId, { flatId });
    return { removed: true };
  }

  /** The office blocks or unblocks a helper at the gate. */
  async setHelpActive(helpId: string, isActive: boolean, userId: string) {
    await this.assertGate(userId);
    const [row] = await this.db
      .update(dailyHelp)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(dailyHelp.id, helpId), eq(dailyHelp.societyId, this.societyId)))
      .returning();
    if (!row) throw new NotFoundException('Not found.');
    await this.audit(userId, isActive ? 'DAILY_HELP_UNBLOCK' : 'DAILY_HELP_BLOCK', helpId, null);
    return row;
  }

  // ---------------------------------------------------------------- log & reports

  async log(userId: string, q: { from?: string; to?: string; flatId?: string; type?: string; status?: string; search?: string }) {
    await this.assertGate(userId);
    const from = q.from ? new Date(`${q.from}T00:00:00+05:30`) : new Date(Date.now() - 7 * 86400_000);
    const to = q.to ? new Date(`${q.to}T23:59:59.999+05:30`) : new Date();
    if (isNaN(+from) || isNaN(+to)) throw new BadRequestException('Use valid dates.');
    const where = [eq(visitors.societyId, this.societyId), gte(visitors.entryTime, from), lte(visitors.entryTime, to)];
    if (q.flatId) where.push(eq(visitors.flatId, q.flatId));
    if (q.type) where.push(eq(visitors.type, q.type));
    if (q.status) where.push(eq(visitors.status, q.status));
    if (q.search) {
      const s = `%${q.search.trim()}%`;
      where.push(or(sql`${visitors.name} ilike ${s}`, sql`${visitors.mobile} ilike ${s}`, sql`${visitors.vehicleNumber} ilike ${s}`)!);
    }
    const rows = await this.db.select(this.visitColumns()).from(visitors).where(and(...where)).orderBy(desc(visitors.entryTime)).limit(2000);
    const visits = rows.map((r) => this.shape(r));
    const byType: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const v of visits) {
      byType[v.type] = (byType[v.type] || 0) + v.headcount;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(v.entryTime));
      byDay[day] = (byDay[day] || 0) + v.headcount;
    }
    return {
      visits,
      summary: {
        total: visits.reduce((n, v) => n + v.headcount, 0),
        denied: visits.filter((v) => v.status === 'DENIED').length,
        insideNow: visits.filter((v) => v.status === 'INSIDE').length,
        byType,
        byDay,
      },
    };
  }

  // ---------------------------------------------------------------- helpers

  private async tellFlat(flatId: string, title: string, body: string) {
    for (const recipientUserId of await this.residentsOf(flatId)) {
      await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId, title, body });
    }
  }

  private async audit(userId: string | undefined, action: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({ societyId: this.societyId, userId: userId || null, action, entityName: 'visitors', entityId, newValues } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
