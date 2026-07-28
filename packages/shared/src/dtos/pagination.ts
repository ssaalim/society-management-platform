export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface PaginationRequest {
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortOrder;
  search?: string;
  filters?: Record<string, any>;
}

export interface PaginationMeta {
  itemCount: number;
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
