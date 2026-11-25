import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { FacilityService } from './facility.service';
import { decisionSchema, paymentSchema, refundSchema, serviceChargeSchema, serviceRequestSchema } from './dto/facility.dto';

/**
 * Residents (resident:*) see the catalogue, request and cancel; approving needs member:write, payments and refunds
 * accounting:write, and editing the catalogue society:write (management roles pass all of these).
 */
@ApiTags('Facilities')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('facilities')
export class FacilityController {
  constructor(private readonly service: FacilityService) {}

  @ApiOperation({ summary: 'Facility & service catalogue (residents see what they can request)' })
  @RequirePermissions('resident:read')
  @Get('charges')
  async charges(@Req() req: any) {
    return { success: true, data: await this.service.listCharges(req.user.id) };
  }

  @ApiOperation({ summary: 'Add a facility or service charge' })
  @RequirePermissions('society:write')
  @Post('charges')
  async createCharge(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createCharge(serviceChargeSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Update a facility or service charge' })
  @RequirePermissions('society:write')
  @Patch('charges/:id')
  async updateCharge(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.updateCharge(id, serviceChargeSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Delete a facility (switched off instead if it has requests)' })
  @RequirePermissions('society:write')
  @Delete('charges/:id')
  async removeCharge(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.removeCharge(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Booked slots of a facility in a date range' })
  @RequirePermissions('resident:read')
  @Get('charges/:id/bookings')
  async bookings(@Param('id', ParseUUIDPipe) id: string, @Query('from') from: string, @Query('to') to: string) {
    return { success: true, data: await this.service.bookings(id, from, to) };
  }

  @ApiOperation({ summary: 'Counts of requests waiting for approval, payment and deposit refund' })
  @RequirePermissions('member:write')
  @Get('summary')
  async summary(@Req() req: any) {
    return { success: true, data: await this.service.summary(req.user.id) };
  }

  @ApiOperation({ summary: 'Requests (residents: their own flat)' })
  @RequirePermissions('resident:read')
  @Get('requests')
  async requests(@Req() req: any, @Query('status') status?: string) {
    return { success: true, data: await this.service.listRequests(req.user.id, status || undefined) };
  }

  @ApiOperation({ summary: 'Request a facility or service' })
  @RequirePermissions('resident:write')
  @Post('requests')
  async create(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createRequest(serviceRequestSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'One request' })
  @RequirePermissions('resident:read')
  @Get('requests/:id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.getRequest(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Approve a request (issues the invoice number)' })
  @RequirePermissions('member:write')
  @Post('requests/:id/approve')
  async approve(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.approve(id, decisionSchema.parse(body ?? {}).note, req.user.id) };
  }

  @ApiOperation({ summary: 'Reject a request' })
  @RequirePermissions('member:write')
  @Post('requests/:id/reject')
  async reject(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.reject(id, decisionSchema.parse(body ?? {}).note, req.user.id) };
  }

  @ApiOperation({ summary: 'Cancel a request before it is paid' })
  @RequirePermissions('resident:write')
  @Post('requests/:id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.cancel(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Mark an approved request as done' })
  @RequirePermissions('member:write')
  @Post('requests/:id/complete')
  async complete(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.complete(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Record payment and post the receipt' })
  @RequirePermissions('accounting:write')
  @Post('requests/:id/payment')
  async pay(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.recordPayment(id, paymentSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Record the deposit refund (part may be kept for damages)' })
  @RequirePermissions('accounting:write')
  @Post('requests/:id/refund-deposit')
  async refund(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.refundDeposit(id, refundSchema.parse(body), req.user.id) };
  }
}
