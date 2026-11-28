import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { FundService } from './fund.service';
import {
  approveClaimSchema,
  campaignSchema,
  claimSchema,
  expenseSchema,
  issueSchema,
  onlineOrderSchema,
  onlineVerifySchema,
  paymentSchema,
  reasonSchema,
  waiveSchema,
} from './dto/fund.dto';
import { RazorpayService } from './razorpay.service';

/** Members see funds and their own shares; running a fund is for the Treasurer, Secretary, President, Accountant and admins (checked in the service). */
@ApiTags('Funds')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@RequirePermissions('resident:read')
@Controller('funds')
export class FundController {
  constructor(
    private readonly service: FundService,
    private readonly razorpay: RazorpayService,
  ) {}

  @ApiOperation({ summary: 'Whether residents can pay online' })
  @Get('online/config')
  onlineConfig() {
    return { success: true, data: { enabled: this.razorpay.enabled, keyId: this.razorpay.enabled ? this.razorpay.keyId : null } };
  }

  @ApiOperation({ summary: 'Confirm an online payment after checkout' })
  @Post('online/verify')
  async verify(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.verifyOnline(onlineVerifySchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Funds with progress (and my share)' })
  @Get()
  async list(@Req() req: any) {
    return { success: true, data: await this.service.list(req.user.id) };
  }

  @ApiOperation({ summary: 'Create a fund (draft)' })
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.create(campaignSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'A fund with shares, payments and spending' })
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.detail(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Update a fund' })
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.update(id, campaignSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Delete a draft fund' })
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.remove(id, req.user.id) };
  }

  @ApiOperation({ summary: "Each flat's share, for review before issuing" })
  @Get(':id/preview')
  async preview(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.preview(id, req.user.id) };
  }

  @ApiOperation({ summary: 'Issue the shares and open the fund' })
  @Post(':id/issue')
  async issue(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.issue(id, issueSchema.parse(body).shares, req.user.id) };
  }

  @ApiOperation({ summary: 'Record money received' })
  @Post(':id/payments')
  async pay(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.recordPayment(id, paymentSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Record money spent from the fund' })
  @Post(':id/expenses')
  async spend(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.recordExpense(id, expenseSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Close the fund' })
  @Post(':id/close')
  async close(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.setStatus(id, 'CLOSED', req.user.id) };
  }

  @ApiOperation({ summary: 'Reopen a closed fund' })
  @Post(':id/reopen')
  async reopen(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.setStatus(id, 'ACTIVE', req.user.id) };
  }

  @ApiOperation({ summary: "Waive what is left of a flat's share" })
  @Patch('shares/:shareId/waive')
  async waive(@Param('shareId', ParseUUIDPipe) shareId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.waive(shareId, waiveSchema.parse(body).reason, req.user.id) };
  }

  @ApiOperation({ summary: 'Reverse a recorded payment' })
  @Post('payments/:paymentId/reverse')
  async reverse(@Param('paymentId', ParseUUIDPipe) paymentId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.reversePayment(paymentId, reasonSchema.parse(body).reason, req.user.id) };
  }

  @ApiOperation({ summary: 'Tell the office I have paid (needs approval)' })
  @Post(':id/claims')
  async claim(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.submitClaim(id, claimSchema.parse(body), req.user.id) };
  }

  @ApiOperation({ summary: 'Approve a reported payment (records it)' })
  @Post('claims/:claimId/approve')
  async approve(@Param('claimId', ParseUUIDPipe) claimId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.approveClaim(claimId, approveClaimSchema.parse(body || {}), req.user.id) };
  }

  @ApiOperation({ summary: 'Reject a reported payment' })
  @Post('claims/:claimId/reject')
  async reject(@Param('claimId', ParseUUIDPipe) claimId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.rejectClaim(claimId, reasonSchema.parse(body).reason, req.user.id) };
  }

  @ApiOperation({ summary: 'Start an online payment' })
  @Post(':id/online/order')
  async order(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.createOnlineOrder(id, onlineOrderSchema.parse(body || {}), req.user.id) };
  }
}

/** Razorpay calls this server-to-server; it is authenticated by its signature, not a login. */
@ApiTags('Funds')
@Controller('funds/online')
export class FundWebhookController {
  constructor(private readonly service: FundService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('webhook')
  async webhook(@Req() req: any, @Headers('x-razorpay-signature') signature: string | undefined) {
    return { success: true, data: await this.service.onlineWebhook(req.rawBody, signature) };
  }
}
