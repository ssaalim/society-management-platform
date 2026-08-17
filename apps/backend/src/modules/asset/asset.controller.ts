import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete,
  Body, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { AssetService } from './asset.service';
import { CreateAssetLogDto, createAssetLogSchema } from './dto/create-asset-log.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @ApiOperation({ summary: 'List all society capital assets' })
  @RequirePermissions('society:read')
  @Get()
  async findAll() {
    const list = await this.assetService.findAll();
    return { success: true, data: list };
  }

  @ApiOperation({ summary: 'Add a new society capital asset' })
  @RequirePermissions('society:write')
  @Post()
  async createAsset(@Body() body: any, @Req() req: any) {
    const result = await this.assetService.createAsset(body, req.user?.id);
    return { success: true, data: result };
  }

  @ApiOperation({ summary: 'Update an existing society capital asset' })
  @RequirePermissions('society:write')
  @Put(':id')
  async updateAsset(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.assetService.updateAsset(id, body, req.user?.id);
    return { success: true, data: result };
  }

  @ApiOperation({ summary: 'Delete / remove a society capital asset' })
  @RequirePermissions('society:write')
  @Delete(':id')
  async deleteAsset(@Param('id') id: string, @Req() req: any) {
    const result = await this.assetService.deleteAsset(id, req.user?.id);
    return { success: true, data: result };
  }

  @ApiOperation({ summary: 'Register maintenance schedule or repair records' })
  @RequirePermissions('society:write')
  @Post(':id/logs')
  async createAssetLog(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const validatedDto = createAssetLogSchema.parse(body);
    const result = await this.assetService.createAssetLog(id, validatedDto, req.user?.id);
    return { success: true, data: result };
  }

  @ApiOperation({ summary: 'Aggregate asset maintenance cost reports' })
  @RequirePermissions('society:read')
  @Get('reports/cost-analysis')
  async getCostAnalysis() {
    const result = await this.assetService.getCostAnalysis();
    return { success: true, data: result };
  }
}
