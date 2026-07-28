import { 
  Controller, 
  Get,
  Post, 
  Body, 
  Param, 
  Query,
  UseGuards, 
  Req 
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreateOrderDto, createOrderSchema } from './dto/create-order.dto';
import { RefundPaymentDto, refundPaymentSchema } from './dto/refund-payment.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get payment receipts roster scoped by user role' })
  @RequirePermissions('billing:read')
  @Get('receipts')
  async findAll(@Query() query: any, @Req() req: any) {
    const result = await this.paymentService.findAll(query, req.user?.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Create a payment gateway checkout order' })
  @RequirePermissions('billing:write')
  @Post('order')
  async createOrder(@Body() body: any, @Req() req: any) {
    const validatedDto = createOrderSchema.parse(body);
    const result = await this.paymentService.createOrder(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Razorpay webhook transaction listener' })
  @Post('webhook')
  async capturePaymentWebhook(@Body() body: any) {
    // Standard mock capture parameters
    const result = await this.paymentService.capturePaymentWebhook(body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Issue a refund for a payment receipt' })
  @RequirePermissions('billing:write')
  @Post('receipts/:id/refund')
  async refundPayment(
    @Param('id') id: string, 
    @Body() body: any, 
    @Req() req: any
  ) {
    const validatedDto = refundPaymentSchema.parse(body);
    const result = await this.paymentService.refundPayment(id, validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Cancel a payment receipt and reverse entries' })
  @RequirePermissions('billing:write')
  @Post('receipts/:id/cancel')
  async cancelPayment(
    @Param('id') id: string, 
    @Body('reason') reason: string, 
    @Req() req: any
  ) {
    const result = await this.paymentService.cancelPayment(id, reason, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
