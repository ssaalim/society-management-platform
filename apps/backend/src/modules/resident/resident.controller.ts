import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { ResidentService } from './resident.service';
import { VotePollDto, votePollSchema } from './dto/vote-poll.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Resident Portal')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('residents')
export class ResidentController {
  constructor(private readonly residentService: ResidentService) {}

  @ApiOperation({ summary: 'Retrieve resident flat dashboard variables summary' })
  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    const result = await this.residentService.getDashboard(req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Approve visitor checkin gate access pre-authorizations' })
  @Post('visitors/:id/approve')
  async approveVisitor(
    @Param('id') id: string,
    @Body('approve') approve: boolean,
    @Req() req: any
  ) {
    const result = await this.residentService.approveVisitor(req.user.id, id, approve, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Cast ballot voting choices inside society active polls' })
  @Post('polls/:id/vote')
  async votePoll(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any
  ) {
    const validatedDto = votePollSchema.parse(body);
    const result = await this.residentService.votePoll(req.user.id, id, validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
