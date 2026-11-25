import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { and, desc, eq, gt, inArray, lt, ne, sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { auditLogs, chatChannels, chatDirectMembers, chatMessages, chatMutes, chatReads, members, roles, userSocieties, users } from '../../../database/schema';
import { ChatEvents } from './chat-events.service';

type Channel = typeof chatChannels.$inferSelect;

const COMMITTEE_ROLES = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'CULTURAL_SECRETARY', 'COMMITTEE_MEMBER', 'COMMITTEE'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'SOCIETY_ADMIN'];
const PAGE = 50;

export interface ChatActor {
  userId: string;
  name: string;
  role: string;
  /** On the committee: committee group, private messages, moderation. */
  isCommittee: boolean;
}

/**
 * Society chat. Everyone is in the society group; the committee has its own group; private messages can be started
 * only by committee members (with anyone), and the other person can reply. Committee members moderate the society
 * group: remove messages and mute people.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
    private readonly events: ChatEvents,
  ) {}

  get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  /** The signed-in member, and whether they are on the current committee. */
  async actor(userId: string): Promise<ChatActor> {
    const [row] = await this.db
      .select({ role: roles.name, name: users.name })
      .from(userSocieties)
      .innerJoin(roles, eq(roles.id, userSocieties.roleId))
      .innerJoin(users, eq(users.id, userSocieties.userId))
      .where(and(eq(userSocieties.userId, userId), eq(userSocieties.societyId, this.societyId)));
    if (!row) throw new ForbiddenException('You are not a member of this society.');
    let isCommittee = COMMITTEE_ROLES.includes(row.role) || ADMIN_ROLES.includes(row.role);
    if (!isCommittee) {
      const [post] = (await this.db.execute(sql`
        select 1 as x from committee_positions p join committee_terms t on t.id = p.term_id and t.status = 'CURRENT'
        join members m on m.id = p.member_id
        where p.society_id = ${this.societyId} and p.status = 'ACTIVE' and m.user_id = ${userId} limit 1
      `)) as unknown as { x: number }[];
      isCommittee = !!post;
    }
    return { userId, name: row.name || 'Member', role: row.role, isCommittee };
  }

  /** The society or committee group, created the first time anyone opens chat. */
  private async group(type: 'SOCIETY' | 'COMMITTEE'): Promise<Channel> {
    const [existing] = await this.db.select().from(chatChannels).where(and(eq(chatChannels.societyId, this.societyId), eq(chatChannels.type, type)));
    if (existing) return existing;
    await this.db
      .insert(chatChannels)
      .values({ societyId: this.societyId, type, name: type === 'SOCIETY' ? 'Society group' : 'Committee group' })
      .onConflictDoNothing();
    const [row] = await this.db.select().from(chatChannels).where(and(eq(chatChannels.societyId, this.societyId), eq(chatChannels.type, type)));
    return row;
  }

  private async channelFor(channelId: string, me: ChatActor): Promise<Channel> {
    const [c] = await this.db.select().from(chatChannels).where(and(eq(chatChannels.id, channelId), eq(chatChannels.societyId, this.societyId)));
    if (!c) throw new NotFoundException('Conversation not found.');
    if (c.type === 'COMMITTEE' && !me.isCommittee) throw new NotFoundException('Conversation not found.');
    if (c.type === 'DIRECT') {
      const [m] = await this.db.select({ id: chatDirectMembers.id }).from(chatDirectMembers).where(and(eq(chatDirectMembers.channelId, c.id), eq(chatDirectMembers.userId, me.userId)));
      if (!m) throw new NotFoundException('Conversation not found.');
    }
    return c;
  }

  private async directMembers(channelId: string): Promise<string[]> {
    const rows = await this.db.select({ userId: chatDirectMembers.userId }).from(chatDirectMembers).where(eq(chatDirectMembers.channelId, channelId));
    return rows.map((r) => r.userId);
  }

  private async muted(userId: string) {
    const [m] = await this.db
      .select()
      .from(chatMutes)
      .where(and(eq(chatMutes.societyId, this.societyId), eq(chatMutes.userId, userId), gt(chatMutes.mutedUntil, new Date())));
    return m || null;
  }

  // ---------------------------------------------------------------- channels

  /** My conversations with unread counts and the last message. */
  async channels(userId: string) {
    const me = await this.actor(userId);
    const list: Channel[] = [await this.group('SOCIETY')];
    if (me.isCommittee) list.push(await this.group('COMMITTEE'));
    const direct = await this.db
      .select({ c: chatChannels })
      .from(chatChannels)
      .innerJoin(chatDirectMembers, eq(chatDirectMembers.channelId, chatChannels.id))
      .where(and(eq(chatChannels.societyId, this.societyId), eq(chatChannels.type, 'DIRECT'), eq(chatDirectMembers.userId, userId)))
      .orderBy(desc(chatChannels.lastMessageAt));
    list.push(...direct.map((d) => d.c));

    const out = [];
    for (const c of list) {
      const [stats] = (await this.db.execute(sql`
        select
          (select count(*)::int from chat_messages m
            where m.channel_id = ${c.id} and m.deleted_at is null and m.sender_id is distinct from ${userId}
              and m.created_at > coalesce((select r.last_read_at from chat_reads r where r.channel_id = ${c.id} and r.user_id = ${userId}), 'epoch')) as unread,
          (select json_build_object('body', m.body, 'photo', m.photo_url is not null, 'at', m.created_at, 'sender', u.name, 'deleted', m.deleted_at is not null)
            from chat_messages m left join users u on u.id = m.sender_id
            where m.channel_id = ${c.id} order by m.created_at desc limit 1) as last
      `)) as unknown as { unread: number; last: any }[];
      let title = c.name || '';
      let other: { userId: string; name: string } | null = null;
      if (c.type === 'DIRECT') {
        const [o] = await this.db
          .select({ userId: users.id, name: users.name })
          .from(chatDirectMembers)
          .innerJoin(users, eq(users.id, chatDirectMembers.userId))
          .where(and(eq(chatDirectMembers.channelId, c.id), ne(chatDirectMembers.userId, userId)));
        other = o ? { userId: o.userId, name: o.name || 'Member' } : null;
        title = other?.name || 'Private chat';
      }
      out.push({ id: c.id, type: c.type, title, other, unread: stats?.unread || 0, last: stats?.last || null, lastMessageAt: c.lastMessageAt });
    }
    const mute = await this.muted(userId);
    return { me: { userId, name: me.name, isCommittee: me.isCommittee, mutedUntil: mute?.mutedUntil || null }, channels: out };
  }

  /** People a committee member can message privately. */
  async people(userId: string) {
    const me = await this.actor(userId);
    if (!me.isCommittee) throw new ForbiddenException('Only committee members can start a private chat.');
    const rows = (await this.db.execute(sql`
      select distinct u.id as "userId", u.name as name, r.name as role,
        (select coalesce(w.name || '-', '') || f.number from owners o join flat_owners fo on fo.owner_id = o.id and fo.is_current
          join flats f on f.id = fo.flat_id left join floors fl on fl.id = f.floor_id left join wings w on w.id = fl.wing_id
          where o.user_id = u.id and o.society_id = ${this.societyId} limit 1) as flat
      from user_societies us join users u on u.id = us.user_id join roles r on r.id = us.role_id
      where us.society_id = ${this.societyId} and u.id <> ${userId} and r.name <> 'SUPER_ADMIN'
      order by u.name
    `)) as unknown as { userId: string; name: string; role: string; flat: string | null }[];
    return rows;
  }

  /** Opens (or reuses) a private chat. Only committee members can start one. */
  async openDirect(otherUserId: string, userId: string) {
    const me = await this.actor(userId);
    if (!me.isCommittee) throw new ForbiddenException('Only committee members can start a private chat. Use the society group, or ask a committee member to message you.');
    if (otherUserId === userId) throw new BadRequestException('Choose someone else.');
    const [other] = await this.db
      .select({ id: userSocieties.userId })
      .from(userSocieties)
      .where(and(eq(userSocieties.userId, otherUserId), eq(userSocieties.societyId, this.societyId)));
    if (!other) throw new BadRequestException('That person is not a member of this society.');
    const key = [userId, otherUserId].sort().join(':');
    let [c] = await this.db.select().from(chatChannels).where(and(eq(chatChannels.societyId, this.societyId), eq(chatChannels.type, 'DIRECT'), eq(chatChannels.directKey, key)));
    if (!c) {
      c = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(chatChannels)
          .values({ societyId: this.societyId, type: 'DIRECT', directKey: key, createdBy: userId })
          .onConflictDoNothing()
          .returning();
        if (!created) {
          const [again] = await tx.select().from(chatChannels).where(and(eq(chatChannels.societyId, this.societyId), eq(chatChannels.directKey, key)));
          return again;
        }
        await tx.insert(chatDirectMembers).values([
          { channelId: created.id, userId },
          { channelId: created.id, userId: otherUserId },
        ]);
        return created;
      });
    }
    return { id: c.id };
  }

  // ---------------------------------------------------------------- messages

  private messageColumns() {
    return {
      m: chatMessages,
      senderName: users.name,
      senderRole: sql<string | null>`(select r.name from user_societies us join roles r on r.id = us.role_id where us.user_id = ${chatMessages.senderId} and us.society_id = ${chatMessages.societyId})`,
      replyTo: sql<any>`(select json_build_object('id', p.id, 'body', p.body, 'photo', p.photo_url is not null, 'sender', pu.name, 'deleted', p.deleted_at is not null)
        from chat_messages p left join users pu on pu.id = p.sender_id where p.id = ${chatMessages.replyToId})`,
    };
  }

  /** Removed messages keep their place in the conversation but lose their content. */
  private shape(r: { m: typeof chatMessages.$inferSelect; senderName: string | null; senderRole: string | null; replyTo: any }, deletedByName?: string | null) {
    const removed = !!r.m.deletedAt;
    return {
      id: r.m.id,
      channelId: r.m.channelId,
      senderId: r.m.senderId,
      senderName: r.senderName || 'Former member',
      senderRole: r.senderRole,
      body: removed ? null : r.m.body,
      photoUrl: removed ? null : r.m.photoUrl,
      replyTo: r.replyTo && !r.replyTo.deleted ? r.replyTo : r.replyTo ? { ...r.replyTo, body: null, photo: false } : null,
      createdAt: r.m.createdAt,
      editedAt: r.m.editedAt,
      deletedAt: r.m.deletedAt,
      removedByModerator: removed && r.m.deletedBy !== r.m.senderId,
    };
  }

  /** A page of messages, newest last; `before` pages back in time. */
  async messages(channelId: string, userId: string, before?: string) {
    const me = await this.actor(userId);
    const c = await this.channelFor(channelId, me);
    const where = [eq(chatMessages.channelId, c.id)];
    if (before) {
      const at = new Date(before);
      if (isNaN(+at)) throw new BadRequestException('Bad paging cursor.');
      where.push(lt(chatMessages.createdAt, at));
    }
    const rows = await this.db
      .select(this.messageColumns())
      .from(chatMessages)
      .leftJoin(users, eq(users.id, chatMessages.senderId))
      .where(and(...where))
      .orderBy(desc(chatMessages.createdAt))
      .limit(PAGE + 1);
    const hasMore = rows.length > PAGE;
    const page = rows.slice(0, PAGE).reverse().map((r) => this.shape(r));
    const canPost = await this.canPost(c, me);
    return { channel: { id: c.id, type: c.type }, messages: page, hasMore, canPost: canPost.ok, cannotPostReason: canPost.reason, canModerate: this.canModerate(c, me) };
  }

  private canModerate(c: Channel, me: ChatActor) {
    return c.type !== 'DIRECT' && me.isCommittee;
  }

  private async canPost(c: Channel, me: ChatActor): Promise<{ ok: boolean; reason: string | null }> {
    if (c.type === 'SOCIETY') {
      const mute = await this.muted(me.userId);
      if (mute) {
        const until = new Date(mute.mutedUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
        return { ok: false, reason: `The committee has paused your posting in the society group until ${until}.${mute.reason ? ` Reason: ${mute.reason}` : ''}` };
      }
    }
    if (c.type === 'DIRECT') {
      // A private chat stays open while at least one of the two is on the committee.
      const others = (await this.directMembers(c.id)).filter((u) => u !== me.userId);
      if (!me.isCommittee) {
        const otherActor = others[0] ? await this.actor(others[0]).catch(() => null) : null;
        if (!otherActor?.isCommittee) return { ok: false, reason: 'This private chat is closed because neither of you is on the committee now.' };
      }
    }
    return { ok: true, reason: null };
  }

  async send(channelId: string, dto: { body: string | null; photoUrl: string | null; photoKey: string | null; replyToId: string | null }, userId: string) {
    const me = await this.actor(userId);
    const c = await this.channelFor(channelId, me);
    const allowed = await this.canPost(c, me);
    if (!allowed.ok) throw new ForbiddenException(allowed.reason);
    const body = dto.body?.trim() || null;
    if (!body && !dto.photoUrl) throw new BadRequestException('Write a message or add a photo.');
    if (dto.photoUrl) {
      // Only photos uploaded for this society's chat.
      if (!dto.photoKey || !dto.photoKey.startsWith(`societies/${this.societyId}/chat_photo/`) || !dto.photoUrl.endsWith(dto.photoKey)) {
        throw new BadRequestException('That photo was not uploaded for this chat.');
      }
    }
    if (dto.replyToId) {
      const [parent] = await this.db.select({ id: chatMessages.id }).from(chatMessages).where(and(eq(chatMessages.id, dto.replyToId), eq(chatMessages.channelId, c.id)));
      if (!parent) throw new BadRequestException('The message you are replying to is not in this chat.');
    }
    const now = new Date();
    const [row] = await this.db
      .insert(chatMessages)
      .values({ societyId: this.societyId, channelId: c.id, senderId: userId, body, photoUrl: dto.photoUrl, photoKey: dto.photoKey, replyToId: dto.replyToId, createdAt: now })
      .returning();
    await this.db.update(chatChannels).set({ lastMessageAt: now }).where(eq(chatChannels.id, c.id));
    await this.markRead(c.id, userId, now);

    const [full] = await this.db.select(this.messageColumns()).from(chatMessages).leftJoin(users, eq(users.id, chatMessages.senderId)).where(eq(chatMessages.id, row.id));
    const message = this.shape(full);
    const audience = { societyId: this.societyId, channelType: c.type as 'SOCIETY' | 'COMMITTEE' | 'DIRECT', userIds: c.type === 'DIRECT' ? await this.directMembers(c.id) : undefined };
    this.events.publish({ type: 'message', channelId: c.id, message }, audience);
    return message;
  }

  /** The sender removes their own message, or a committee member removes one from a group. */
  async remove(messageId: string, userId: string) {
    const me = await this.actor(userId);
    const [m] = await this.db.select().from(chatMessages).where(and(eq(chatMessages.id, messageId), eq(chatMessages.societyId, this.societyId)));
    if (!m) throw new NotFoundException('Message not found.');
    const c = await this.channelFor(m.channelId, me);
    const own = m.senderId === userId;
    if (!own && !this.canModerate(c, me)) throw new ForbiddenException('You can remove only your own messages.');
    if (m.deletedAt) throw new ConflictException('This message was already removed.');
    await this.db.update(chatMessages).set({ deletedAt: new Date(), deletedBy: userId }).where(eq(chatMessages.id, messageId));
    if (!own) await this.audit(userId, 'CHAT_MESSAGE_REMOVED', messageId, { senderId: m.senderId, body: m.body, photoUrl: m.photoUrl });
    const audience = { societyId: this.societyId, channelType: c.type as 'SOCIETY' | 'COMMITTEE' | 'DIRECT', userIds: c.type === 'DIRECT' ? await this.directMembers(c.id) : undefined };
    this.events.publish({ type: 'message_deleted', channelId: c.id, messageId, byModerator: !own }, audience);
    return { id: messageId, removed: true };
  }

  async markRead(channelId: string, userId: string, at = new Date()) {
    await this.db
      .insert(chatReads)
      .values({ channelId, userId, lastReadAt: at })
      .onConflictDoUpdate({ target: [chatReads.channelId, chatReads.userId], set: { lastReadAt: at } });
  }

  async read(channelId: string, userId: string) {
    const me = await this.actor(userId);
    const c = await this.channelFor(channelId, me);
    await this.markRead(c.id, userId);
    return { ok: true };
  }

  // ---------------------------------------------------------------- moderation

  async mute(targetUserId: string, hours: number, reason: string | null, userId: string) {
    const me = await this.actor(userId);
    if (!me.isCommittee) throw new ForbiddenException('Only committee members can do this.');
    const target = await this.actor(targetUserId).catch(() => null);
    if (!target) throw new BadRequestException('That person is not a member of this society.');
    if (target.isCommittee) throw new ForbiddenException('Committee members cannot be muted.');
    const until = new Date(Date.now() + hours * 3600_000);
    await this.db
      .insert(chatMutes)
      .values({ societyId: this.societyId, userId: targetUserId, mutedUntil: until, reason, mutedBy: userId })
      .onConflictDoUpdate({ target: [chatMutes.societyId, chatMutes.userId], set: { mutedUntil: until, reason, mutedBy: userId, createdAt: new Date() } });
    await this.audit(userId, 'CHAT_MUTE', targetUserId, { hours, reason });
    return { userId: targetUserId, mutedUntil: until };
  }

  async unmute(targetUserId: string, userId: string) {
    const me = await this.actor(userId);
    if (!me.isCommittee) throw new ForbiddenException('Only committee members can do this.');
    await this.db.delete(chatMutes).where(and(eq(chatMutes.societyId, this.societyId), eq(chatMutes.userId, targetUserId)));
    await this.audit(userId, 'CHAT_UNMUTE', targetUserId, null);
    return { userId: targetUserId, mutedUntil: null };
  }

  /** People currently muted in the society group (for the committee). */
  async mutes(userId: string) {
    const me = await this.actor(userId);
    if (!me.isCommittee) throw new ForbiddenException('Only committee members can do this.');
    return this.db
      .select({ userId: chatMutes.userId, name: users.name, mutedUntil: chatMutes.mutedUntil, reason: chatMutes.reason })
      .from(chatMutes)
      .innerJoin(users, eq(users.id, chatMutes.userId))
      .where(and(eq(chatMutes.societyId, this.societyId), gt(chatMutes.mutedUntil, new Date())));
  }

  private async audit(userId: string, action: string, entityId: string, newValues: any) {
    try {
      await this.db.insert(auditLogs).values({ societyId: this.societyId, userId, action, entityName: 'chat', entityId, newValues } as any);
    } catch (err: any) {
      this.logger.warn(`Audit log failed: ${err?.message}`);
    }
  }
}
