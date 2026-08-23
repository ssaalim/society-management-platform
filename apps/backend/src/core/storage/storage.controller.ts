import { Controller, Post, Get, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { UploadUrlRequestDto } from './storage.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly r2StorageService: R2StorageService) {}

  @ApiOperation({ summary: 'Generate a pre-signed Cloudflare R2 upload URL with strict size & quota limits' })
  @Throttle({ default: { limit: 15, ttl: 60000 } }) // Rate limit: max 15 upload requests per minute
  @Post('upload-url')
  async getUploadUrl(
    @Body() body: UploadUrlRequestDto & { societyId?: string },
    @Req() req: any,
  ) {
    const tenantId = req.headers['x-tenant-id'] || body.societyId || 'general';

    if (!body.fileName || !body.fileType) {
      throw new BadRequestException('fileName and fileType are required.');
    }

    const result = await this.r2StorageService.generatePresignedUploadUrl(tenantId, body);

    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Get current monthly storage usage metrics and free tier quota status' })
  @Get('usage')
  async getStorageUsage() {
    const usage = await this.r2StorageService.getMonthlyUsage();
    return {
      success: true,
      data: {
        ...usage,
        totalMb: (usage.totalBytes / (1024 * 1024)).toFixed(2),
        percentageUsed: ((usage.uploadCount / usage.maxMonthlyCap) * 100).toFixed(1) + '%',
      },
    };
  }
}
