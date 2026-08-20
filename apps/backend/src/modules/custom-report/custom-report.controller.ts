import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomReportService } from './custom-report.service';
import { CreateCustomReportDto, UpdateCustomReportDto, ExecuteCustomReportDto } from './dto/custom-report.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';

@ApiTags('Custom Reports')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('custom-reports')
export class CustomReportController {
  constructor(private readonly customReportService: CustomReportService) {}

  // ─── CREATE ────────────────────────────────────────────────────
  @ApiOperation({ summary: 'Create a new custom SQL report (SUPER_ADMIN / SOCIETY_ADMIN only)' })
  @RequirePermissions('report:write')
  @Post()
  async create(@Body() dto: CreateCustomReportDto, @Req() req: any) {
    const report = await this.customReportService.create(dto, req.user.id);
    return { success: true, data: report };
  }

  // ─── LIST ──────────────────────────────────────────────────────
  @ApiOperation({ summary: 'List all custom reports for the active society' })
  @RequirePermissions('report:read')
  @Get()
  async findAll(@Req() req: any) {
    const reports = await this.customReportService.findAll(req.user.id);
    return { success: true, data: reports };
  }

  // ─── GET ONE ───────────────────────────────────────────────────
  @ApiOperation({ summary: 'Get a single custom report definition' })
  @RequirePermissions('report:read')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const report = await this.customReportService.findOne(id);
    return { success: true, data: report };
  }

  // ─── UPDATE ────────────────────────────────────────────────────
  @ApiOperation({ summary: 'Update a custom report definition (SUPER_ADMIN / SOCIETY_ADMIN only)' })
  @RequirePermissions('report:write')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomReportDto,
    @Req() req: any,
  ) {
    const report = await this.customReportService.update(id, dto, req.user.id);
    return { success: true, data: report };
  }

  // ─── DELETE ────────────────────────────────────────────────────
  @ApiOperation({ summary: 'Soft-delete a custom report (SUPER_ADMIN / SOCIETY_ADMIN only)' })
  @RequirePermissions('report:write')
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    await this.customReportService.remove(id, req.user.id);
    return { success: true, message: 'Report deleted successfully.' };
  }

  // ─── FAVORITE TOGGLE ───────────────────────────────────────────
  @ApiOperation({ summary: 'Toggle favorite status of a custom report for the current user' })
  @RequirePermissions('report:read')
  @Post(':id/favorite')
  async toggleFavorite(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const result = await this.customReportService.toggleFavorite(id, req.user.id);
    return { success: true, data: result };
  }

  // ─── EXECUTE ───────────────────────────────────────────────────
  @ApiOperation({ summary: 'Execute a custom report with parameter values (returns up to 2000 rows)' })
  @RequirePermissions('report:read')
  @Post(':id/execute')
  async execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteCustomReportDto,
    @Req() req: any,
  ) {
    const result = await this.customReportService.execute(id, dto, req.user?.id);
    return { success: true, data: result };
  }

  // ─── EXPORT CSV ────────────────────────────────────────────────
  @ApiOperation({ summary: 'Export a custom report result as CSV download' })
  @RequirePermissions('report:read')
  @Get(':id/export')
  async exportCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, string>,
    @Req() req: any,
    @Res() res: Response,
  ) {
    // Query params become the report params (excluding internal ones)
    const dto: ExecuteCustomReportDto = { params: query };
    const report = await this.customReportService.findOne(id);
    const csv = await this.customReportService.exportCsv(id, dto, req.user?.id);

    const safeFilename = report.name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}_report.csv"`);
    return res.send(csv);
  }
}
