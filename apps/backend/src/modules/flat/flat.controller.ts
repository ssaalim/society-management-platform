import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  UseGuards, 
  Req, 
  Query 
} from '@nestjs/common';
import { FlatService } from './flat.service';
import { CreateFlatDto, createFlatSchema } from './dto/create-flat.dto';
import { UpdateFlatDto, updateFlatSchema } from './dto/update-flat.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Flats')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('flats')
export class FlatController {
  constructor(private readonly flatService: FlatService) {}

  @ApiOperation({ summary: 'Create a new flat layout' })
  @RequirePermissions('flat:write')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const validatedDto = createFlatSchema.parse(body);
    const result = await this.flatService.create(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Import flats using a JSON bulk payload' })
  @RequirePermissions('flat:write')
  @Post('bulk')
  async importBulk(@Body() body: any[], @Req() req: any) {
    const result = await this.flatService.bulkCreate(body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List and filter flats' })
  @RequirePermissions('flat:read')
  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('buildingId') buildingId?: string,
    @Query('wingId') wingId?: string,
    @Query('occupancyStatus') occupancyStatus?: string,
    @Query('ownerMemberId') ownerMemberId?: string,
  ) {
    const list = await this.flatService.findAll({ search, buildingId, wingId, occupancyStatus, ownerMemberId }, req.user?.id);
    return {
      success: true,
      data: list,
    };
  }

  // ==========================================
  // Layout Master Configuration Endpoints
  // ==========================================

  @ApiOperation({ summary: 'Get society layout hierarchy (Buildings -> Wings -> Floors)' })
  @RequirePermissions('flat:read')
  @Get('layout')
  async getLayoutHierarchy() {
    const result = await this.flatService.getLayoutHierarchy();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Create a new building in the society layout' })
  @RequirePermissions('flat:write')
  @Post('layout/building')
  async createBuilding(@Body() body: { name: string }) {
    const result = await this.flatService.createBuilding(body.name);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Create a new wing inside a building' })
  @RequirePermissions('flat:write')
  @Post('layout/wing')
  async createWing(@Body() body: { buildingId: string; name: string }) {
    const result = await this.flatService.createWing(body.buildingId, body.name);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Create a new floor inside a wing' })
  @RequirePermissions('flat:write')
  @Post('layout/floor')
  async createFloor(@Body() body: { wingId: string; number: number }) {
    const result = await this.flatService.createFloor(body.wingId, body.number);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update a building name' })
  @RequirePermissions('flat:write')
  @Patch('layout/building/:id')
  async updateBuilding(@Param('id') id: string, @Body() body: { name: string }) {
    const result = await this.flatService.updateBuilding(id, body.name);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update a wing name' })
  @RequirePermissions('flat:write')
  @Patch('layout/wing/:id')
  async updateWing(@Param('id') id: string, @Body() body: { name: string }) {
    const result = await this.flatService.updateWing(id, body.name);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update a floor number' })
  @RequirePermissions('flat:write')
  @Patch('layout/floor/:id')
  async updateFloor(@Param('id') id: string, @Body() body: { number: number }) {
    const result = await this.flatService.updateFloor(id, body.number);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get single flat details' })
  @RequirePermissions('flat:read')
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const result = await this.flatService.findOne(id, req.user?.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update flat details and lease contexts' })
  @RequirePermissions('flat:write')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const validatedDto = updateFlatSchema.parse(body);
    const result = await this.flatService.update(id, validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Transfer flat ownership to a new owner with date tracking & notes' })
  @RequirePermissions('flat:write')
  @Post(':id/change-owner')
  async changeOwner(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.flatService.changeOwner(id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get full ownership timeline history for a flat' })
  @RequirePermissions('flat:read')
  @Get(':id/owner-history')
  async getOwnerHistory(@Param('id') id: string) {
    const result = await this.flatService.getOwnerHistory(id);
    return {
      success: true,
      data: result,
    };
  }
}
