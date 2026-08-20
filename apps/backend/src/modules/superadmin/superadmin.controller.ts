import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Req 
} from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import { CreatePlanDto, createPlanSchema } from './dto/create-plan.dto';
import { createSocietySchema } from './dto/create-society.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { SuperAdminGuard } from '@core/auth/superadmin.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Super Admin Control')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, SuperAdminGuard, RolesGuard)
@Controller('superadmin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @ApiOperation({ summary: 'Retrieve Super Admin panel summary diagnostics' })
  @Get('dashboard')
  async getDashboard() {
    const result = await this.superAdminService.getDashboard();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List all societies along with their active plan and subscription metadata' })
  @Get('societies')
  async getSocieties() {
    const result = await this.superAdminService.getSocieties();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List all available subscription pricing plans' })
  @Get('plans')
  async getPlans() {
    const result = await this.superAdminService.getPlans();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Assign or renew a subscription plan for a society' })
  @Post('subscriptions')
  async assignSubscription(@Body() body: any, @Req() req: any) {
    const result = await this.superAdminService.assignSubscription(body, req.user?.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get list of societies with subscriptions expiring within 30 days' })
  @Get('expiring-soon')
  async getExpiringSoon() {
    const result = await this.superAdminService.getExpiringSoon(30);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get subscription status for a specific society' })
  @Get('societies/:id/subscription')
  async getSocietySubscriptionStatus(@Param('id') id: string) {
    const result = await this.superAdminService.getSocietySubscriptionStatus(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Create a new society along with president user and default ledgers' })
  @Post('societies')
  async createSociety(@Body() body: any, @Req() req: any) {
    const validatedDto = createSocietySchema.parse(body);
    const result = await this.superAdminService.createSociety(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Register global subscription billing plans packages' })
  @Post('plans')
  async createPlan(@Body() body: any, @Req() req: any) {
    const validatedDto = createPlanSchema.parse(body);
    const result = await this.superAdminService.createPlan(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Toggle rollout states on global feature flags configuration' })
  @Post('flags/:id/toggle')
  async toggleFlag(
    @Param('id') id: string,
    @Body('isEnabled') isEnabled: boolean,
    @Req() req: any
  ) {
    const result = await this.superAdminService.toggleFeatureFlag(id, isEnabled, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
