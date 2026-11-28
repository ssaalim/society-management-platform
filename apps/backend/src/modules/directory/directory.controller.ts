import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { DirectoryService } from './directory.service';

@ApiTags('Directory')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@RequirePermissions('resident:read')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly service: DirectoryService) {}

  @ApiOperation({ summary: 'Wings and flats with residents’ names and occupancy (owner, tenant, empty)' })
  @Get()
  async list() {
    return { success: true, data: await this.service.directory() };
  }
}
