import { Body, Controller, Delete, Get, MessageEvent, Param, ParseUUIDPipe, Post, Query, Req, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, finalize, interval, map, merge } from 'rxjs';
import { z } from 'zod';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ChatService } from './chat.service';
import { ChatEvents } from './chat-events.service';

const sendSchema = z
  .object({
    body: z.string().max(4000).nullable().default(null),
    photoUrl: z.string().url().max(1000).nullable().default(null),
    photoKey: z.string().max(500).nullable().default(null),
    replyToId: z.string().uuid().nullable().default(null),
  })
  .refine((d) => (d.body && d.body.trim()) || d.photoUrl, { message: 'Write a message or add a photo.', path: ['body'] });
const muteSchema = z.object({ hours: z.coerce.number().int().min(1).max(24 * 90), reason: z.string().trim().max(300).nullable().default(null) });

/** Every society member can chat (resident:read); who can see and do what is decided in the service. */
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@RequirePermissions('resident:read')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly service: ChatService,
    private readonly events: ChatEvents,
  ) {}

  @ApiOperation({ summary: 'Live chat events (server-sent events); keep one open while chat is on screen' })
  @Sse('stream')
  async stream(@Req() req: any): Promise<Observable<MessageEvent>> {
    const me = await this.service.actor(req.user.id);
    const sub = this.events.subscribe(me.userId, this.service.societyId, me.isCommittee);
    // A ping every 25 s keeps proxies from closing an idle connection; it never touches the database.
    return merge(sub.stream, interval(25_000).pipe(map(() => ({ type: 'ping' as const })))).pipe(
      map((data) => ({ data }) as MessageEvent),
      finalize(() => sub.close()),
    );
  }

  @ApiOperation({ summary: 'My conversations with unread counts' })
  @Get('channels')
  async channels(@Req() req: any) {
    return { success: true, data: await this.service.channels(req.user.id) };
  }

  @ApiOperation({ summary: 'People a committee member can message privately' })
  @Get('people')
  async people(@Req() req: any) {
    return { success: true, data: await this.service.people(req.user.id) };
  }

  @ApiOperation({ summary: 'Start (or reopen) a private chat — committee members only' })
  @Post('direct/:userId')
  async direct(@Param('userId', ParseUUIDPipe) other: string, @Req() req: any) {
    return { success: true, data: await this.service.openDirect(other, req.user.id) };
  }

  @ApiOperation({ summary: 'Messages of a conversation (newest last; `before` pages back)' })
  @Get('channels/:id/messages')
  async messages(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Query('before') before?: string) {
    return { success: true, data: await this.service.messages(id, req.user.id, before) };
  }

  @ApiOperation({ summary: 'Send a message' })
  @RequirePermissions('resident:write')
  @Post('channels/:id/messages')
  async send(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.send(id, sendSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Mark a conversation as read' })
  @Post('channels/:id/read')
  async read(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.read(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Remove a message (your own, or any in a group for the committee)' })
  @Delete('messages/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.remove(id, req.user.id) };
  }

  @ApiOperation({ summary: 'People muted in the society group (committee)' })
  @Get('mutes')
  async mutes(@Req() req: any) {
    return { success: true, data: await this.service.mutes(req.user.id) };
  }

  @ApiOperation({ summary: 'Pause someone from posting in the society group (committee)' })
  @Post('mutes/:userId')
  async mute(@Param('userId', ParseUUIDPipe) userId: string, @Body() body: any, @Req() req: any) {
    const dto = muteSchema.parse(body);
    return { success: true, data: await this.service.mute(userId, dto.hours, dto.reason, req.user.id) };
  }

  @ApiOperation({ summary: 'Let someone post again (committee)' })
  @Delete('mutes/:userId')
  async unmute(@Param('userId', ParseUUIDPipe) userId: string, @Req() req: any) {
    return { success: true, data: await this.service.unmute(userId, req.user.id) };
  }
}
