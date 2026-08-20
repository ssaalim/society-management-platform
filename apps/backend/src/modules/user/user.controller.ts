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
import { UserService } from './user.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Get current user profile and society memberships' })
  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user.id;
    const email = req.user.email;
    const name = req.user.userMetadata?.name || req.user.name;
    const result = await this.userService.getUserMemberships(userId, email, name);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Set default society for current user' })
  @Patch('me/default-society')
  async setDefaultSociety(@Body('societyId') societyId: string, @Req() req: any) {
    const userId = req.user.id;
    const result = await this.userService.setDefaultSociety(userId, societyId);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @Patch('me/profile')
  async updateMyProfile(@Body() body: { name?: string; mobile?: string }, @Req() req: any) {
    const userId = req.user.id;
    const result = await this.userService.updateProfile(userId, body);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Change current user password' })
  @Post('me/change-password')
  async changeMyPassword(@Body() body: { password?: string; newPassword?: string }, @Req() req: any) {
    const userId = req.user.id;
    const newPass = body.newPassword || body.password || '';
    const result = await this.userService.changePassword(userId, newPass);
    return {
      success: true,
      data: result,
    };
  }

  // ==========================================
  // SOCIETY USERS & ACCESS CONTROL
  // ==========================================

  @ApiOperation({ summary: 'List all users with access to current society (including staff/accountants)' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('member:read')
  @Get('society-users')
  async getSocietyUsers(@Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    const list = await this.userService.getSocietyUsers(tenantId);
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Grant system access / invite non-inventory staff, accountant, or auditor' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('member:write')
  @Post('grant-access')
  async grantUserAccess(@Body() body: any, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    const result = await this.userService.grantUserAccess(tenantId, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update a user role in current society' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('member:write')
  @Patch(':id/role')
  async updateUserRole(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    const result = await this.userService.updateUserRole(tenantId, id, body, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Revoke user access from current society' })
  @UseGuards(TenantGuard, RolesGuard)
  @RequirePermissions('member:write')
  @Delete(':id/revoke')
  async revokeUserAccess(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.headers['x-tenant-id'];
    const result = await this.userService.revokeUserAccess(tenantId, id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
