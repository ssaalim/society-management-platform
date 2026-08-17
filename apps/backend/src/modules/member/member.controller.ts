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
  Query,
  Res,
  UseInterceptors,
  UploadedFile
} from '@nestjs/common';
import { MemberService } from './member.service';
import { CreateMemberDto, createMemberSchema } from './dto/create-member.dto';
import { UpdateMemberDto, updateMemberSchema } from './dto/update-member.dto';
import { SupabaseAuthGuard } from '@core/auth/supabase.guard';
import { TenantGuard } from '@core/tenant/tenant.guard';
import { RolesGuard } from '@core/auth/roles.guard';
import { RequirePermissions } from '@core/auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, TenantGuard, RolesGuard)
@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @ApiOperation({ summary: 'Create a new housing society member profile' })
  @RequirePermissions('member:write')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const validatedDto = createMemberSchema.parse(body);
    const result = await this.memberService.create(validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Export member roster details to CSV' })
  @RequirePermissions('member:read')
  @Get('export')
  async exportCsv(@Res() res: Response) {
    const csvContent = await this.memberService.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=members_roster.csv');
    return res.status(200).send(csvContent);
  }

  @ApiOperation({ summary: 'Import members using a CSV file upload' })
  @RequirePermissions('member:write')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async importCsv(@UploadedFile() file: any, @Req() req: any) {
    const csvString = file.buffer.toString('utf-8');
    const result = await this.memberService.importCsv(csvString, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Import members using a JSON bulk payload' })
  @RequirePermissions('member:write')
  @Post('bulk')
  async importBulk(@Body() body: any[], @Req() req: any) {
    // Validate each row
    const validatedDtos = body.map(row => createMemberSchema.parse(row));
    const result = await this.memberService.bulkCreate(validatedDtos, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'List and filter housing society members' })
  @RequirePermissions('member:read')
  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('memberType') memberType?: string,
    @Query('committeeDesignation') committeeDesignation?: string,
    @Query('status') status?: string,
  ) {
    const list = await this.memberService.findAll({ search, memberType, committeeDesignation, status }, req.user?.id);
    return {
      success: true,
      data: list,
    };
  }

  @ApiOperation({ summary: 'Search existing users by name or email for member assignment' })
  @RequirePermissions('member:write')
  @Get('search-users')
  async searchUsers(@Query('q') q: string) {
    const results = await this.memberService.searchUsers(q);
    return {
      success: true,
      data: results,
    };
  }

  @ApiOperation({ summary: 'Get single member details context' })
  @RequirePermissions('member:read')
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const result = await this.memberService.findOne(id, req.user?.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Update member profile and family parameters' })
  @RequirePermissions('member:write')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const validatedDto = updateMemberSchema.parse(body);
    const result = await this.memberService.update(id, validatedDto, req.user.id);
    return {
      success: true,
      data: result,
    };
  }

  @ApiOperation({ summary: 'Delete member profile' })
  @RequirePermissions('member:write')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const result = await this.memberService.remove(id, req.user.id);
    return {
      success: true,
      data: result,
    };
  }
}
