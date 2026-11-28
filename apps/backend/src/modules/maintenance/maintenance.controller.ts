import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Req, 
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { GenerateBillsDto, generateBillsSchema } from './dto/generate-bills.dto';
import { billingCategorySchema, assignCategorySchema } from './dto/billing-category.dto';
import { BillingCategoryService } from './billing-category.service';
import { CreateReceiptDto, createReceiptSchema, bulkReceiptSchema } from './dto/create-receipt.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly billingCategoryService: BillingCategoryService,
  ) {}

  @ApiOperation({ summary: 'List billing categories (residential / commercial rates)' })
  @RequirePermissions('billing:read')
  @Get('categories')
  async listCategories() {
    return { success: true, data: await this.billingCategoryService.list() };
  }

  @ApiOperation({ summary: 'Create a billing category' })
  @RequirePermissions('billing:write')
  @Post('categories')
  async createCategory(@Body() body: any) {
    return { success: true, data: await this.billingCategoryService.create(billingCategorySchema.parse(body)) };
  }

  @ApiOperation({ summary: 'Assign units to a billing category (or clear with null)' })
  @RequirePermissions('billing:write')
  @Post('categories/assign')
  async assignCategory(@Body() body: any) {
    const dto = assignCategorySchema.parse(body);
    return { success: true, data: await this.billingCategoryService.assignFlats(dto.flatIds, dto.billingCategoryId) };
  }

  @ApiOperation({ summary: 'Update a billing category' })
  @RequirePermissions('billing:write')
  @Patch('categories/:categoryId')
  async updateCategory(@Param('categoryId') categoryId: string, @Body() body: any) {
    return { success: true, data: await this.billingCategoryService.update(categoryId, billingCategorySchema.parse(body)) };
  }

  @ApiOperation({ summary: 'Delete a billing category' })
  @RequirePermissions('billing:write')
  @Delete('categories/:categoryId')
  async deleteCategory(@Param('categoryId') categoryId: string) {
    return { success: true, data: await this.billingCategoryService.remove(categoryId) };
  }

  @ApiOperation({ summary: 'Preview a bill generation run (no bills are created)' })
  @RequirePermissions('billing:write')
  @Post('generate/preview')
  async previewBills(@Body() body: any) {
    const validatedDto = generateBillsSchema.parse(body);
    const result = await this.maintenanceService.previewBills(validatedDto);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Run batch sweep to generate maintenance bills' })
  @RequirePermissions('billing:write')
  @Post('generate')
  async generateBills(@Body() body: any, @Req() req: any) {
    const validatedDto = generateBillsSchema.parse(body);
    const result = await this.maintenanceService.generateBills(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Record a member payment receipt' })
  @RequirePermissions('billing:read')
  @Post('receipt')
  async recordPayment(@Body() body: any, @Req() req: any) {
    const validatedDto = createReceiptSchema.parse(body);
    const result = await this.maintenanceService.recordPayment(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Record a multi-invoice lump-sum payment receipt' })
  @RequirePermissions('billing:read')
  @Post('bulk-receipt')
  async recordBulkPayment(@Body() body: any, @Req() req: any) {
    const validatedDto = bulkReceiptSchema.parse(body);
    const result = await this.maintenanceService.recordBulkPayment(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Approve a payment receipt' })
  @RequirePermissions('billing:write')
  @Post('receipt/:id/approve')
  async approvePayment(@Param('id') id: string, @Req() req: any) {
    const result = await this.maintenanceService.approvePayment(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Reject a payment receipt' })
  @RequirePermissions('billing:write')
  @Post('receipt/:id/reject')
  async rejectPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.maintenanceService.rejectPayment(id, body.reason, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Statutory Transparency: Get outstanding maintenance dues by flat across the entire society' })
  @RequirePermissions('billing:read')
  @Get('society-dues')
  async getSocietyDues() {
    const list = await this.maintenanceService.getSocietyDuesTransparency();
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'List and filter invoices/bills' })
  @RequirePermissions('billing:read')
  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
  ) {
    const list = await this.maintenanceService.findAll({ search, status, mine: mine === 'true' }, req.user?.id);
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Get active maintenance calculation settings and formula parameters' })
  @RequirePermissions('billing:read')
  @Get('config')
  async getConfig() {
    const result = await this.maintenanceService.getConfig();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update maintenance calculation mode and rates' })
  @RequirePermissions('billing:write')
  @Post('config')
  async updateConfig(@Body() body: any) {
    const result = await this.maintenanceService.updateConfig(body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get single bill detailed profile' })
  @RequirePermissions('billing:read')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.maintenanceService.findOne(id);
    return {
      success: true,
      data: result,
    };
  }
}
