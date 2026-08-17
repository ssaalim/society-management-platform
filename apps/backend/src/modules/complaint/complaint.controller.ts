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
import { ComplaintService } from './complaint.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @ApiOperation({ summary: 'List and filter complaint tickets' })
  @RequirePermissions('resident:read')
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Req() req?: any
  ) {
    const list = await this.complaintService.findAll({ status, priority }, req?.user?.id);
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'List active society staff for assignment' })
  @RequirePermissions('resident:read')
  @Get('staff-list')
  async getStaffList() {
    const list = await this.complaintService.getStaffList();
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Raise a new complaint ticket' })
  @RequirePermissions('resident:write')
  @Post()
  async createComplaint(@Body() body: any, @Req() req: any) {
    const result = await this.complaintService.createComplaint(body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Assign staff members to ticket complaints' })
  @RequirePermissions('member:write')
  @Post(':id/assign')
  async assignStaff(
    @Param('id') id: string,
    @Body() body: { staffId?: string; staffName?: string },
    @Req() req: any
  ) {
    const result = await this.complaintService.assignStaff(id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Record resolution comment and mark complaint resolved' })
  @RequirePermissions('member:write')
  @Post(':id/resolve')
  async resolveComplaint(
    @Param('id') id: string,
    @Body() body: { resolutionComment: string },
    @Req() req: any
  ) {
    const result = await this.complaintService.resolveComplaint(id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Escalate a complaint ticket manually' })
  @RequirePermissions('resident:write')
  @Post(':id/escalate')
  async escalateTicket(@Param('id') id: string, @Req() req: any) {
    const result = await this.complaintService.escalateTicket(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Submit feedback review comments & rating to close complaints' })
  @RequirePermissions('resident:write')
  @Post(':id/feedback')
  async submitFeedback(
    @Param('id') id: string,
    @Body() body: { feedback: string; rating?: number },
    @Req() req: any
  ) {
    const result = await this.complaintService.submitFeedback(id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
