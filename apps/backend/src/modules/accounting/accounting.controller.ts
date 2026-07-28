import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Req, 
  Query 
} from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateVoucherDto, createVoucherSchema } from './dto/create-voucher.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Accounting')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @ApiOperation({ summary: 'Post a balanced double-entry journal voucher' })
  @RequirePermissions('accounting:write')
  @Post('vouchers')
  async createVoucher(@Body() body: any, @Req() req: any) {
    const validatedDto = createVoucherSchema.parse(body);
    const result = await this.accountingService.createVoucher(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List all expenditure logs and vendor bills' })
  @RequirePermissions('accounting:read')
  @Get('expenses')
  async getExpenses() {
    const list = await this.accountingService.getExpenses();
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Record a new society expenditure or vendor bill' })
  @RequirePermissions('accounting:write')
  @Post('expenses')
  async createExpense(@Body() body: any, @Req() req: any) {
    const result = await this.accountingService.createExpense(body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List and filter journal vouchers logs' })
  @RequirePermissions('accounting:read')
  @Get('vouchers')
  async findAll(@Query('type') type?: string) {
    const list = await this.accountingService.findAll({ type });
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Generate mathematical Trial Balance ledger coordinates' })
  @RequirePermissions('accounting:read')
  @Get('reports/trial-balance')
  async getTrialBalance() {
    const result = await this.accountingService.getTrialBalance();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Generate Income & Expenditure statement' })
  @RequirePermissions('accounting:read')
  @Get('reports/income-expenditure')
  async getIncomeExpenditure() {
    const result = await this.accountingService.getIncomeExpenditure();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Generate Balance Sheet assets and liabilities report' })
  @RequirePermissions('accounting:read')
  @Get('reports/balance-sheet')
  async getBalanceSheet() {
    const result = await this.accountingService.getBalanceSheet();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Automate financial year end closing adjustments' })
  @RequirePermissions('accounting:write')
  @Post('close-year')
  async closeFinancialYear(@Req() req: any) {
    const result = await this.accountingService.closeFinancialYear(req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
