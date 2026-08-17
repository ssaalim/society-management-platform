import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Staff & Facility')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({ summary: 'List all society staff members and technicians' })
  @RequirePermissions('resident:read')
  @Get()
  async findAll() {
    const list = await this.staffService.findAll();
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Get specific staff member details' })
  @RequirePermissions('resident:read')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.staffService.findOne(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Register a new staff member or technician' })
  @RequirePermissions('member:write')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const result = await this.staffService.create(body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update staff member details' })
  @RequirePermissions('member:write')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.staffService.update(id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Remove a staff member' })
  @RequirePermissions('member:write')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const result = await this.staffService.remove(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
