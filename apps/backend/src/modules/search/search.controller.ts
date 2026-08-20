import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @ApiOperation({ summary: 'Search globally across all society entities and modules based on user permissions' })
  @ApiQuery({ name: 'q', description: 'Search term/keyword', required: false, type: String })
  @Get()
  async search(@Query('q') q: string, @Req() req: any) {
    const results = await this.searchService.globalSearch(q || '', req.user?.id);
    return {
      success: true,
      data: results,
    };
  }
}
