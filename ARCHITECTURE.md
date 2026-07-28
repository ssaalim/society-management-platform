# System Architecture & Design Guidelines

This document serves as the foundation for developing business modules in the Society Management SaaS platform. All new features and modules must strictly adhere to the patterns defined here.

## 1. API Versioning
All REST API routes are automatically prefixed with `/api/v1` using global URI versioning (`VersioningType.URI`). 
- Controllers should **not** manually include `v1` in their `@Controller()` path.
- Future versions (e.g., v2) can be handled by specifying `@Version('2')` on a controller or route.

## 2. Standard API Response Format
The backend employs a global `ResponseInterceptor` and `AllExceptionsFilter`.
- **Controllers** should just return standard payloads (objects, arrays, strings) or pagination wrappers (e.g., `PageDto`).
- **Success Responses** are automatically formatted as:
  ```json
  {
    "success": true,
    "message": "Request successful",
    "data": { ... },
    "meta": { ... } // for pagination or metadata
  }
  ```
- **Error Responses** are automatically formatted as:
  ```json
  {
    "success": false,
    "message": "Error description",
    "errors": [ { "path": "...", "message": "..." } ],
    "requestId": "uuid"
  }
  ```

## 3. Request Lifecycle & Request ID
Every incoming request is assigned a unique `requestId` (UUID) using `nestjs-cls` (Continuation-Local Storage).
- The `requestId` is accessible anywhere via `ClsService.getId()`.
- It is automatically injected into Pino logs for traceablity.
- It is returned in the payload of all error responses.

## 4. Tenant Context & Multi-Tenancy
The foundation for multi-tenancy is laid out without tying to any specific auth provider just yet.
- The `TenantContextService` wraps `nestjs-cls` to fetch `tenantId` and `userId` without explicitly passing `req` objects around.
- **Custom Decorators**: Use `@CurrentUser()` and `@CurrentTenant()` in controller routes to inject the currently resolved IDs directly.

## 5. Audit Logging Architecture
The `AuditModule` provides an `AuditService` available globally.
- Use `this.auditService.log({ action, resource, details })` whenever a sensitive mutation occurs.
- Currently, this outputs to the structured Pino logs, but the interface is designed to seamlessly integrate with database persistence in the future.

## 6. Global Validation
- The application uses `ValidationPipe` globally with `transform: true` and `whitelist: true`.
- **Forbid Non-Whitelisted**: Any payload properties not defined in the DTO will throw a 400 Bad Request automatically.
- Types like query params will be implicitly converted based on DTO `@Type()` definitions.

## 7. Database Entities & UUID Strategy
- **UUIDs** are the standard identifier mechanism. **Do not use auto-incrementing integers** for business tables.
- **Drizzle Schema Helper**: All Drizzle table definitions should spread the `baseEntityColumns()` helper from `apps/backend/src/core/database/base.schema.ts`.
  ```typescript
  export const societies = pgTable('societies', {
    ...baseEntityColumns(),
    name: text('name').notNull(),
  });
  ```
- This automatically provisions `id` (UUID), `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, and `deletedBy`.

## 8. Pagination Standard
- Shared interfaces (`PaginationRequest`, `PaginationMeta`, `PaginatedResponse`) are located in `packages/shared`. Both frontend and backend share these exact type definitions.
- The backend utilizes `PageOptionsDto` and `PageDto` inside `apps/backend/src/common/dtos/pagination.dto.ts` to implement validation decorators. 
- All list endpoints should accept `PageOptionsDto` as `@Query()` and return `PageDto<T>`.
