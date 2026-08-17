import { 
  Controller, 
  Get, 
  UseGuards, 
  Query, 
  Res 
} from '@nestjs/common';
import { ReportService } from './report.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Reports')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get payment collection reports summary by payment mode' })
  @RequirePermissions('accounting:read')
  @Get('collection')
  async getCollectionReport() {
    const result = await this.reportService.getCollectionReport();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get defaulting payment member accounts' })
  @RequirePermissions('accounting:read')
  @Get('defaulter')
  async getDefaultersReport() {
    const result = await this.reportService.getDefaultersReport();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get flat occupancy distribution ratios' })
  @RequirePermissions('flat:read')
  @Get('occupancy')
  async getOccupancyReport() {
    const result = await this.reportService.getOccupancyReport();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get monthly collection trend for last 12 months' })
  @RequirePermissions('accounting:read')
  @Get('monthly-trend')
  async getMonthlyCollectionTrend() {
    const result = await this.reportService.getMonthlyCollectionTrend();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get maintenance invoice status breakdown with collection efficiency' })
  @RequirePermissions('maintenance:read')
  @Get('maintenance-status')
  async getMaintenanceStatusBreakdown() {
    const result = await this.reportService.getMaintenanceStatusBreakdown();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get complaints analytics by status and priority' })
  @RequirePermissions('complaint:read')
  @Get('complaints-analytics')
  async getComplaintsAnalytics() {
    const result = await this.reportService.getComplaintsAnalytics();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get asset register summary by category' })
  @RequirePermissions('asset:read')
  @Get('asset-summary')
  async getAssetSummary() {
    const result = await this.reportService.getAssetSummary();
    return { success: true, data: result };
  }

  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
  @ApiOperation({ summary: 'Get late fee and discount/waiver analytics' })
  @RequirePermissions('accounting:read')
  @Get('late-fee')
  async getLateFeeReport() {
    const result = await this.reportService.getLateFeeReport();
    return { success: true, data: result };
  }

  @ApiOperation({ summary: 'Export data reports dynamically to CSV sheet files' })
  @Get('export')
  async exportCSV(
    @Query('type') type: string,
    @Res() res: Response
  ) {
    const csvContent = await this.reportService.exportCSV(type);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
    return res.send(csvContent);
  }
}
