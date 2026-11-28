import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, committeePositions, committeeTerms, members, roles, userSocieties, users } from '../../../database/schema';
import { NotificationService } from '../notification/notification.service';
import { COMMITTEE_POSTS, PositionDto, TermDto } from './dto/committee.dto';

type Term = typeof committeeTerms.$inferSelect;
type Position = typeof committeePositions.$inferSelect;

/** Roles that mean "on the committee" (COMMITTEE is the older generic role). */
const COMMITTEE_ROLES: string[] = [...COMMITTEE_POSTS, 'COMMITTEE'];
const RESIDENT_ROLES = ['OWNER', 'CO_OWNER', 'TENANT', 'FAMILY_MEMBER', 'MEMBER'];
/** Who may change the committee (it changes people's access). */
const MANAGERS = ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'PRESIDENT', 'SECRETARY'];
/** Posts held by one person at a time. */
const SINGLE_POSTS = COMMITTEE_POSTS.filter((p) => p !== 'COMMITTEE_MEMBER');
const POST_RANK = new Map<string, number>(COMMITTEE_POSTS.map((p, i) => [p, i]));
const POST_LABEL: Record<string, string> = {
  PRESIDENT: 'Chairman / President',
  VICE_PRESIDENT: 'Vice-President',
  SECRETARY: 'Secretary',
  JOINT_SECRETARY: 'Joint Secretary',
  TREASURER: 'Treasurer',
  CULTURAL_SECRETARY: 'Cultural Secretary',
  COMMITTEE_MEMBER: 'Committee Member',
};
const label = (role: string) => POST_LABEL[role] || role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

export interface AccessChange {
  memberId: string;
  userId: string;
  name: string;
  from: string;
  to: string;
  /** gain: joins the committee; lose: leaves it; change: new post; stay: same post, only the record is updated; keep: staff role left as it is. */
  kind: 'gain' | 'lose' | 'change' | 'stay' | 'keep';
}

/**
 * The managing committee: terms (one CURRENT, older ones PAST, upcoming DRAFT) and the posts in them. Making a term
 * current (handover) and mid-term changes keep each member's committee designation and app role in step; staff roles
 * (accountant, estate manager, admins) are never changed.
 */
@Injectable()
export class CommitteeService {
  private readonly logger = new Logger(CommitteeService.name);

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

  private async roleOf(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ role: roles.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, this.societyId)));
    return row?.role || '';
  }

  private async isManager(userId: string) {
    return MANAGERS.includes(await this.roleOf(userId));
  }

  private async assertManager(userId: string) {
    if (!(await this.isManager(userId))) {
      throw new ForbiddenException('Only the President, Secretary or society admin can change the committee.');
    }
  }

  private async isOffice(userId: string) {
    const role = await this.roleOf(userId);
    return !!role && !RESIDENT_ROLES.includes(role);
  }

  // ---------------------------------------------------------------- reading

  /** Terms, newest first. Residents don't see drafts. */
  async listTerms(userId: string) {
    const office = await this.isOffice(userId);
    const rows = await this.db
      .select({
        term: committeeTerms,
        posts: sql<number>`(select count(distinct p.member_id)::int from committee_positions p where p.term_id = committee_terms.id and (p.status = 'ACTIVE' or committee_terms.status = 'PAST'))`,
      })
      .from(committeeTerms)
      .where(and(eq(committeeTerms.societyId, this.societyId), office ? undefined : ne(committeeTerms.status, 'DRAFT')))
      .orderBy(sql`case ${committeeTerms.status} when 'CURRENT' then 0 when 'DRAFT' then 1 else 2 end`, desc(committeeTerms.startDate));
    return rows.map((r) => ({ ...r.term, activePosts: r.posts }));
  }

  private async getTerm(id: string): Promise<Term> {
    const [row] = await this.db
      .select()
      .from(committeeTerms)
      .where(and(eq(committeeTerms.id, id), eq(committeeTerms.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Committee term not found.');
    return row;
  }

  /** The current committee (null when none has been set up yet). */
  async current(userId: string) {
    const [term] = await this.db
      .select()
      .from(committeeTerms)
      .where(and(eq(committeeTerms.societyId, this.societyId), eq(committeeTerms.status, 'CURRENT')));
    return term ? this.termDetail(term.id, userId) : null;
  }

  /** A term with its posts. Contact details are shown to residents only for members who chose to share them. */
  async termDetail(termId: string, userId: string) {
    const term = await this.getTerm(termId);
    const office = await this.isOffice(userId);
    if (!office && term.status === 'DRAFT') throw new NotFoundException('Committee term not found.');
    const canManage = await this.isManager(userId);

    const rows = await this.db
      .select({
        position: committeePositions,
        name: users.name,
        email: users.email,
        mobile: users.mobile,
        photoUrl: members.photoUrl,
        userId: members.userId,
        flatLabel: sql<string | null>`(
          select string_agg(distinct coalesce(w.name || '-', '') || f.number, ', ')
          from flats f
          left join floors fl on fl.id = f.floor_id
          left join wings w on w.id = fl.wing_id
          where f.id in (
            select fo.flat_id from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
            where o.user_id = ${members.userId} and o.society_id = ${members.societyId}
            union
            select ft.flat_id from tenants t join flat_tenants ft on ft.tenant_id = t.id and ft.is_active
            where t.user_id = ${members.userId} and ft.society_id = ${members.societyId}
          )
        )`,
      })
      .from(committeePositions)
      .innerJoin(members, eq(members.id, committeePositions.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(committeePositions.termId, termId));

    const positions = rows
      .map((r) => {
        const showContact = office || r.position.showContact;
        return {
          ...r.position,
          designationLabel: label(r.position.designation),
          name: r.name,
          photoUrl: r.photoUrl,
          flatLabel: r.flatLabel,
          email: showContact ? r.email : null,
          mobile: showContact ? r.mobile : null,
          isMe: r.userId === userId,
        };
      })
      .filter((p) => office || p.status === 'ACTIVE')
      .sort(
        (a, b) =>
          (a.status === b.status ? 0 : a.status === 'ACTIVE' ? -1 : 1) ||
          (POST_RANK.get(a.designation) ?? 99) - (POST_RANK.get(b.designation) ?? 99) ||
          a.sortOrder - b.sortOrder ||
          (a.name || '').localeCompare(b.name || ''),
      );
    return { ...term, positions, canManage };
  }

  /** Members who can be given a post (active members of the society). */
  async eligibleMembers() {
    const rows = await this.db
      .select({ id: members.id, name: users.name, memberType: members.memberType, role: roles.name })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .leftJoin(userSocieties, and(eq(userSocieties.userId, members.userId), eq(userSocieties.societyId, members.societyId)))
      .leftJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(members.societyId, this.societyId), eq(members.status, 'ACTIVE')))
      .orderBy(asc(users.name));
    return rows;
  }

  // ---------------------------------------------------------------- terms

  async createTerm(dto: TermDto, userId: string) {
    await this.assertManager(userId);
    const [row] = await this.db.insert(committeeTerms).values({ ...dto, societyId: this.societyId, status: 'DRAFT' }).returning();
    await this.audit(userId, 'COMMITTEE_TERM_CREATE', row.id, row);
    return this.termDetail(row.id, userId);
  }

  /**
   * A draft term pre-filled from the people who hold committee roles in the app today, for societies that are setting
   * the committee up for the first time.
   */
  async draftFromCurrentRoles(dto: TermDto, userId: string) {
    await this.assertManager(userId);
    const holders = await this.db
      .select({ memberId: members.id, role: roles.name, designation: members.committeeDesignation })
      .from(members)
      .innerJoin(userSocieties, and(eq(userSocieties.userId, members.userId), eq(userSocieties.societyId, members.societyId)))
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(members.societyId, this.societyId), eq(members.status, 'ACTIVE')));
    const picked = holders
      .map((h) => {
        const post = (COMMITTEE_POSTS as readonly string[]).includes(h.role)
          ? h.role
          : h.role === 'COMMITTEE'
            ? 'COMMITTEE_MEMBER'
            : h.designation && (COMMITTEE_POSTS as readonly string[]).includes(h.designation)
              ? h.designation
              : null;
        return post ? { memberId: h.memberId, designation: post } : null;
      })
      .filter((x): x is { memberId: string; designation: string } => !!x);
    if (!picked.length) throw new BadRequestException('Nobody holds a committee role in the app yet. Create an empty term and add the posts.');

    const term = await this.db.transaction(async (tx) => {
      const [t] = await tx.insert(committeeTerms).values({ ...dto, societyId: this.societyId, status: 'DRAFT' }).returning();
      const seen = new Set<string>();
      for (const p of picked) {
        // One holder per single post; extras become committee members.
        const designation = SINGLE_POSTS.includes(p.designation as any) && seen.has(p.designation) ? 'COMMITTEE_MEMBER' : p.designation;
        seen.add(designation);
        await tx.insert(committeePositions).values({ societyId: this.societyId, termId: t.id, memberId: p.memberId, designation, startDate: dto.startDate });
      }
      return t;
    });
    await this.audit(userId, 'COMMITTEE_TERM_CREATE', term.id, { fromCurrentRoles: picked.length });
    return this.termDetail(term.id, userId);
  }

  async updateTerm(id: string, dto: TermDto, userId: string) {
    await this.assertManager(userId);
    await this.getTerm(id);
    await this.db.update(committeeTerms).set({ ...dto, updatedAt: new Date() }).where(eq(committeeTerms.id, id));
    await this.audit(userId, 'COMMITTEE_TERM_UPDATE', id, dto);
    return this.termDetail(id, userId);
  }

  /** Only drafts can be deleted; past and current terms are the society's history. */
  async removeTerm(id: string, userId: string) {
    await this.assertManager(userId);
    const term = await this.getTerm(id);
    if (term.status !== 'DRAFT') throw new ConflictException('Only draft terms can be deleted; past committees stay on record.');
    await this.db.delete(committeeTerms).where(eq(committeeTerms.id, id));
    await this.audit(userId, 'COMMITTEE_TERM_DELETE', id, { name: term.name });
    return { deleted: true };
  }

  // ---------------------------------------------------------------- posts

  private async getPosition(id: string): Promise<Position> {
    const [row] = await this.db
      .select()
      .from(committeePositions)
      .where(and(eq(committeePositions.id, id), eq(committeePositions.societyId, this.societyId)));
    if (!row) throw new NotFoundException('Committee post not found.');
    return row;
  }

  /** One post per member per term, and one holder for single posts (President, Secretary, ...). */
  private async checkPost(termId: string, memberId: string, designation: string, exceptId?: string) {
    const active = await this.db
      .select({ id: committeePositions.id, memberId: committeePositions.memberId, designation: committeePositions.designation })
      .from(committeePositions)
      .where(and(eq(committeePositions.termId, termId), eq(committeePositions.status, 'ACTIVE')));
    const others = active.filter((p) => p.id !== exceptId);
    if (others.some((p) => p.memberId === memberId)) throw new ConflictException('This member already has a post in this term.');
    if (SINGLE_POSTS.includes(designation as any) && others.some((p) => p.designation === designation)) {
      throw new ConflictException(`This term already has a ${label(designation)}. End or change that post first.`);
    }
  }

  private async assertMember(memberId: string) {
    const [m] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.societyId, this.societyId)));
    if (!m) throw new BadRequestException('That member is not part of this society.');
  }

  async addPosition(termId: string, dto: PositionDto, userId: string) {
    await this.assertManager(userId);
    const term = await this.getTerm(termId);
    if (term.status === 'PAST') throw new ConflictException('Past committees cannot be changed.');
    await this.assertMember(dto.memberId);
    await this.checkPost(termId, dto.memberId, dto.designation);
    const [row] = await this.db
      .insert(committeePositions)
      .values({ ...dto, societyId: this.societyId, termId, startDate: dto.startDate || (term.status === 'CURRENT' ? todayIST() : term.startDate) })
      .returning();
    await this.audit(userId, 'COMMITTEE_POST_ADD', row.id, row);
    if (term.status === 'CURRENT') await this.syncMembers([dto.memberId], userId);
    return this.termDetail(termId, userId);
  }

  async updatePosition(id: string, dto: PositionDto, userId: string) {
    await this.assertManager(userId);
    const pos = await this.getPosition(id);
    const term = await this.getTerm(pos.termId);
    if (term.status === 'PAST') throw new ConflictException('Past committees cannot be changed.');
    if (pos.status !== 'ACTIVE') throw new ConflictException('This post has ended.');
    if (dto.memberId !== pos.memberId) throw new BadRequestException('To give the post to someone else, end it and add a new one.');
    await this.checkPost(pos.termId, dto.memberId, dto.designation, id);
    await this.db
      .update(committeePositions)
      .set({
        designation: dto.designation,
        responsibilities: dto.responsibilities,
        bio: dto.bio,
        showContact: dto.showContact,
        sortOrder: dto.sortOrder,
        startDate: dto.startDate ?? pos.startDate,
        updatedAt: new Date(),
      })
      .where(eq(committeePositions.id, id));
    await this.audit(userId, 'COMMITTEE_POST_UPDATE', id, dto);
    if (term.status === 'CURRENT' && dto.designation !== pos.designation) await this.syncMembers([pos.memberId], userId);
    return this.termDetail(pos.termId, userId);
  }

  /** Ends a post mid-term (resignation, removal). In a draft term the post is simply deleted. */
  async endPosition(id: string, endDate: string, reason: string | null, userId: string) {
    await this.assertManager(userId);
    const pos = await this.getPosition(id);
    const term = await this.getTerm(pos.termId);
    if (term.status === 'PAST') throw new ConflictException('Past committees cannot be changed.');
    if (term.status === 'DRAFT') {
      await this.db.delete(committeePositions).where(eq(committeePositions.id, id));
    } else {
      if (pos.status !== 'ACTIVE') throw new ConflictException('This post has already ended.');
      await this.db
        .update(committeePositions)
        .set({ status: 'ENDED', endDate, endReason: reason, updatedAt: new Date() })
        .where(eq(committeePositions.id, id));
      await this.syncMembers([pos.memberId], userId);
    }
    await this.audit(userId, 'COMMITTEE_POST_END', id, { endDate, reason });
    return this.termDetail(pos.termId, userId);
  }

  /** A committee member chooses whether residents see their phone and email (the office can change it too). */
  async setContactVisibility(id: string, showContact: boolean, userId: string) {
    const pos = await this.getPosition(id);
    const [m] = await this.db.select({ userId: members.userId }).from(members).where(eq(members.id, pos.memberId));
    if (m?.userId !== userId && !(await this.isManager(userId))) throw new ForbiddenException('Only the member can change this.');
    await this.db.update(committeePositions).set({ showContact, updatedAt: new Date() }).where(eq(committeePositions.id, id));
    return this.termDetail(pos.termId, userId);
  }

  // ---------------------------------------------------------------- access (designation + app role)

  /** The post each member should hold now: their active post in the current term, if any. */
  private async targetPosts(termId: string | null): Promise<Map<string, string>> {
    if (!termId) return new Map();
    const rows = await this.db
      .select({ memberId: committeePositions.memberId, designation: committeePositions.designation })
      .from(committeePositions)
      .where(and(eq(committeePositions.termId, termId), eq(committeePositions.status, 'ACTIVE')));
    return new Map(rows.map((r) => [r.memberId, r.designation]));
  }

  /**
   * Access changes needed so that exactly the holders of `targets` have committee roles: holders get their post as
   * role, other committee-role holders go back to Owner/Tenant, and staff roles are left as they are.
   */
  private async planAccess(targets: Map<string, string>, onlyMembers?: string[]): Promise<AccessChange[]> {
    const rows = await this.db
      .select({
        memberId: members.id,
        userId: members.userId,
        name: users.name,
        memberType: members.memberType,
        designation: members.committeeDesignation,
        role: roles.name,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .leftJoin(userSocieties, and(eq(userSocieties.userId, members.userId), eq(userSocieties.societyId, members.societyId)))
      .leftJoin(roles, eq(roles.id, userSocieties.roleId))
      .where(and(eq(members.societyId, this.societyId), onlyMembers ? inArray(members.id, onlyMembers) : undefined));

    const changes: AccessChange[] = [];
    for (const m of rows) {
      const role = m.role || '';
      const post = targets.get(m.memberId);
      const onCommittee = COMMITTEE_ROLES.includes(role) || (!!m.designation && COMMITTEE_ROLES.includes(m.designation));
      const base = { memberId: m.memberId, userId: m.userId, name: m.name || 'Member' };
      const isStaff = !!role && !COMMITTEE_ROLES.includes(role) && !RESIDENT_ROLES.includes(role);
      if (post) {
        if (isStaff) changes.push({ ...base, from: role, to: role, kind: 'keep' });
        else if (role === post && m.designation !== post) changes.push({ ...base, from: role, to: post, kind: 'stay' });
        else if (role !== post) changes.push({ ...base, from: role || 'NONE', to: post, kind: onCommittee ? 'change' : 'gain' });
      } else if (onCommittee && !isStaff) {
        changes.push({ ...base, from: role, to: m.memberType === 'TENANT' ? 'TENANT' : 'OWNER', kind: 'lose' });
      } else if (onCommittee && isStaff && m.designation) {
        // A staff member who was on the committee keeps their staff role; only the designation is cleared.
        changes.push({ ...base, from: role, to: role, kind: 'keep' });
      }
    }
    return changes;
  }

  /** Applies access changes: committee designation on the member, role in the society. */
  private async applyAccess(tx: any, changes: AccessChange[], targets: Map<string, string>) {
    const roleRows = await tx.select({ id: roles.id, name: roles.name }).from(roles);
    const roleId = new Map<string, string>(roleRows.map((r: any) => [r.name, r.id]));
    for (const c of changes) {
      const post = targets.get(c.memberId) || null;
      await tx
        .update(members)
        .set({ committeeDesignation: c.kind === 'keep' ? null : post, updatedAt: new Date() })
        .where(eq(members.id, c.memberId));
      if (c.kind === 'keep' || c.from === c.to) continue;
      const target = roleId.get(c.to) || roleId.get('OWNER');
      if (!target) continue;
      const [link] = await tx
        .select({ id: userSocieties.id })
        .from(userSocieties)
        .where(and(eq(userSocieties.userId, c.userId), eq(userSocieties.societyId, this.societyId)));
      if (link) await tx.update(userSocieties).set({ roleId: target, updatedAt: new Date() }).where(eq(userSocieties.id, link.id));
      else await tx.insert(userSocieties).values({ userId: c.userId, societyId: this.societyId, roleId: target });
    }
  }

  /** Brings the given members' access in line with the current term (after a mid-term change). */
  private async syncMembers(memberIds: string[], userId: string) {
    const [current] = await this.db
      .select({ id: committeeTerms.id })
      .from(committeeTerms)
      .where(and(eq(committeeTerms.societyId, this.societyId), eq(committeeTerms.status, 'CURRENT')));
    const targets = await this.targetPosts(current?.id ?? null);
    const changes = await this.planAccess(targets, memberIds);
    if (!changes.length) return;
    await this.db.transaction((tx) => this.applyAccess(tx, changes, targets));
    await this.audit(userId, 'COMMITTEE_ACCESS_SYNC', memberIds[0], changes);
    await this.announce(changes);
  }

  /** What making this term current would change, for the confirmation screen. */
  async handoverPreview(termId: string, userId: string) {
    await this.assertManager(userId);
    const term = await this.getTerm(termId);
    if (term.status !== 'DRAFT') throw new ConflictException('Only a draft term can be made current.');
    const targets = await this.targetPosts(termId);
    const changes = await this.planAccess(targets);
    const posts = [...targets.values()];
    const problems: string[] = [];
    if (!targets.size) problems.push('Add the committee members first.');
    else if (!posts.includes('PRESIDENT') && !posts.includes('SECRETARY')) {
      problems.push('Appoint a President or Secretary, so someone can manage the society after the handover.');
    }
    const mine = changes.find((c) => c.userId === userId);
    const youLoseAccess = !!mine && mine.kind === 'lose';
    return {
      term,
      changes: changes.map((c) => ({ ...c, fromLabel: label(c.from), toLabel: label(c.to) })),
      problems,
      youLoseAccess,
    };
  }

  /** Handover: the draft term becomes current, the current one becomes past, and access follows. */
  async makeCurrent(termId: string, userId: string) {
    const preview = await this.handoverPreview(termId, userId);
    if (preview.problems.length) throw new BadRequestException(preview.problems.join(' '));
    const targets = await this.targetPosts(termId);
    const changes = await this.planAccess(targets);
    const today = todayIST();

    await this.db.transaction(async (tx) => {
      const [old] = await tx
        .select()
        .from(committeeTerms)
        .where(and(eq(committeeTerms.societyId, this.societyId), eq(committeeTerms.status, 'CURRENT')))
        .for('update');
      if (old) {
        await tx
          .update(committeeTerms)
          .set({ status: 'PAST', endDate: old.endDate && old.endDate < today ? old.endDate : today, updatedAt: new Date() })
          .where(eq(committeeTerms.id, old.id));
        await tx
          .update(committeePositions)
          .set({ status: 'ENDED', endDate: today, endReason: 'Term ended', updatedAt: new Date() })
          .where(and(eq(committeePositions.termId, old.id), eq(committeePositions.status, 'ACTIVE')));
      }
      const [updated] = await tx
        .update(committeeTerms)
        .set({ status: 'CURRENT', handedOverAt: new Date(), handedOverBy: userId, updatedAt: new Date() })
        .where(and(eq(committeeTerms.id, termId), eq(committeeTerms.status, 'DRAFT')))
        .returning();
      if (!updated) throw new ConflictException('This term has already been made current.');
      await this.applyAccess(tx, changes, targets);
    });

    await this.audit(userId, 'COMMITTEE_HANDOVER', termId, { changes });
    await this.announce(changes);
    return { ...(await this.termDetail(termId, userId)), changes: preview.changes, youLostAccess: preview.youLoseAccess };
  }

  /** Tells each affected member what changed for them. */
  private async announce(changes: AccessChange[]) {
    for (const c of changes) {
      if (c.kind === 'keep' || c.kind === 'stay') continue;
      const body =
        c.kind === 'lose'
          ? 'Your committee term has ended. Thank you for your service. Your app access is now that of a member.'
          : `You are now ${label(c.to)} of the managing committee. Your app access has been updated.`;
      await this.notificationService.createInAppNotification({ societyId: this.societyId, recipientUserId: c.userId, title: 'Managing committee', body });
    }
  }

  private async audit(userId: string | undefined, action: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({ societyId: this.societyId, userId: userId || null, action, entityName: 'committee', entityId, newValues } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
