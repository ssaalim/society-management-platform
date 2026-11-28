import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { CommitteeService } from './committee.service';
import { contactSchema, endPositionSchema, positionSchema, termSchema } from './dto/committee.dto';

/** Everyone in the society can see the committee; changes are limited to the President, Secretary and admins (checked in the service). */
@ApiTags('Committee')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('committee')
export class CommitteeController {
  constructor(private readonly service: CommitteeService) {}

  @ApiOperation({ summary: 'The current managing committee' })
  @RequirePermissions('resident:read')
  @Get('current')
  async current(@Req() req: any) {
    return { success: true, data: await this.service.current(req.user.id) };
  }

  @ApiOperation({ summary: 'Committee terms (current, past; drafts for the office)' })
  @RequirePermissions('resident:read')
  @Get('terms')
  async terms(@Req() req: any) {
    return { success: true, data: await this.service.listTerms(req.user.id) };
  }

  @ApiOperation({ summary: 'Members who can be given a post' })
  @RequirePermissions('member:read')
  @Get('eligible-members')
  async eligible() {
    return { success: true, data: await this.service.eligibleMembers() };
  }

  @ApiOperation({ summary: 'One term with its posts' })
  @RequirePermissions('resident:read')
  @Get('terms/:id')
  async term(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.termDetail(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Create a draft term' })
  @RequirePermissions('member:write')
  @Post('terms')
  async createTerm(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createTerm(termSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: "Create a draft term from today's committee roles" })
  @RequirePermissions('member:write')
  @Post('terms/from-current-roles')
  async fromRoles(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.draftFromCurrentRoles(termSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Update a term' })
  @RequirePermissions('member:write')
  @Patch('terms/:id')
  async updateTerm(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.updateTerm(id, termSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Delete a draft term' })
  @RequirePermissions('member:write')
  @Delete('terms/:id')
  async removeTerm(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.removeTerm(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Who gains and loses access if this term is made current' })
  @RequirePermissions('member:write')
  @Get('terms/:id/handover-preview')
  async preview(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.handoverPreview(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Handover: make this term the current committee' })
  @RequirePermissions('member:write')
  @Post('terms/:id/make-current')
  async makeCurrent(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.makeCurrent(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Add a post to a term' })
  @RequirePermissions('member:write')
  @Post('terms/:id/positions')
  async addPosition(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.addPosition(id, positionSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Update a post' })
  @RequirePermissions('member:write')
  @Patch('positions/:id')
  async updatePosition(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.updatePosition(id, positionSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'End a post mid-term (deletes it in a draft term)' })
  @RequirePermissions('member:write')
  @Post('positions/:id/end')
  async endPosition(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    const dto = endPositionSchema.parse(body);
    return { success: true, data: await this.service.endPosition(id, dto.endDate, dto.reason, req.user.id) };
  }

  @ApiOperation({ summary: 'Show or hide my phone and email to residents' })
  @RequirePermissions('resident:read')
  @Patch('positions/:id/contact')
  async contact(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.setContactVisibility(id, contactSchema.parse(body).showContact, req.user.id) };
  }
}
