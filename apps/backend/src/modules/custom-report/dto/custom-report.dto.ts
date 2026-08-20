import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportParamType {
  TEXT = 'text',
  DATE = 'date',
  DATE_RANGE = 'date_range',
  IN_LIST = 'in_list',
}

export class ReportParamConfigDto {
  @ApiProperty({ example: 'flat_number' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ example: 'Flat Number' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: ReportParamType })
  @IsEnum(ReportParamType)
  type: ReportParamType;

  @ApiPropertyOptional({ example: 'Search by flat number' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  required?: boolean;
}

export class CreateCustomReportDto {
  @ApiProperty({ example: 'Defaulter Summary' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Lists flats with unpaid bills' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'SELECT flat_number, total_amount FROM maintenance_bills WHERE society_id = :society_id AND status = :status' })
  @IsString()
  @IsNotEmpty()
  sqlQuery: string;

  @ApiPropertyOptional({ type: [ReportParamConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportParamConfigDto)
  parameters?: ReportParamConfigDto[];
}

export class UpdateCustomReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sqlQuery?: string;

  @ApiPropertyOptional({ type: [ReportParamConfigDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportParamConfigDto)
  parameters?: ReportParamConfigDto[];
}

export class ExecuteCustomReportDto {
  @ApiPropertyOptional({
    description: 'Key-value pairs for named parameters. For in_list params, use comma-separated string.',
    example: { status: 'UNPAID', from_date: '2024-01-01', statuses: 'UNPAID,PARTIAL' },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, string>;
}
