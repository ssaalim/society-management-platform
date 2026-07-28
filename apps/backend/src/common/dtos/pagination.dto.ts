import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationRequest, SortOrder, PaginationMeta, PaginatedResponse } from '@society/shared';

export class PageOptionsDto implements PaginationRequest {
  @IsEnum(SortOrder)
  @IsOptional()
  readonly order?: SortOrder = SortOrder.DESC;

  @IsString()
  @IsOptional()
  readonly sort?: string = 'createdAt';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly limit?: number = 10;

  @IsString()
  @IsOptional()
  readonly search?: string;
  
  @IsOptional()
  readonly filters?: Record<string, any>;
}

export class PageMetaDto implements PaginationMeta {
  readonly itemCount: number;
  readonly totalItems: number;
  readonly itemsPerPage: number;
  readonly totalPages: number;
  readonly currentPage: number;

  constructor({ pageOptionsDto, itemCount, totalItems }: { pageOptionsDto: PageOptionsDto; itemCount: number, totalItems: number }) {
    this.currentPage = pageOptionsDto.page || 1;
    this.itemsPerPage = pageOptionsDto.limit || 10;
    this.itemCount = itemCount;
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  }
}

export class PageDto<T> implements PaginatedResponse<T> {
  readonly data: T[];
  readonly meta: PageMetaDto;

  constructor(data: T[], meta: PageMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}
