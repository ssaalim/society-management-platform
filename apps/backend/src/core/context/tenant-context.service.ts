import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantContextService {
  constructor(private readonly cls: ClsService) {}

  /**
   * Get the current active tenant ID for the request.
   */
  getTenantId(): string | null {
    return this.cls.get('tenantId');
  }

  /**
   * Set the current active tenant ID for the request.
   */
  setTenantId(tenantId: string): void {
    this.cls.set('tenantId', tenantId);
  }

  /**
   * Get the current authenticated user's ID.
   */
  getUserId(): string | null {
    return this.cls.get('userId');
  }

  /**
   * Set the current authenticated user's ID.
   */
  setUserId(userId: string): void {
    this.cls.set('userId', userId);
  }
}
