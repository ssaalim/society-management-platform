import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { RecurringExpenseService } from './recurring-expense.service';
import { postDraftSchema, recurringExpenseSchema } from './dto/recurring-expense.dto';

@ApiTags('Accounting')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('accounting/recurring-expenses')
export class RecurringExpenseController {
  constructor(private readonly service: RecurringExpenseService) {}

  @ApiOperation({ summary: 'List recurring expenses (salaries, utilities, AMCs)' })
  @RequirePermissions('accounting:read')
  @Get()
  async list() {
    await this.service.ensureUpToDate();
    return { success: true, data: await this.service.list() };
  }

  @ApiOperation({ summary: 'Expense heads (expense ledgers) to choose from' })
  @RequirePermissions('accounting:read')
  @Get('expense-heads')
  async expenseHeads() {
    return { success: true, data: await this.service.expenseHeads() };
  }

  @ApiOperation({ summary: 'Drafted expenses waiting for review' })
  @RequirePermissions('accounting:read')
  @Get('drafts')
  async drafts() {
    await this.service.ensureUpToDate();
    return { success: true, data: await this.service.drafts() };
  }

  @ApiOperation({ summary: 'Create a recurring expense' })
  @RequirePermissions('accounting:write')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.create(recurringExpenseSchema.parse(body), req.user?.id) };
  }

  @ApiOperation({ summary: 'Draft every recurring expense that is due now' })
  @RequirePermissions('accounting:write')
  @Post('run')
  async run() {
    return { success: true, data: await this.service.runDueNow() };
  }

  @ApiOperation({ summary: 'Confirm a drafted expense and post it to the books' })
  @RequirePermissions('accounting:write')
  @Post('drafts/:expenseId/post')
  async post(@Param('expenseId', ParseUUIDPipe) expenseId: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.postDraft(expenseId, postDraftSchema.parse(body), req.user?.id) };
  }

  @ApiOperation({ summary: 'Skip a drafted expense for its period' })
  @RequirePermissions('accounting:write')
  @Post('drafts/:expenseId/skip')
  async skip(@Param('expenseId', ParseUUIDPipe) expenseId: string, @Req() req: any) {
    return { success: true, data: await this.service.skipDraft(expenseId, req.user?.id) };
  }

  @ApiOperation({ summary: 'Expenses posted from a recurring expense' })
  @RequirePermissions('accounting:read')
  @Get(':id/history')
  async history(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.service.history(id) };
  }

  @ApiOperation({ summary: 'Update, pause or resume a recurring expense' })
  @RequirePermissions('accounting:write')
  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any, @Req() req: any) {
    return { success: true, data: await this.service.update(id, recurringExpenseSchema.parse(body), req.user?.id) };
  }

  @ApiOperation({ summary: 'Delete a recurring expense (posted expenses are kept)' })
  @RequirePermissions('accounting:write')
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return { success: true, data: await this.service.remove(id, req.user?.id) };
  }
}
