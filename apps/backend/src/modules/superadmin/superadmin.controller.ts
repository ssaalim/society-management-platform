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
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Super Admin Control')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
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
