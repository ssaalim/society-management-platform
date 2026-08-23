import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Req, 
  Query 
} from '@nestjs/common';
import { SocietyService } from './society.service';
import { CreateSocietyDto, createSocietySchema } from './dto/create-society.dto';
import { UpdateSocietyDto, updateSocietySchema } from './dto/update-society.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { SuperAdminGuard } from '@core/auth/superadmin.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Societies')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('societies')
export class SocietyController {
  constructor(private readonly societyService: SocietyService) {}

  @ApiOperation({ summary: 'Create a new society (Super Admin scope)' })
  @UseGuards(SuperAdminGuard)
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    // Custom validate payload schema using Zod
    const validatedDto = createSocietySchema.parse(body);
    const result = await this.societyService.create(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List all societies (Super Admin scope)' })
  @UseGuards(SuperAdminGuard)
  @Get()
  async findAll() {
    const list = await this.societyService.findAll();
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Resolve society metadata details by Slug URL' })
  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    const result = await this.societyService.findBySlug(slug);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get society profile details (requires read permission)' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:read')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.societyService.findOne(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get society subscription plan status & expiry metadata' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:read')
  @Get(':id/subscription')
  async getSubscriptionStatus(@Param('id') id: string) {
    const result = await this.societyService.getSubscriptionStatus(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get statutory society registration renewal and expiry status' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:read')
  @Get(':id/registration-expiry')
  async getRegistrationExpiry(@Param('id') id: string) {
    const result = await this.societyService.getRegistrationExpiry(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get society profile and settings mutation change history' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:read')
  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    const result = await this.societyService.getHistory(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update society profile (requires write permission)' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:write')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const validatedDto = updateSocietySchema.parse(body);
    const result = await this.societyService.update(id, validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Request pre-signed Cloudflare R2 upload URL for document upload' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:write')
  @Post(':id/documents/upload-url')
  async getUploadUrl(
    @Param('id') id: string,
    @Query('fileType') fileType: string,
    @Query('fileName') fileName: string,
    @Query('contentType') contentType?: string,
    @Query('fileSize') fileSize?: string,
  ) {
    const sizeNumber = fileSize ? parseInt(fileSize, 10) : undefined;
    const result = await this.societyService.generateUploadUrl(id, fileType, fileName, contentType, sizeNumber);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Soft delete a society (Super Admin scope)' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const result = await this.societyService.remove(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get configured society bank accounts' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:read')
  @Get(':id/bank-accounts')
  async getBankAccounts(@Param('id') id: string) {
    const result = await this.societyService.getBankAccounts(id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Add a new bank account for society' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:write')
  @Post(':id/bank-accounts')
  async addBankAccount(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.societyService.addBankAccount(id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update a society bank account' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:write')
  @Patch(':id/bank-accounts/:accountId')
  async updateBankAccount(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const result = await this.societyService.updateBankAccount(id, accountId, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Remove a society bank account' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('society:write')
  @Delete(':id/bank-accounts/:accountId')
  async deleteBankAccount(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Req() req: any,
  ) {
    const result = await this.societyService.deleteBankAccount(id, accountId, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
