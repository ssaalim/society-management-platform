import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import {
  auditLogs,
  meetingActionItems,
  meetingAgendaItems,
  meetingAttendance,
  meetingMinutes,
  meetingProxies,
  meetingResolutions,
  meetingRsvps,
  meetings,
  users,
} from '../../../database/schema';
import { NotificationService } from '../notification/notification.service';
import { Meeting, MeetingAccess, Viewer } from './meeting-access.service';
import { ActionItemDto, AgendaItemDto, MeetingDto } from './dto/meeting.dto';

const TYPE_LABEL: Record<string, string> = { AGM: 'Annual General Meeting', EGM: 'Special General Meeting', COMMITTEE: 'Committee meeting', GENERAL: 'General meeting' };
const DAY = 24 * 60 * 60 * 1000;
const fmtWhen = (d: Date) =>
  d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Meetings and AGMs: notice to invitees, agenda, RSVP (changeable until the meeting starts), attendance marked on the
 * day (quorum), minutes (draft, then final) and action items. Resolutions and voting live in ResolutionService.
 */
@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly access: MeetingAccess,
    private readonly notificationService: NotificationService,
  ) {}

  private get societyId() {
    return this.access.societyId;
  }

  // ---------------------------------------------------------------- list & detail

  /** Meetings this person can see, newest first, with their RSVP and open action counts. */
  async list(userId: string) {
    const v = await this.access.viewer(userId);
    const rows = await this.db
      .select({
        meeting: meetings,
        myRsvp: sql<string | null>`(select r.response from meeting_rsvps r where r.meeting_id = meetings.id and r.user_id = ${userId})`,
        present: sql<number>`(select count(*)::int from meeting_attendance a where a.meeting_id = meetings.id)`,
        openVotes: sql<number>`(select count(*)::int from meeting_resolutions x where x.meeting_id = meetings.id and x.status = 'OPEN')`,
        minutesStatus: sql<string | null>`(select mm.status from meeting_minutes mm where mm.meeting_id = meetings.id)`,
      })
      .from(meetings)
      .where(eq(meetings.societyId, this.societyId))
      .orderBy(desc(meetings.scheduledAt));
    return rows
      .filter((r) => this.access.canSee(r.meeting, v))
      .map((r) => ({
        ...r.meeting,
        typeLabel: TYPE_LABEL[r.meeting.type] || r.meeting.type,
        myRsvp: r.myRsvp,
        present: r.present,
        openVotes: r.openVotes,
        minutesStatus: r.minutesStatus,
      }));
  }

  async detail(id: string, userId: string) {
    const v = await this.access.viewer(userId);
    const m = await this.access.meetingFor(id, v);
    const invitees = await this.access.invitees(m);
    const invited = invitees.some((p) => p.userId === userId);
    const nameOf = new Map(invitees.map((p) => [p.userId, p.name]));

    const [agenda, rsvps, present, minutes, actions, proxies] = await Promise.all([
      this.db.select().from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, id)).orderBy(asc(meetingAgendaItems.position), asc(meetingAgendaItems.createdAt)),
      this.db.select({ userId: meetingRsvps.userId, response: meetingRsvps.response }).from(meetingRsvps).where(eq(meetingRsvps.meetingId, id)),
      this.db.select({ userId: meetingAttendance.userId, viaProxyId: meetingAttendance.viaProxyId }).from(meetingAttendance).where(eq(meetingAttendance.meetingId, id)),
      this.db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, id)),
      this.actionItems(id),
      this.activeProxies(id),
    ]);

    const rsvpOf = new Map(rsvps.map((r) => [r.userId, r.response]));
    const presentOf = new Map(present.map((p) => [p.userId, p]));
    const proxyOf = new Map(proxies.map((p) => [p.memberUserId, p]));
    const proxyLabel = (p: (typeof proxies)[number]) => p.proxyName || (p.proxyUserId ? nameOf.get(p.proxyUserId) || 'a member' : 'a proxy');
    const counts = { ATTENDING: 0, NOT_ATTENDING: 0, TENTATIVE: 0 } as Record<string, number>;
    rsvps.forEach((r) => (counts[r.response] = (counts[r.response] || 0) + 1));

    const inPerson = present.filter((p) => !p.viaProxyId).length;
    const byProxy = present.length - inPerson;
    const forQuorum = inPerson + (m.proxiesCountForQuorum ? byProxy : 0);

    const mm = minutes[0];
    const minutesVisible = !!mm && (v.isManager || mm.status === 'FINAL');
    const started = new Date(m.scheduledAt).getTime() <= Date.now();
    const mine = proxyOf.get(userId);

    return {
      ...m,
      typeLabel: TYPE_LABEL[m.type] || m.type,
      agenda,
      invitedCount: invitees.length,
      invited,
      canManage: v.isManager,
      myRsvp: rsvpOf.get(userId) || null,
      canRsvp: invited && m.status === 'SCHEDULED' && !started,
      rsvpCounts: counts,
      presentCount: present.length,
      presentInPerson: inPerson,
      presentByProxy: byProxy,
      quorumMet: m.quorumRequired ? forQuorum >= m.quorumRequired : null,
      // Proxies: the one I appointed, and the members who appointed me.
      canAppointProxy: m.allowProxy && invited && m.status === 'SCHEDULED' && !started,
      myProxy: mine ? { id: mine.id, proxyUserId: mine.proxyUserId, name: proxyLabel(mine), recordedBySecretary: !!mine.recordedBy } : null,
      proxyFor: proxies.filter((p) => p.proxyUserId === userId).map((p) => ({ memberUserId: p.memberUserId, name: nameOf.get(p.memberUserId) || 'Member' })),
      // The roll (who replied, who was present, proxies) is for the office.
      roll: v.isManager
        ? invitees.map((p) => {
            const pr = proxyOf.get(p.userId);
            const at = presentOf.get(p.userId);
            return {
              userId: p.userId,
              name: p.name,
              rsvp: rsvpOf.get(p.userId) || null,
              present: !!at,
              viaProxy: !!at?.viaProxyId,
              proxy: pr ? { id: pr.id, name: proxyLabel(pr), recordedBySecretary: !!pr.recordedBy } : null,
            };
          })
        : null,
      // Who attended is part of the minutes, so members see it once the meeting is held.
      attendees:
        m.status === 'HELD' && (v.isManager || mm?.status === 'FINAL')
          ? present
              .map((p) => {
                const pr = p.viaProxyId ? proxies.find((x) => x.id === p.viaProxyId) : null;
                return { name: nameOf.get(p.userId) || 'Member', viaProxy: pr ? proxyLabel(pr) : null };
              })
              .sort((a, b) => a.name.localeCompare(b.name))
          : null,
      signatories: await this.signatories(),
      minutes: minutesVisible ? { content: mm.minutesContent, status: mm.status, finalisedAt: mm.finalisedAt } : null,
      minutesStatus: mm?.status || null,
      actionItems: actions,
    };
  }

  /** Active proxies of a meeting. */
  private activeProxies(meetingId: string) {
    return this.db
      .select()
      .from(meetingProxies)
      .where(and(eq(meetingProxies.meetingId, meetingId), isNull(meetingProxies.revokedAt)));
  }

  /** Secretary and chairman of the current committee, for signatures on printed documents. */
  private async signatories() {
    const rows = (await this.db.execute(sql`
      select p.designation, u.name from committee_positions p
      join committee_terms t on t.id = p.term_id and t.status = 'CURRENT'
      join members m on m.id = p.member_id join users u on u.id = m.user_id
      where p.society_id = ${this.societyId} and p.status = 'ACTIVE' and p.designation in ('SECRETARY', 'PRESIDENT')
    `)) as unknown as { designation: string; name: string }[];
    if (!rows.length) {
      // No committee recorded yet: whoever holds the President / Secretary role.
      const byRole = (await this.db.execute(sql`
        select r.name as designation, u.name from user_societies us join roles r on r.id = us.role_id join users u on u.id = us.user_id
        where us.society_id = ${this.societyId} and r.name in ('SECRETARY', 'PRESIDENT')
      `)) as unknown as { designation: string; name: string }[];
      rows.push(...byRole);
    }
    const clean = (n?: string) => (n ? n.replace(/\s*\(.*\)$/, '') : null);
    return {
      secretary: clean(rows.find((r) => r.designation === 'SECRETARY')?.name),
      chairman: clean(rows.find((r) => r.designation === 'PRESIDENT')?.name),
    };
  }

  // ---------------------------------------------------------------- proxies

  /**
   * Who can be chosen as a proxy: other invitees. Residents see flats only (member names stay private); the office
   * sees names too.
   */
  async proxyCandidates(id: string, userId: string) {
    const v = await this.access.viewer(userId);
    const m = await this.access.meetingFor(id, v);
    const invitees = (await this.access.invitees(m)).filter((p) => p.userId !== userId);
    if (!invitees.length) return [];
    const flatsOf = (await this.db.execute(sql`
      select o.user_id as "userId", coalesce(w.name || '-', '') || f.number as label
      from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current join flats f on f.id = fo.flat_id
      left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id
      where o.society_id = ${this.societyId}
      union
      select t.user_id, coalesce(w.name || '-', '') || f.number
      from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active join flats f on f.id = ft.flat_id
      left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id
      where ft.society_id = ${this.societyId}
    `)) as unknown as { userId: string; label: string }[];
    const flatLabels = new Map<string, string[]>();
    for (const f of flatsOf) flatLabels.set(f.userId, [...(flatLabels.get(f.userId) || []), f.label]);
    const out = invitees.map((p) => {
      const flats = (flatLabels.get(p.userId) || []).sort().join(', ');
      return { userId: p.userId, label: v.isManager ? `${p.name}${flats ? ` · ${flats}` : ''}` : flats ? `Member of ${flats}` : 'Member (no flat on record)' };
    });
    // Residents can't tell apart several people of one flat by name; number them.
    const seen = new Map<string, number>();
    return out
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
      .map((c) => {
        const n = (seen.get(c.label) || 0) + 1;
        seen.set(c.label, n);
        return n > 1 ? { ...c, label: `${c.label} (${n})` } : c;
      });
  }

  /** A member appoints their proxy (before the meeting starts, when the meeting allows proxies). */
  async appointProxy(id: string, dto: { proxyUserId: string | null; proxyName: string | null }, userId: string) {
    const v = await this.access.viewer(userId);
    const m = await this.access.meetingFor(id, v);
    if (!m.allowProxy) throw new ForbiddenException('Proxies are not allowed for this meeting.');
    if (m.status !== 'SCHEDULED' || new Date(m.scheduledAt).getTime() <= Date.now()) throw new ConflictException('Proxies can be appointed only before the meeting starts.');
    const invitees = await this.access.invitees(m);
    if (!invitees.some((p) => p.userId === userId)) throw new ForbiddenException('You are not invited to this meeting.');
    await this.saveProxy(m, invitees, userId, dto, null, null);
    return this.detail(id, userId);
  }

  async revokeProxy(id: string, userId: string) {
    const v = await this.access.viewer(userId);
    const m = await this.access.meetingFor(id, v);
    if (m.status !== 'SCHEDULED' || new Date(m.scheduledAt).getTime() <= Date.now()) throw new ConflictException('The meeting has started; the proxy can no longer be withdrawn.');
    const [used] = await this.db
      .select({ id: meetingAttendance.id })
      .from(meetingAttendance)
      .where(and(eq(meetingAttendance.meetingId, id), eq(meetingAttendance.userId, userId), sql`${meetingAttendance.viaProxyId} is not null`));
    if (used) throw new ConflictException('You have been marked present through your proxy, so it can no longer be withdrawn.');
    await this.db
      .update(meetingProxies)
      .set({ revokedAt: new Date() })
      .where(and(eq(meetingProxies.meetingId, id), eq(meetingProxies.memberUserId, userId), isNull(meetingProxies.revokedAt)));
    return this.detail(id, userId);
  }

  /** The secretary records a paper proxy form for a member. */
  async recordProxy(id: string, dto: { memberUserId: string; proxyUserId: string | null; proxyName: string | null; note: string | null }, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (!m.allowProxy) throw new ForbiddenException('Proxies are not allowed for this meeting. Turn them on in the meeting settings.');
    if (!['SCHEDULED', 'HELD'].includes(m.status)) throw new ConflictException('Proxies can be recorded for scheduled or held meetings.');
    const invitees = await this.access.invitees(m);
    if (!invitees.some((p) => p.userId === dto.memberUserId)) throw new BadRequestException('That member is not invited to this meeting.');
    await this.saveProxy(m, invitees, dto.memberUserId, dto, userId, dto.note);
    return this.detail(id, userId);
  }

  async removeProxy(proxyId: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const [p] = await this.db.select().from(meetingProxies).where(and(eq(meetingProxies.id, proxyId), eq(meetingProxies.societyId, this.societyId)));
    if (!p) throw new NotFoundException('Proxy not found.');
    await this.access.meetingFor(p.meetingId, v);
    const [used] = await this.db.select({ id: meetingAttendance.id }).from(meetingAttendance).where(eq(meetingAttendance.viaProxyId, proxyId));
    if (used) throw new ConflictException('This proxy is marked present. Mark the member absent first.');
    await this.db.update(meetingProxies).set({ revokedAt: new Date() }).where(eq(meetingProxies.id, proxyId));
    return this.detail(p.meetingId, userId);
  }

  private async saveProxy(
    m: Meeting,
    invitees: { userId: string; name: string }[],
    memberUserId: string,
    dto: { proxyUserId: string | null; proxyName: string | null },
    recordedBy: string | null,
    note: string | null,
  ) {
    if (dto.proxyUserId) {
      if (dto.proxyUserId === memberUserId) throw new BadRequestException('A member cannot be their own proxy.');
      if (!invitees.some((p) => p.userId === dto.proxyUserId)) throw new BadRequestException('A proxy chosen from the app must be a member invited to this meeting.');
    }
    await this.db.transaction(async (tx) => {
      await tx.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, m.id)).for('update');
      if (dto.proxyUserId) {
        const [{ held }] = await tx
          .select({ held: sql<number>`count(*)::int` })
          .from(meetingProxies)
          .where(and(eq(meetingProxies.meetingId, m.id), eq(meetingProxies.proxyUserId, dto.proxyUserId), isNull(meetingProxies.revokedAt), ne(meetingProxies.memberUserId, memberUserId)));
        if (held >= m.proxyLimit) throw new ConflictException(`That member already represents ${held} member${held === 1 ? '' : 's'}, the most allowed for this meeting.`);
        const [ownProxy] = await tx
          .select({ id: meetingProxies.id })
          .from(meetingProxies)
          .where(and(eq(meetingProxies.meetingId, m.id), eq(meetingProxies.memberUserId, dto.proxyUserId), isNull(meetingProxies.revokedAt)));
        if (ownProxy) throw new ConflictException('That member has appointed a proxy themselves, so they cannot act as one.');
      }
      const [holding] = await tx
        .select({ id: meetingProxies.id })
        .from(meetingProxies)
        .where(and(eq(meetingProxies.meetingId, m.id), eq(meetingProxies.proxyUserId, memberUserId), isNull(meetingProxies.revokedAt)));
      if (holding) throw new ConflictException('This member is acting as a proxy for someone else, so they cannot appoint a proxy themselves.');
      await tx
        .update(meetingProxies)
        .set({ revokedAt: new Date() })
        .where(and(eq(meetingProxies.meetingId, m.id), eq(meetingProxies.memberUserId, memberUserId), isNull(meetingProxies.revokedAt)));
      await tx.insert(meetingProxies).values({
        societyId: this.societyId,
        meetingId: m.id,
        memberUserId,
        proxyUserId: dto.proxyUserId,
        proxyName: dto.proxyUserId ? null : dto.proxyName,
        recordedBy,
        note,
      });
    });
    await this.audit(recordedBy || memberUserId, 'MEETING_PROXY', m.id, { memberUserId, proxyUserId: dto.proxyUserId, proxyName: dto.proxyName });
    if (dto.proxyUserId) {
      const member = invitees.find((p) => p.userId === memberUserId)?.name || 'A member';
      await this.notificationService.createInAppNotification({
        societyId: this.societyId,
        recipientUserId: dto.proxyUserId,
        title: `You are a proxy: ${m.title}`,
        body: `${member} appointed you as their proxy for ${fmtWhen(new Date(m.scheduledAt))}.${m.allowProxy ? ' You can vote for them on resolutions in the app.' : ''}`,
      });
    }
  }

  // ---------------------------------------------------------------- create, notice, cancel

  async create(dto: MeetingDto, userId: string) {
    await this.access.assertManager(userId);
    const [row] = await this.db
      .insert(meetings)
      .values({ ...dto, scheduledAt: new Date(dto.scheduledAt), societyId: this.societyId, status: 'DRAFT', createdBy: userId })
      .returning();
    await this.audit(userId, 'MEETING_CREATE', row.id, row);
    return this.detail(row.id, userId);
  }

  async update(id: string, dto: MeetingDto, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (['HELD', 'CANCELLED'].includes(m.status)) throw new ConflictException('This meeting can no longer be changed.');
    const moved = new Date(dto.scheduledAt).getTime() !== new Date(m.scheduledAt).getTime() || dto.location !== m.location;
    const retimed = new Date(dto.scheduledAt).getTime() !== new Date(m.scheduledAt).getTime();
    const remindAt = new Date(new Date(dto.scheduledAt).getTime() - DAY);
    await this.db
      .update(meetings)
      .set({
        ...dto,
        scheduledAt: new Date(dto.scheduledAt),
        // A new time gets a new reminder (unless it is already within a day).
        ...(retimed && m.status === 'SCHEDULED' ? { reminderSentAt: remindAt.getTime() <= Date.now() ? new Date() : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id));
    if (retimed && m.status === 'SCHEDULED' && remindAt.getTime() > Date.now()) this.access.reminderDue(remindAt);
    await this.audit(userId, 'MEETING_UPDATE', id, dto);
    // Invitees already notified hear about a change of time or place.
    if (m.status === 'SCHEDULED' && moved) {
      await this.notifyAll(await this.access.invitees({ audience: dto.audience }), `Meeting changed: ${dto.title}`, `Now on ${fmtWhen(new Date(dto.scheduledAt))} at ${dto.location}.`);
    }
    return this.detail(id, userId);
  }

  /** Sends the notice: the meeting becomes visible to invitees and they are notified. */
  async sendNotice(id: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (m.status !== 'DRAFT') throw new ConflictException('The notice has already been sent.');
    if (new Date(m.scheduledAt).getTime() < Date.now()) throw new BadRequestException('The meeting time has passed. Change the date first.');
    const [{ n }] = await this.db.select({ n: sql<number>`count(*)::int` }).from(meetingAgendaItems).where(eq(meetingAgendaItems.meetingId, id));
    if (!n) throw new BadRequestException('Add the agenda before sending the notice.');
    // A notice sent less than a day ahead is its own reminder.
    const remindAt = new Date(new Date(m.scheduledAt).getTime() - DAY);
    const soon = remindAt.getTime() <= Date.now();
    await this.db
      .update(meetings)
      .set({ status: 'SCHEDULED', noticeSentAt: new Date(), reminderSentAt: soon ? new Date() : null, updatedAt: new Date() })
      .where(eq(meetings.id, id));
    if (!soon) this.access.reminderDue(remindAt);
    await this.audit(userId, 'MEETING_NOTICE', id, null);
    const invitees = await this.access.invitees(m);
    await this.notifyAll(invitees, `Notice: ${m.title}`, `${TYPE_LABEL[m.type] || 'Meeting'} on ${fmtWhen(new Date(m.scheduledAt))} at ${m.location}. Please let us know if you will attend.`);
    return { ...(await this.detail(id, userId)), notified: invitees.length };
  }

  async cancel(id: string, reason: string | null, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (['HELD', 'CANCELLED'].includes(m.status)) throw new ConflictException('This meeting can no longer be cancelled.');
    await this.db.update(meetings).set({ status: 'CANCELLED', cancelReason: reason, updatedAt: new Date() }).where(eq(meetings.id, id));
    await this.db
      .update(meetingResolutions)
      .set({ status: 'CLOSED', result: 'FAILED', closedAt: new Date(), closedBy: userId, updatedAt: new Date() })
      .where(and(eq(meetingResolutions.meetingId, id), inArray(meetingResolutions.status, ['DRAFT', 'OPEN'])));
    await this.audit(userId, 'MEETING_CANCEL', id, { reason });
    if (m.status === 'SCHEDULED') {
      await this.notifyAll(await this.access.invitees(m), `Cancelled: ${m.title}`, `The meeting on ${fmtWhen(new Date(m.scheduledAt))} is cancelled.${reason ? ` ${reason}` : ''}`);
    }
    return this.detail(id, userId);
  }

  /** Only a draft (never announced) can be deleted. */
  async remove(id: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (m.status !== 'DRAFT') throw new ConflictException('Only drafts can be deleted. Cancel the meeting instead.');
    await this.db.delete(meetings).where(eq(meetings.id, id));
    await this.audit(userId, 'MEETING_DELETE', id, { title: m.title });
    return { deleted: true };
  }

  /** Marks the meeting as held (from its start time); attendance and minutes stay editable until minutes are final. */
  async markHeld(id: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (m.status !== 'SCHEDULED') throw new ConflictException('Only a scheduled meeting can be marked as held.');
    if (new Date(m.scheduledAt).getTime() - Date.now() > 60 * 60 * 1000) throw new BadRequestException('The meeting has not started yet.');
    await this.db.update(meetings).set({ status: 'HELD', updatedAt: new Date() }).where(eq(meetings.id, id));
    await this.audit(userId, 'MEETING_HELD', id, null);
    return this.detail(id, userId);
  }

  // ---------------------------------------------------------------- agenda

  private async editableMeeting(id: string, userId: string): Promise<Meeting> {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (['HELD', 'CANCELLED'].includes(m.status)) throw new ConflictException('The agenda of a held or cancelled meeting cannot change.');
    return m;
  }

  async addAgendaItem(meetingId: string, dto: AgendaItemDto, userId: string) {
    await this.editableMeeting(meetingId, userId);
    const [{ next }] = await this.db
      .select({ next: sql<number>`coalesce(max(${meetingAgendaItems.position}), 0)::int + 1` })
      .from(meetingAgendaItems)
      .where(eq(meetingAgendaItems.meetingId, meetingId));
    await this.db.insert(meetingAgendaItems).values({ ...dto, position: dto.position ?? next, meetingId, societyId: this.societyId });
    return this.detail(meetingId, userId);
  }

  private async agendaItem(itemId: string) {
    const [item] = await this.db
      .select()
      .from(meetingAgendaItems)
      .where(and(eq(meetingAgendaItems.id, itemId), eq(meetingAgendaItems.societyId, this.societyId)));
    if (!item) throw new NotFoundException('Agenda item not found.');
    return item;
  }

  async updateAgendaItem(itemId: string, dto: AgendaItemDto, userId: string) {
    const item = await this.agendaItem(itemId);
    await this.editableMeeting(item.meetingId, userId);
    await this.db
      .update(meetingAgendaItems)
      .set({ title: dto.title, description: dto.description, presenter: dto.presenter, position: dto.position ?? item.position })
      .where(eq(meetingAgendaItems.id, itemId));
    return this.detail(item.meetingId, userId);
  }

  async removeAgendaItem(itemId: string, userId: string) {
    const item = await this.agendaItem(itemId);
    await this.editableMeeting(item.meetingId, userId);
    await this.db.delete(meetingAgendaItems).where(eq(meetingAgendaItems.id, itemId));
    return this.detail(item.meetingId, userId);
  }

  // ---------------------------------------------------------------- RSVP & attendance

  async rsvp(id: string, response: string, userId: string) {
    const v = await this.access.viewer(userId);
    const m = await this.access.meetingFor(id, v);
    if (m.status !== 'SCHEDULED') throw new ConflictException('Replies are open only for scheduled meetings.');
    if (new Date(m.scheduledAt).getTime() <= Date.now()) throw new ConflictException('The meeting has started; replies are closed.');
    if (!(await this.access.invitees(m)).some((p) => p.userId === userId)) throw new ForbiddenException('You are not invited to this meeting.');
    await this.db
      .insert(meetingRsvps)
      .values({ societyId: this.societyId, meetingId: id, userId, response })
      .onConflictDoUpdate({ target: [meetingRsvps.meetingId, meetingRsvps.userId], set: { response, updatedAt: new Date() } });
    return this.detail(id, userId);
  }

  /** The secretary marks who is present, on the day or afterwards until the minutes are final. */
  async setAttendance(id: string, targetUserId: string, present: boolean, userId: string, viaProxy = false) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (!['SCHEDULED', 'HELD'].includes(m.status)) throw new ConflictException('Attendance is taken for scheduled or held meetings.');
    if (new Date(m.scheduledAt).getTime() - Date.now() > 60 * 60 * 1000) throw new BadRequestException('Attendance opens an hour before the meeting.');
    const [mm] = await this.db.select({ status: meetingMinutes.status }).from(meetingMinutes).where(eq(meetingMinutes.meetingId, id));
    if (mm?.status === 'FINAL') throw new ConflictException('The minutes are final; attendance can no longer change.');
    if (!(await this.access.invitees(m)).some((p) => p.userId === targetUserId)) throw new BadRequestException('That person is not invited to this meeting.');
    let viaProxyId: string | null = null;
    if (present && viaProxy) {
      const [p] = await this.db
        .select({ id: meetingProxies.id })
        .from(meetingProxies)
        .where(and(eq(meetingProxies.meetingId, id), eq(meetingProxies.memberUserId, targetUserId), isNull(meetingProxies.revokedAt)));
      if (!p) throw new BadRequestException('This member has no proxy for this meeting.');
      viaProxyId = p.id;
    }
    if (present) {
      await this.db
        .insert(meetingAttendance)
        .values({ societyId: this.societyId, meetingId: id, userId: targetUserId, markedBy: userId, viaProxyId })
        .onConflictDoUpdate({ target: [meetingAttendance.meetingId, meetingAttendance.userId], set: { viaProxyId, markedBy: userId, markedAt: new Date() } });
    } else {
      await this.db.delete(meetingAttendance).where(and(eq(meetingAttendance.meetingId, id), eq(meetingAttendance.userId, targetUserId)));
    }
    return this.detail(id, userId);
  }

  // ---------------------------------------------------------------- minutes

  async saveMinutes(id: string, content: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    if (m.status !== 'HELD') throw new ConflictException('Mark the meeting as held before writing the minutes.');
    const [existing] = await this.db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, id));
    if (existing?.status === 'FINAL') throw new ConflictException('The minutes are final and cannot be changed.');
    if (existing) {
      await this.db.update(meetingMinutes).set({ minutesContent: content, updatedAt: new Date() }).where(eq(meetingMinutes.id, existing.id));
    } else {
      await this.db.insert(meetingMinutes).values({ societyId: this.societyId, meetingId: id, minutesContent: content, status: 'DRAFT' });
    }
    return this.detail(id, userId);
  }

  /** Finalises the minutes: read-only from now on and shared with the invitees. */
  async finaliseMinutes(id: string, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(id, v);
    const [existing] = await this.db.select().from(meetingMinutes).where(eq(meetingMinutes.meetingId, id));
    if (!existing || !existing.minutesContent.trim()) throw new BadRequestException('Write the minutes first.');
    if (existing.status === 'FINAL') throw new ConflictException('The minutes are already final.');
    const [{ open }] = await this.db
      .select({ open: sql<number>`count(*)::int` })
      .from(meetingResolutions)
      .where(and(eq(meetingResolutions.meetingId, id), eq(meetingResolutions.status, 'OPEN')));
    if (open) throw new ConflictException('Close the voting on all resolutions before finalising the minutes.');
    await this.db
      .update(meetingMinutes)
      .set({ status: 'FINAL', finalisedAt: new Date(), finalisedBy: userId, updatedAt: new Date() })
      .where(eq(meetingMinutes.id, existing.id));
    await this.audit(userId, 'MEETING_MINUTES_FINAL', id, null);
    await this.notifyAll(await this.access.invitees(m), `Minutes: ${m.title}`, 'The minutes of the meeting are now available in the app.');
    return this.detail(id, userId);
  }

  // ---------------------------------------------------------------- action items

  private async actionItems(meetingId: string) {
    return this.db
      .select({
        item: meetingActionItems,
        ownerName: users.name,
        resolutionNumber: meetingResolutions.number,
      })
      .from(meetingActionItems)
      .leftJoin(users, eq(users.id, meetingActionItems.ownerUserId))
      .leftJoin(meetingResolutions, eq(meetingResolutions.id, meetingActionItems.resolutionId))
      .where(eq(meetingActionItems.meetingId, meetingId))
      .orderBy(asc(meetingActionItems.status), asc(meetingActionItems.dueDate), asc(meetingActionItems.createdAt))
      .then((rows) => rows.map((r) => ({ ...r.item, ownerName: r.ownerName, resolutionNumber: r.resolutionNumber })));
  }

  /** Open follow-ups across meetings the person can see (theirs first for everyone but the office). */
  async openActionItems(userId: string) {
    const v = await this.access.viewer(userId);
    const rows = await this.db
      .select({ item: meetingActionItems, ownerName: users.name, meetingTitle: meetings.title, meeting: meetings })
      .from(meetingActionItems)
      .innerJoin(meetings, eq(meetings.id, meetingActionItems.meetingId))
      .leftJoin(users, eq(users.id, meetingActionItems.ownerUserId))
      .where(and(eq(meetingActionItems.societyId, this.societyId), inArray(meetingActionItems.status, ['OPEN', 'IN_PROGRESS'])))
      .orderBy(asc(meetingActionItems.dueDate));
    return rows
      .filter((r) => this.access.canSee(r.meeting, v) && (v.isCommittee || r.item.ownerUserId === userId))
      .map((r) => ({ ...r.item, ownerName: r.ownerName, meetingTitle: r.meetingTitle }));
  }

  private async assertMeetingUser(m: Meeting, ownerUserId: string | null) {
    if (!ownerUserId) return;
    const people = m.audience === 'COMMITTEE' ? await this.access.committeeUsers() : await this.access.invitees(m);
    if (!people.some((p) => p.userId === ownerUserId)) throw new BadRequestException('Choose an owner from the society members.');
  }

  async addActionItem(meetingId: string, dto: ActionItemDto, userId: string) {
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(meetingId, v);
    await this.assertMeetingUser(m, dto.ownerUserId);
    await this.db.insert(meetingActionItems).values({ ...dto, meetingId, societyId: this.societyId });
    if (dto.ownerUserId && dto.ownerUserId !== userId) {
      await this.notificationService.createInAppNotification({
        societyId: this.societyId,
        recipientUserId: dto.ownerUserId,
        title: 'Action item for you',
        body: `${dto.title} (from ${m.title})${dto.dueDate ? `, due ${dto.dueDate}` : ''}.`,
      });
    }
    return this.detail(meetingId, userId);
  }

  private async actionItem(itemId: string) {
    const [item] = await this.db
      .select()
      .from(meetingActionItems)
      .where(and(eq(meetingActionItems.id, itemId), eq(meetingActionItems.societyId, this.societyId)));
    if (!item) throw new NotFoundException('Action item not found.');
    return item;
  }

  async updateActionItem(itemId: string, dto: ActionItemDto, userId: string) {
    const item = await this.actionItem(itemId);
    const v = await this.access.assertManager(userId);
    const m = await this.access.meetingFor(item.meetingId, v);
    await this.assertMeetingUser(m, dto.ownerUserId);
    await this.db.update(meetingActionItems).set({ ...dto, updatedAt: new Date() }).where(eq(meetingActionItems.id, itemId));
    return this.detail(item.meetingId, userId);
  }

  /** The owner (or the office) updates progress. */
  async setActionStatus(itemId: string, status: string, notes: string | null | undefined, userId: string) {
    const item = await this.actionItem(itemId);
    const v = await this.access.viewer(userId);
    if (!v.isManager && item.ownerUserId !== userId) throw new ForbiddenException('Only the owner or the office can update this.');
    await this.db
      .update(meetingActionItems)
      .set({ status, ...(notes !== undefined ? { notes } : {}), updatedAt: new Date() })
      .where(eq(meetingActionItems.id, itemId));
    return { id: itemId, status };
  }

  async removeActionItem(itemId: string, userId: string) {
    const item = await this.actionItem(itemId);
    await this.access.assertManager(userId);
    await this.db.delete(meetingActionItems).where(eq(meetingActionItems.id, itemId));
    return this.detail(item.meetingId, userId);
  }

  // ---------------------------------------------------------------- reminders

  /** The day-before reminder to invitees who haven't declined. Called by the reminder scheduler (tenant set). */
  async sendMeetingReminder(m: Meeting) {
    const declined = new Set(
      (
        await this.db
          .select({ userId: meetingRsvps.userId })
          .from(meetingRsvps)
          .where(and(eq(meetingRsvps.meetingId, m.id), eq(meetingRsvps.response, 'NOT_ATTENDING')))
      ).map((r) => r.userId),
    );
    const people = (await this.access.invitees(m)).filter((p) => !declined.has(p.userId));
    await this.notifyAll(people, `Reminder: ${m.title}`, `${TYPE_LABEL[m.type] || 'Meeting'} tomorrow, ${fmtWhen(new Date(m.scheduledAt))} at ${m.location}.`);
    return people.length;
  }

  // ---------------------------------------------------------------- helpers

  private async notifyAll(people: { userId: string }[], title: string, body: string) {
    for (const p of people) {
      await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId: p.userId, title, body });
    }
  }

  async audit(userId: string | undefined, action: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({ societyId: this.societyId, userId: userId || null, action, entityName: 'meetings', entityId, newValues } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
