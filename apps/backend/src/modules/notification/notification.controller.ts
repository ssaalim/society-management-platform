import { 
  Controller, 
  Get,
  Post, 
  Patch,
  Param,
  UseGuards, 
  Req 
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Retrieve in-app notifications for the logged-in user' })
  @Get('my-notifications')
  async getMyNotifications(@Req() req: any) {
    const result = await this.notificationService.getUserNotifications(req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Mark a single notification as READ' })
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const result = await this.notificationService.markAsRead(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Mark all notifications as READ for the logged-in user' })
  @Patch('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    const result = await this.notificationService.markAllAsRead(req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Run manual reminder sweep for outstanding billing defaulters' })
  @RequirePermissions('billing:write')
  @Post('sweep')
  async runSweep(@Req() req: any) {
    const result = await this.notificationService.runDefaultersReminderSweep(req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
