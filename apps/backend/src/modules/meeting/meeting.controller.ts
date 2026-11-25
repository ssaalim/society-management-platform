import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { MeetingService } from './meeting.service';
import { ResolutionService } from './resolution.service';
import {
  actionItemSchema,
  actionStatusSchema,
  agendaItemSchema,
  attendanceSchema,
  cancelSchema,
  meetingSchema,
  minutesSchema,
  openVotingSchema,
  proxySchema,
  recordProxySchema,
  recordVoteSchema,
  resolutionSchema,
  rsvpSchema,
  voteSchema,
} from './dto/meeting.dto';

/**
 * Every society member can read meetings they are invited to, reply and vote (resident:*). Running meetings is limited
 * to the Secretary, President, Joint Secretary and admins; the services check that.
 */
@ApiTags('Meetings')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@RequirePermissions('resident:read')
@Controller('meetings')
export class MeetingController {
  constructor(
    private readonly meetings: MeetingService,
    private readonly resolutions: ResolutionService,
  ) {}

  // ---------------------------------------------------------------- meetings
  @ApiOperation({ summary: 'Meetings I can see' })
  @Get()
  async list(@Req() req: any) {
    return { success: true, data: await this.meetings.list(req.user.id) };
  }

  @ApiOperation({ summary: 'Open action items (mine, or all for the committee)' })
  @Get('action-items/open')
  async openActions(@Req() req: any) {
    return { success: true, data: await this.meetings.openActionItems(req.user.id) };
  }

  @ApiOperation({ summary: 'Create a meeting (draft)' })
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.create(meetingSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'One meeting with agenda, replies, attendance, minutes and action items' })
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.detail(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Update a meeting' })
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.update(id, meetingSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Delete a draft meeting' })
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.remove(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Send the notice to invitees' })
  @Post(':id/notice')
  async notice(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.sendNotice(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Cancel a meeting' })
  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.cancel(id, cancelSchema.parse(body ?? {}).reason, req.user.id) };
  }

  @ApiOperation({ summary: 'Mark the meeting as held' })
  @Post(':id/held')
  async held(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.markHeld(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Reply: attending, not attending or tentative' })
  @RequirePermissions('resident:write')
  @Put(':id/rsvp')
  async rsvp(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.rsvp(id, rsvpSchema.parse(body).response, req.user.id) };
  }

  @ApiOperation({ summary: 'Mark someone present or absent' })
  @Put(':id/attendance')
  async attendance(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    const dto = attendanceSchema.parse(body);
    return { success: true, data: await this.meetings.setAttendance(id, dto.userId, dto.present, req.user.id, dto.viaProxy) };
  }

  @ApiOperation({ summary: 'Members who can be chosen as proxy (flats only for residents)' })
  @Get(':id/proxy-candidates')
  async proxyCandidates(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.proxyCandidates(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Appoint my proxy for this meeting' })
  @RequirePermissions('resident:write')
  @Put(':id/proxy')
  async appointProxy(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.appointProxy(id, proxySchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Withdraw my proxy' })
  @RequirePermissions('resident:write')
  @Delete(':id/proxy')
  async revokeProxy(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.revokeProxy(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Record a paper proxy form for a member (office)' })
  @Post(':id/proxies')
  async recordProxy(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.recordProxy(id, recordProxySchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Remove a proxy (office)' })
  @Delete('proxies/:proxyId')
  async removeProxy(@Param('proxyId', ParseUUIDPipe) proxyId: string, @Req() req: any) {
    return { success: true, data: await this.meetings.removeProxy(proxyId, req.user.id) };
  }

  @ApiOperation({ summary: 'Save the draft minutes' })
  @Put(':id/minutes')
  async minutes(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.saveMinutes(id, minutesSchema.parse(body).content, req.user.id) };
  }

  @ApiOperation({ summary: 'Finalise the minutes and share them' })
  @Post(':id/minutes/finalise')
  async finalise(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.meetings.finaliseMinutes(id, req.user.id) };
  }

  // ---------------------------------------------------------------- agenda
  @ApiOperation({ summary: 'Add an agenda item' })
  @Post(':id/agenda')
  async addAgenda(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.addAgendaItem(id, agendaItemSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Update an agenda item' })
  @Patch('agenda/:itemId')
  async updateAgenda(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.updateAgendaItem(itemId, agendaItemSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Remove an agenda item' })
  @Delete('agenda/:itemId')
  async removeAgenda(@Param('itemId', ParseUUIDPipe) itemId: string, @Req() req: any) {
    return { success: true, data: await this.meetings.removeAgendaItem(itemId, req.user.id) };
  }

  // ---------------------------------------------------------------- action items
  @ApiOperation({ summary: 'Add an action item' })
  @Post(':id/action-items')
  async addAction(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.addActionItem(id, actionItemSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Update an action item' })
  @Patch('action-items/:itemId')
  async updateAction(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.meetings.updateActionItem(itemId, actionItemSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Update progress of an action item (owner or office)' })
  @RequirePermissions('resident:write')
  @Patch('action-items/:itemId/status')
  async actionStatus(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() body: any, @Req() req: any) {
    const dto = actionStatusSchema.parse(body);
    return { success: true, data: await this.meetings.setActionStatus(itemId, dto.status, dto.notes, req.user.id) };
  }

  @ApiOperation({ summary: 'Delete an action item' })
  @Delete('action-items/:itemId')
  async removeAction(@Param('itemId', ParseUUIDPipe) itemId: string, @Req() req: any) {
    return { success: true, data: await this.meetings.removeActionItem(itemId, req.user.id) };
  }

  // ---------------------------------------------------------------- resolutions
  @ApiOperation({ summary: "A meeting's resolutions, with my ballots" })
  @Get(':id/resolutions')
  async resolutionsOf(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.resolutions.list(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Draft a resolution' })
  @Post(':id/resolutions')
  async createResolution(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.resolutions.create(id, resolutionSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Edit a draft resolution' })
  @Patch('resolutions/:rid')
  async updateResolution(@Param('rid', ParseUUIDPipe) rid: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.resolutions.update(rid, resolutionSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Delete a draft resolution' })
  @Delete('resolutions/:rid')
  async removeResolution(@Param('rid', ParseUUIDPipe) rid: string, @Req() req: any) {
    return { success: true, data: await this.resolutions.remove(rid, req.user.id) };
  }

  @ApiOperation({ summary: 'Open voting until a deadline' })
  @Post('resolutions/:rid/open')
  async openVoting(@Param('rid', ParseUUIDPipe) rid: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.resolutions.openVoting(rid, openVotingSchema.parse(body).deadline, req.user.id) };
  }

  @ApiOperation({ summary: 'Extend the voting deadline' })
  @Post('resolutions/:rid/extend')
  async extend(@Param('rid', ParseUUIDPipe) rid: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.resolutions.extend(rid, openVotingSchema.parse(body).deadline, req.user.id) };
  }

  @ApiOperation({ summary: 'Vote For, Against or Abstain' })
  @RequirePermissions('resident:write')
  @Post('resolutions/:rid/vote')
  async vote(@Param('rid', ParseUUIDPipe) rid: string, @Body() body: any, @Req() req: any) {
    const dto = voteSchema.parse(body);
    return { success: true, data: await this.resolutions.vote(rid, dto.choice, dto.flatId, req.user.id, dto.onBehalfOf) };
  }

  @ApiOperation({ summary: "Record a member's confirmed vote after the deadline" })
  @Post('resolutions/:rid/record-vote')
  async recordVote(@Param('rid', ParseUUIDPipe) rid: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.resolutions.recordVote(rid, recordVoteSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Close voting and declare the result' })
  @Post('resolutions/:rid/close')
  async close(@Param('rid', ParseUUIDPipe) rid: string, @Req() req: any) {
    return { success: true, data: await this.resolutions.close(rid, req.user.id) };
  }
}
