import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get 
} from '@nestjs/common';
import { AIService } from './ai.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('AI Core')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @ApiOperation({ summary: 'Summarize meeting transcripts into structured minutes bullet coordinates' })
  @RequirePermissions('member:read')
  @Post('summarize-meeting')
  async summarizeMeeting(@Body('transcript') transcript: string) {
    const result = await this.aiService.summarizeMeeting(transcript);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Draft circular notices templates automatically' })
  @RequirePermissions('member:write')
  @Post('generate-notice')
  async generateNotice(
    @Body('title') title: string,
    @Body('details') details: string,
  ) {
    const result = await this.aiService.generateNotice(title, details);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Forecasting next month collections regression metrics' })
  @RequirePermissions('accounting:read')
  @Get('predict-maintenance')
  async predictMaintenance() {
    const result = await this.aiService.predictMaintenance();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Scan vouchers identifying transaction deviations anomalies' })
  @RequirePermissions('accounting:read')
  @Get('detect-anomalies')
  async detectAnomalies() {
    const result = await this.aiService.detectAnomalies();
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Answer queries scoping documents and parameters contexts' })
  @RequirePermissions('member:read')
  @Post('chat')
  async chat(@Body('message') message: string) {
    const result = await this.aiService.chatWithSociety(message);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'OCR scan invoice images mapping vendor and line items metadata' })
  @RequirePermissions('accounting:write')
  @Post('ocr-invoice')
  async ocrInvoice(@Body('fileBase64') fileBase64: string) {
    const result = await this.aiService.ocrInvoice(fileBase64);
    return {
      success: true,
      data: result,
    };
  }
}
