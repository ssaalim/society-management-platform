import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { meetingResolutions, resolutionVotes, users } from '../../../database/schema';
import { NotificationService } from '../notification/notification.service';
import { MeetingAccess, Viewer, VotingUnit } from './meeting-access.service';
import { MeetingService } from './meeting.service';
import { ResolutionDto } from './dto/meeting.dto';

type Resolution = typeof meetingResolutions.$inferSelect;
type Vote = typeof resolutionVotes.$inferSelect & { voterName: string | null; recorderName: string | null; proxyName: string | null };

const THRESHOLD_LABEL: Record<string, string> = { SIMPLE: 'simple majority', TWO_THIRDS: 'two-thirds majority', THREE_QUARTERS: 'three-quarters majority' };
const fmtWhen = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** Passing rule: FOR votes against votes cast (FOR + AGAINST; abstentions don't count). */
export function decide(threshold: string, forN: number, againstN: number): 'PASSED' | 'FAILED' {
  const cast = forN + againstN;
  if (cast === 0) return 'FAILED';
  if (threshold === 'TWO_THIRDS') return forN * 3 >= cast * 2 ? 'PASSED' : 'FAILED';
  if (threshold === 'THREE_QUARTERS') return forN * 4 >= cast * 3 ? 'PASSED' : 'FAILED';
  return forN > againstN ? 'PASSED' : 'FAILED';
}

/**
 * Resolutions put to the vote: eligible voters (owners by default) vote For / Against / Abstain until the deadline, one
 * vote per flat by default and changeable until then. After the deadline the secretary can extend it, or record a
 * member's vote that they confirmed in person ("recorded by secretary"), and then closes it to declare the result.
 */
@Injectable()
export class ResolutionService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly access: MeetingAccess,
    private readonly meetings: MeetingService,
    private readonly notificationService: NotificationService,
  ) {}

  private get societyId() {
    return this.access.societyId;
  }

  private async resolution(id: string, v: Viewer): Promise<Resolution> {
    const [r] = await this.db
      .select()
      .from(meetingResolutions)
      .where(and(eq(meetingResolutions.id, id), eq(meetingResolutions.societyId, this.societyId)));
    if (!r) throw new NotFoundException('Resolution not found.');
    await this.access.meetingFor(r.meetingId, v); // visibility follows the meeting
    if (r.status === 'DRAFT' && !v.isManager) throw new NotFoundException('Resolution not found.');
    return r;
  }

  private async votes(resolutionId: string): Promise<Vote[]> {
    const rows = await this.db
      .select({
        vote: resolutionVotes,
        voterName: users.name,
        recorderName: sql<string | null>`(select u2.name from users u2 where u2.id = ${resolutionVotes.recordedBy})`,
        proxyName: sql<string | null>`(select u3.name from users u3 where u3.id = ${resolutionVotes.castByProxyUserId})`,
      })
      .from(resolutionVotes)
      .leftJoin(users, eq(users.id, resolutionVotes.userId))
      .where(eq(resolutionVotes.resolutionId, resolutionId));
    return rows.map((r) => ({ ...r.vote, voterName: r.voterName, recorderName: r.recorderName, proxyName: r.proxyName }));
  }

  private units(r: Resolution) {
    return this.access.votingUnits(r.voters, r.voters === 'COMMITTEE' ? false : r.onePerFlat);
  }

  /**
   * The ballots this person can cast: their own units, plus (when the meeting allows proxies) the units of members who
   * appointed them as proxy. `actingFor` is the member the vote is recorded for.
   */
  private async myUnits(r: Resolution, userId: string, units?: VotingUnit[]) {
    const all = units || (await this.units(r));
    const out: { unit: VotingUnit; actingFor: string; forName: string | null }[] = all
      .filter((u) => u.userIds.includes(userId))
      .map((u) => ({ unit: u, actingFor: userId, forName: null }));
    const proxies = (await this.db.execute(sql`
      select p.member_user_id as "memberUserId" from meeting_proxies p join meetings m on m.id = p.meeting_id
      where p.meeting_id = ${r.meetingId} and p.proxy_user_id = ${userId} and p.revoked_at is null and m.allow_proxy
    `)) as unknown as { memberUserId: string }[];
    for (const p of proxies) {
      for (const u of all.filter((x) => x.userIds.includes(p.memberUserId))) {
        if (out.some((o) => o.unit.key === u.key)) continue; // already theirs (e.g. the same flat)
        out.push({ unit: u, actingFor: p.memberUserId, forName: u.names[u.userIds.indexOf(p.memberUserId)] || 'a member' });
      }
    }
    return out;
  }

  private voteFor(unit: VotingUnit, votes: Vote[]) {
    return votes.find((x) => (unit.flatId ? x.flatId === unit.flatId : !x.flatId && x.userId === unit.key));
  }

  private tally(votes: Vote[]) {
    const t = { FOR: 0, AGAINST: 0, ABSTAIN: 0 } as Record<string, number>;
    votes.forEach((x) => (t[x.choice] = (t[x.choice] || 0) + 1));
    return t;
  }

  /** A meeting's resolutions as this person sees them. */
  async list(meetingId: string, userId: string) {
    const v = await this.access.viewer(userId);
    await this.access.meetingFor(meetingId, v);
    const rows = await this.db
      .select()
      .from(meetingResolutions)
      .where(eq(meetingResolutions.meetingId, meetingId))
      .orderBy(asc(meetingResolutions.number));
    const out = [];
    for (const r of rows) {
      if (r.status === 'DRAFT' && !v.isManager) continue;
      out.push(await this.view(r, v));
    }
    return out;
  }

  private async view(r: Resolution, v: Viewer) {
    const [units, votes] = await Promise.all([this.units(r), this.votes(r.id)]);
    const deadlinePassed = !!r.votingDeadline && new Date(r.votingDeadline).getTime() <= Date.now();
    const canVoteNow = r.status === 'OPEN' && !deadlinePassed;
    const myBallots = (await this.myUnits(r, v.userId, units)).map(({ unit: u, actingFor, forName }) => {
      const vote = this.voteFor(u, votes);
      const mineToChange = !!vote && vote.userId === actingFor && !vote.recordedBy;
      return {
        flatId: u.flatId,
        label: forName ? `${u.label} for ${forName.replace(/\s*\(.*\)$/, '')} (as proxy)` : u.label,
        onBehalfOf: forName ? actingFor : null,
        choice: vote?.choice || null,
        castByMe: !!vote && !vote.recordedBy && (vote.castByProxyUserId ? vote.castByProxyUserId === v.userId : vote.userId === v.userId),
        castBy: vote && vote.userId !== actingFor ? vote.voterName : vote?.castByProxyUserId && vote.castByProxyUserId !== v.userId ? `${vote.proxyName} (proxy)` : null,
        recordedBySecretary: !!vote?.recordedBy,
        canChange: canVoteNow && (!vote || mineToChange),
      };
    });
    const showResults = r.status === 'CLOSED' || v.isManager;
    const live = this.tally(votes);
    return {
      ...r,
      thresholdLabel: THRESHOLD_LABEL[r.threshold] || r.threshold,
      eligibleCount: units.length,
      votedCount: votes.length,
      deadlinePassed,
      canVoteNow,
      myBallots,
      // Running totals only for the office until voting closes, so early results don't sway anyone.
      tally: showResults ? (r.status === 'CLOSED' ? { FOR: r.forCount ?? 0, AGAINST: r.againstCount ?? 0, ABSTAIN: r.abstainCount ?? 0 } : live) : null,
      projected: v.isManager && r.status === 'OPEN' ? decide(r.threshold, live.FOR, live.AGAINST) : null,
      // The voter roll is for the office.
      roll: v.isManager
        ? units.map((u) => {
            const vote = this.voteFor(u, votes);
            return {
              key: u.key,
              flatId: u.flatId,
              label: u.label,
              userIds: u.userIds,
              names: u.names,
              choice: vote?.choice || null,
              voterName: vote?.voterName || null,
              recordedBy: vote?.recorderName || null,
              recordedNote: vote?.recordedNote || null,
              castByProxy: vote?.castByProxyUserId ? vote.proxyName : null,
            };
          })
        : null,
    };
  }

  async get(id: string, userId: string) {
    const v = await this.access.viewer(userId);
    return this.view(await this.resolution(id, v), v);
  }

  // ---------------------------------------------------------------- drafting

  async create(meetingId: string, dto: ResolutionDto, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(meetingId, v);
    if (m.status === 'CANCELLED') throw new ConflictException('This meeting is cancelled.');
    const [{ next }] = await this.db
      .select({ next: sql<number>`coalesce(max(${meetingResolutions.number}), 0)::int + 1` })
      .from(meetingResolutions)
      .where(eq(meetingResolutions.meetingId, meetingId));
    const [row] = await this.db
      .insert(meetingResolutions)
      .values({ ...dto, onePerFlat: dto.voters === 'COMMITTEE' ? false : dto.onePerFlat, meetingId, societyId: this.societyId, number: next, status: 'DRAFT' })
      .returning();
    await this.meetings.audit(userId, 'RESOLUTION_CREATE', row.id, row);
    return this.view(row, v);
  }

  async update(id: string, dto: ResolutionDto, userId: string) {
    const v = await this.access.assertManager(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'DRAFT') throw new ConflictException('A resolution can be edited only before voting opens.');
    const [row] = await this.db
      .update(meetingResolutions)
      .set({ ...dto, onePerFlat: dto.voters === 'COMMITTEE' ? false : dto.onePerFlat, updatedAt: new Date() })
      .where(eq(meetingResolutions.id, id))
      .returning();
    return this.view(row, v);
  }

  async remove(id: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'DRAFT') throw new ConflictException('Only resolutions that were never put to the vote can be deleted.');
    await this.db.delete(meetingResolutions).where(eq(meetingResolutions.id, id));
    return { deleted: true };
  }

  // ---------------------------------------------------------------- voting

  async openVoting(id: string, deadline: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'DRAFT') throw new ConflictException('Voting has already been opened.');
    const m = await this.access.meetingFor(r.meetingId, v);
    if (!['SCHEDULED', 'HELD'].includes(m.status)) throw new ConflictException('Send the meeting notice before opening the vote.');
    const when = new Date(deadline);
    if (when.getTime() <= Date.now()) throw new BadRequestException('Choose a deadline in the future.');
    const units = await this.units(r);
    if (!units.length) throw new BadRequestException('Nobody is eligible to vote on this resolution.');
    const remindAt = new Date(when.getTime() - 24 * 3600_000);
    const soon = remindAt.getTime() <= Date.now();
    const [row] = await this.db
      .update(meetingResolutions)
      .set({ status: 'OPEN', votingDeadline: when, reminderSentAt: soon ? new Date() : null, updatedAt: new Date() })
      .where(eq(meetingResolutions.id, id))
      .returning();
    if (!soon) this.access.reminderDue(remindAt);
    await this.meetings.audit(userId, 'RESOLUTION_OPEN', id, { deadline });
    await this.notify(units, `Vote: ${r.title}`, `Resolution ${r.number} of ${m.title} is open for voting until ${fmtWhen(when)}.`);
    return this.view(row, v);
  }

  async extend(id: string, deadline: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'OPEN') throw new ConflictException('Only open votes can be extended.');
    const when = new Date(deadline);
    if (when.getTime() <= Date.now() || (r.votingDeadline && when <= r.votingDeadline)) {
      throw new BadRequestException('The new deadline must be later than the current one and in the future.');
    }
    const remindAt = new Date(when.getTime() - 24 * 3600_000);
    const soon = remindAt.getTime() <= Date.now();
    const [row] = await this.db
      .update(meetingResolutions)
      .set({ votingDeadline: when, reminderSentAt: soon ? new Date() : null, updatedAt: new Date() })
      .where(eq(meetingResolutions.id, id))
      .returning();
    if (!soon) this.access.reminderDue(remindAt);
    await this.meetings.audit(userId, 'RESOLUTION_EXTEND', id, { deadline });
    const voted = new Set((await this.votes(id)).map((x) => x.flatId || x.userId));
    const pending = (await this.units(r)).filter((u) => !voted.has(u.flatId || u.key));
    await this.notify(pending, `Vote extended: ${r.title}`, `You can still vote until ${fmtWhen(when)}.`);
    return this.view(row, v);
  }

  /** A member votes for each of their flats (or the one given); a co-owner's vote for a flat stands. */
  async vote(id: string, choice: string, flatId: string | null, userId: string, onBehalfOf: string | null = null) {
    const v = await this.access.viewer(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'OPEN') throw new ConflictException('Voting is not open.');
    if (r.votingDeadline && new Date(r.votingDeadline).getTime() <= Date.now()) throw new ConflictException('The voting deadline has passed.');
    let mine = await this.myUnits(r, userId);
    if (!mine.length) throw new ForbiddenException('You are not eligible to vote on this resolution.');
    // Own ballots by default; a proxy names the member they are voting for.
    mine = mine.filter((b) => b.actingFor === (onBehalfOf || userId));
    if (!mine.length) throw new ForbiddenException(onBehalfOf ? 'You are not this member’s proxy for this meeting.' : 'You are not eligible to vote on this resolution.');
    if (flatId) {
      mine = mine.filter((b) => b.unit.flatId === flatId);
      if (!mine.length) throw new ForbiddenException('You cannot vote for that flat.');
    }

    let cast = 0;
    const blocked: string[] = [];
    await this.db.transaction(async (tx) => {
      // Serialise votes on this resolution so a flat can't get two.
      await tx.select({ id: meetingResolutions.id }).from(meetingResolutions).where(eq(meetingResolutions.id, id)).for('update');
      for (const { unit: u, actingFor } of mine) {
        const [existing] = await tx
          .select()
          .from(resolutionVotes)
          .where(and(eq(resolutionVotes.resolutionId, id), u.flatId ? eq(resolutionVotes.flatId, u.flatId) : and(sql`${resolutionVotes.flatId} is null`, eq(resolutionVotes.userId, actingFor))));
        if (existing && (existing.userId !== actingFor || existing.recordedBy)) {
          blocked.push(u.label);
          continue;
        }
        const viaProxy = actingFor !== userId ? userId : null;
        if (existing) await tx.update(resolutionVotes).set({ choice, castByProxyUserId: viaProxy, updatedAt: new Date() }).where(eq(resolutionVotes.id, existing.id));
        else await tx.insert(resolutionVotes).values({ societyId: this.societyId, resolutionId: id, userId: actingFor, flatId: u.flatId, choice, castByProxyUserId: viaProxy });
        cast++;
      }
    });
    if (!cast) throw new ConflictException(`This flat has already voted (${blocked.join(', ')}). The vote stays as cast by the co-owner.`);
    return { ...(await this.view(r, v)), blocked };
  }

  /** After the deadline: the secretary records a vote the member confirmed to them (phone, in person). */
  async recordVote(id: string, dto: { userId: string; flatId: string | null; choice: string; note: string }, userId: string) {
    const v = await this.access.assertManager(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'OPEN') throw new ConflictException('Voting is not open.');
    if (!r.votingDeadline || new Date(r.votingDeadline).getTime() > Date.now()) {
      throw new ConflictException('Members can still vote themselves. Votes can be recorded on their behalf only after the deadline.');
    }
    const unit = (await this.units(r)).find((u) => u.userIds.includes(dto.userId) && (!dto.flatId || u.flatId === dto.flatId));
    if (!unit) throw new BadRequestException('That member is not eligible to vote on this resolution.');
    await this.db.transaction(async (tx) => {
      await tx.select({ id: meetingResolutions.id }).from(meetingResolutions).where(eq(meetingResolutions.id, id)).for('update');
      const [existing] = await tx
        .select({ id: resolutionVotes.id })
        .from(resolutionVotes)
        .where(and(eq(resolutionVotes.resolutionId, id), unit.flatId ? eq(resolutionVotes.flatId, unit.flatId) : and(sql`${resolutionVotes.flatId} is null`, eq(resolutionVotes.userId, dto.userId))));
      if (existing) throw new ConflictException(`${unit.label} has already voted.`);
      await tx.insert(resolutionVotes).values({
        societyId: this.societyId,
        resolutionId: id,
        userId: dto.userId,
        flatId: unit.flatId,
        choice: dto.choice,
        recordedBy: userId,
        recordedNote: dto.note,
      });
    });
    await this.meetings.audit(userId, 'RESOLUTION_VOTE_RECORDED', id, { ...dto, unit: unit.label });
    return this.view(r, v);
  }

  /** Closes voting and declares the result (after the deadline, or earlier once every eligible vote is in). */
  async close(id: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const r = await this.resolution(id, v);
    if (r.status !== 'OPEN') throw new ConflictException('Voting is not open.');
    const [units, votes] = await Promise.all([this.units(r), this.votes(id)]);
    const deadlinePassed = !!r.votingDeadline && new Date(r.votingDeadline).getTime() <= Date.now();
    if (!deadlinePassed && votes.length < units.length) {
      throw new ConflictException(`Voting is open until ${fmtWhen(new Date(r.votingDeadline!))} and ${units.length - votes.length} vote(s) are still to come.`);
    }
    const t = this.tally(votes);
    const result = decide(r.threshold, t.FOR, t.AGAINST);
    const [row] = await this.db
      .update(meetingResolutions)
      .set({ status: 'CLOSED', result, forCount: t.FOR, againstCount: t.AGAINST, abstainCount: t.ABSTAIN, closedAt: new Date(), closedBy: userId, updatedAt: new Date() })
      .where(and(eq(meetingResolutions.id, id), eq(meetingResolutions.status, 'OPEN')))
      .returning();
    if (!row) throw new ConflictException('Voting has already been closed.');
    await this.meetings.audit(userId, 'RESOLUTION_CLOSE', id, { result, ...t });
    await this.notify(units, `Result: ${r.title}`, `${result === 'PASSED' ? 'Passed' : 'Not passed'}: ${t.FOR} for, ${t.AGAINST} against, ${t.ABSTAIN} abstained.`);
    return this.view(row, v);
  }

  /** The day-before-deadline reminder to those who haven't voted. Called by the reminder scheduler (tenant set). */
  async sendVoteReminder(r: Resolution) {
    const voted = new Set((await this.votes(r.id)).map((x) => x.flatId || x.userId));
    const pending = (await this.units(r)).filter((u) => !voted.has(u.flatId || u.key));
    const when = r.votingDeadline ? fmtWhen(new Date(r.votingDeadline)) : 'soon';
    await this.notify(pending, `Vote closes tomorrow: ${r.title}`, `You haven't voted on resolution ${r.number} yet. Voting closes ${when}.`);
    return pending.length;
  }

  private async notify(units: VotingUnit[], title: string, body: string) {
    const people = new Set(units.flatMap((u) => u.userIds));
    for (const recipientUserId of people) {
      await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId, title, body });
    }
  }
}
