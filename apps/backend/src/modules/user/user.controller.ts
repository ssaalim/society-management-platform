import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
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
    const result = await this.userService.getUserMemberships(userId);
    return {
      success: true,
      data: result,
    };
  }
}
