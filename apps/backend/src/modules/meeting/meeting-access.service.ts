import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { meetings, roles, userSocieties } from '../../../database/schema';

export type Meeting = typeof meetings.$inferSelect;

/** Who runs meetings: notices, attendance, minutes, resolutions. */
export const MEETING_MANAGERS = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY'];
const COMMITTEE_ROLES = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'CULTURAL_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE'];

export interface Person {
  userId: string;
  name: string;
}

/** A voting unit: a flat (one vote, shared by its co-owners/residents) or a single person. */
export interface VotingUnit {
  key: string;
  flatId: string | null;
  label: string;
  userIds: string[];
  names: string[];
}

export interface Viewer {
  userId: string;
  role: string;
  isManager: boolean;
  isCommittee: boolean;
}

/** Society context, roles, invitees and voters shared by the meeting and resolution services. */
@Injectable()
export class MeetingAccess {
  /** Set by the reminder scheduler: told when a reminder may now be due earlier (no database query needed). */
  onReminderChanged?: (at: Date) => void;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  /** A meeting or vote reminder falls due at `at` (24 h before); tells the scheduler. */
  reminderDue(at: Date) {
    this.onReminderChanged?.(at);
  }

  get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  async viewer(userId: string): Promise<Viewer> {
    const [row] = await this.db
      .select({ role: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, this.societyId)));
    const role = row?.role || '';
    const committee = await this.committeeUsers();
    return {
      userId,
      role,
      isManager: MEETING_MANAGERS.includes(role),
      isCommittee: MEETING_MANAGERS.includes(role) || COMMITTEE_ROLES.includes(role) || committee.some((p) => p.userId === userId),
    };
  }

  async assertManager(userId: string): Promise<Viewer> {
    const v = await this.viewer(userId);
    if (!v.isManager) throw new ForbiddenException('Only the Secretary, President or society admin can do this.');
    return v;
  }

  /** The meeting, if this viewer may see it (drafts: managers; committee meetings: the committee). */
  async meetingFor(id: string, v: Viewer): Promise<Meeting> {
    const [m] = await this.db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, id), eq(meetings.societyId, this.societyId)));
    if (!m || !this.canSee(m, v)) throw new NotFoundException('Meeting not found.');
    return m;
  }

  canSee(m: Pick<Meeting, 'status' | 'audience'>, v: Viewer) {
    if (v.isManager) return true;
    if (m.status === 'DRAFT') return false;
    return m.audience !== 'COMMITTEE' || v.isCommittee;
  }

  /** Members of the current committee (active posts), or people with committee roles if none is recorded. */
  async committeeUsers(): Promise<Person[]> {
    const rows = (await this.db.execute(sql`
      select distinct u.id as "userId", u.name as name
      from committee_positions p
      join committee_terms t on t.id = p.term_id and t.status = 'CURRENT'
      join members m on m.id = p.member_id
      join users u on u.id = m.user_id
      where p.society_id = ${this.societyId} and p.status = 'ACTIVE'
    `)) as unknown as Person[];
    if (rows.length) return rows;
    return (await this.db.execute(sql`
      select distinct u.id as "userId", u.name as name
      from user_societies us join roles r on r.id = us.role_id join users u on u.id = us.user_id
      where us.society_id = ${this.societyId} and r.name in ${COMMITTEE_ROLES}
    `)) as unknown as Person[];
  }

  /** People invited to a meeting. */
  async invitees(m: Pick<Meeting, 'audience'>): Promise<Person[]> {
    if (m.audience === 'COMMITTEE') return this.committeeUsers();
    return (await this.db.execute(sql`
      select distinct u.id as "userId", u.name as name
      from members m join users u on u.id = m.user_id
      where m.society_id = ${this.societyId} and m.status = 'ACTIVE'
      order by u.name
    `)) as unknown as Person[];
  }

  /**
   * Who may vote. OWNERS: current owners; ALL_MEMBERS: owners and active tenants; COMMITTEE: the committee (always one
   * vote each). With onePerFlat each flat is one unit shared by everyone living in/owning it.
   */
  async votingUnits(voters: string, onePerFlat: boolean): Promise<VotingUnit[]> {
    if (voters === 'COMMITTEE') {
      return (await this.committeeUsers()).map((p) => ({ key: p.userId, flatId: null, label: p.name, userIds: [p.userId], names: [p.name] }));
    }
    const rows = (await this.db.execute(sql`
      select fo.flat_id as "flatId", o.user_id as "userId", u.name as name,
             coalesce(w.name || '-', '') || f.number as label
      from owners o
      join flat_owners fo on fo.owner_id = o.id and fo.is_current
      join flats f on f.id = fo.flat_id and f.deleted_at is null
      left join floors fl on fl.id = f.floor_id
      left join wings w on w.id = fl.wing_id
      join users u on u.id = o.user_id
      where o.society_id = ${this.societyId}
      ${
        voters === 'ALL_MEMBERS'
          ? sql`union
      select ft.flat_id, t.user_id, u.name, coalesce(w.name || '-', '') || f.number
      from tenants t
      join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
      join flats f on f.id = ft.flat_id and f.deleted_at is null
      left join floors fl on fl.id = f.floor_id
      left join wings w on w.id = fl.wing_id
      join users u on u.id = t.user_id
      where ft.society_id = ${this.societyId}`
          : sql``
      }
    `)) as unknown as { flatId: string; userId: string; name: string; label: string }[];

    const units = new Map<string, VotingUnit>();
    for (const r of rows) {
      const key = onePerFlat ? r.flatId : r.userId;
      const unit = units.get(key) || { key, flatId: onePerFlat ? r.flatId : null, label: onePerFlat ? r.label : r.name, userIds: [], names: [] };
      if (!unit.userIds.includes(r.userId)) {
        unit.userIds.push(r.userId);
        unit.names.push(r.name);
      }
      units.set(key, unit);
    }
    return [...units.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  }
}
