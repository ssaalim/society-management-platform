import { 
  Controller, 
  Get, 
  Post, 
  Delete,
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

  // ==========================================
  // VEHICLES
  // ==========================================

  @ApiOperation({ summary: 'List vehicles registered for flat/society' })
  @Get('vehicles')
  async getVehicles(@Req() req: any) {
    const list = await this.residentService.getVehicles(req.user.id);
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Register a vehicle' })
  @Post('vehicles')
  async addVehicle(@Body() body: any, @Req() req: any) {
    const result = await this.residentService.addVehicle(req.user.id, body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Remove a registered vehicle' })
  @Delete('vehicles/:id')
  async deleteVehicle(@Param('id') id: string, @Req() req: any) {
    const result = await this.residentService.deleteVehicle(req.user.id, id);
    return {
      success: true,
      data: result,
    };
  }

  // ==========================================
  // CIRCULARS & DOCUMENTS
  // ==========================================

  @ApiOperation({ summary: 'List published society circulars and shared documents' })
  @Get('documents')
  async getDocuments() {
    const list = await this.residentService.getDocuments();
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Publish a circular or upload a shared document' })
  @Post('documents')
  async addDocument(@Body() body: any, @Req() req: any) {
    const result = await this.residentService.addDocument(req.user.id, body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Delete a published document' })
  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string, @Req() req: any) {
    const result = await this.residentService.deleteDocument(req.user.id, id);
    return {
      success: true,
      data: result,
    };
  }

  // ==========================================
  // GENERAL BODY PROPOSALS & POLLS
  // ==========================================

  @ApiOperation({ summary: 'List active general body proposals & voting polls' })
  @Get('polls')
  async getPolls(@Req() req: any) {
    const list = await this.residentService.getPolls(req.user.id);
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Create a new general body proposal poll' })
  @Post('polls')
  async createPoll(@Body() body: any, @Req() req: any) {
    const result = await this.residentService.createPoll(req.user.id, body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Delete a proposal poll' })
  @Delete('polls/:id')
  async deletePoll(@Param('id') id: string, @Req() req: any) {
    const result = await this.residentService.deletePoll(req.user.id, id);
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

  // ==========================================
  // VISITOR CLEARANCE
  // ==========================================

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
}
