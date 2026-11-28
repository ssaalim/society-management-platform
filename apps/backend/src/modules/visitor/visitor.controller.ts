import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { VisitorService } from './visitor.service';
import { codeEntrySchema, dailyHelpSchema, decisionSchema, passSchema, walkInSchema } from './dto/visitor.dto';

/**
 * Residents (resident:*) answer for their flat, create guest passes and manage their daily help. The gate desk, the
 * log and blocking helpers are for security and the office; the service checks those roles.
 */
@ApiTags('Visitors')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@RequirePermissions('resident:read')
@Controller('visitors')
export class VisitorController {
  constructor(private readonly service: VisitorService) {}

  // ---------------------------------------------------------------- gate
  @ApiOperation({ summary: 'Gate desk: waiting, approved, inside' })
  @Get('gate')
  async gate(@Req() req: any) {
    return { success: true, data: await this.service.gate(req.user.id) };
  }

  @ApiOperation({ summary: 'Log a walk-in visitor' })
  @Post()
  async walkIn(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.logWalkIn(walkInSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Look up a pass or daily-help code' })
  @Get('code/:code')
  async checkCode(@Param('code') code: string, @Req() req: any) {
    return { success: true, data: await this.service.checkCode(code, req.user.id) };
  }

  @ApiOperation({ summary: 'Let someone in with a code' })
  @Post('code/:code/enter')
  async enter(@Param('code') code: string, @Body() body: any, @Req() req: any) {
    const dto = codeEntrySchema.parse(body ?? {});
    return { success: true, data: await this.service.enterWithCode(code, dto.flatId, dto.gateNo, req.user.id) };
  }

  @ApiOperation({ summary: "Guard records the resident's answer given by phone" })
  @Post(':id/guard-decision')
  async guardDecision(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    const dto = decisionSchema.parse(body);
    return { success: true, data: await this.service.guardDecision(id, dto.approve, dto.note, req.user.id) };
  }

  @ApiOperation({ summary: 'Let an approved visitor in' })
  @Post(':id/let-in')
  async letIn(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.letIn(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Mark a visitor as gone' })
  @Post(':id/exit')
  async exit(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.markExit(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Visitor log with totals (security and office)' })
  @Get('log')
  async log(@Req() req: any, @Query() q: any) {
    return { success: true, data: await this.service.log(req.user.id, q) };
  }

  // ---------------------------------------------------------------- resident
  @ApiOperation({ summary: 'Visits to my flats' })
  @Get('mine')
  async mine(@Req() req: any) {
    return { success: true, data: await this.service.mine(req.user.id) };
  }

  @ApiOperation({ summary: 'Allow or deny a visitor at the gate' })
  @RequirePermissions('resident:write')
  @Post(':id/decision')
  async decision(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    const dto = decisionSchema.parse(body);
    return { success: true, data: await this.service.residentDecision(id, dto.approve, dto.note, req.user.id) };
  }

  @ApiOperation({ summary: 'My guest passes' })
  @Get('passes/list')
  async passes(@Req() req: any) {
    return { success: true, data: await this.service.listPasses(req.user.id) };
  }

  @ApiOperation({ summary: 'Create a guest pass (code and QR)' })
  @RequirePermissions('resident:write')
  @Post('passes')
  async createPass(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createPass(passSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Cancel a guest pass' })
  @RequirePermissions('resident:write')
  @Post('passes/:id/revoke')
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.revokePass(id, req.user.id) };
  }

  // ---------------------------------------------------------------- daily help
  @ApiOperation({ summary: 'Daily help (residents: their flats)' })
  @Get('daily-help/list')
  async help(@Req() req: any) {
    return { success: true, data: await this.service.listDailyHelp(req.user.id) };
  }

  @ApiOperation({ summary: 'Add daily help to a flat' })
  @RequirePermissions('resident:write')
  @Post('daily-help')
  async addHelp(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.addDailyHelp(dailyHelpSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Remove daily help from a flat' })
  @RequirePermissions('resident:write')
  @Delete('daily-help/:id/flats/:flatId')
  async removeHelp(@Param('id', ParseUUIDPipe) id: string, @Param('flatId', ParseUUIDPipe) flatId: string, @Req() req: any) {
    return { success: true, data: await this.service.removeDailyHelp(id, flatId, req.user.id) };
  }

  @ApiOperation({ summary: 'Block or unblock daily help at the gate' })
  @Patch('daily-help/:id')
  async setHelp(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.setHelpActive(id, z.object({ isActive: z.boolean() }).parse(body).isActive, req.user.id) };
  }
}
