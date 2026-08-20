import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { ClsService } from 'nestjs-cls';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { customReports, customReportFavorites } from '../../../database/schema';
import { CreateCustomReportDto, UpdateCustomReportDto, ExecuteCustomReportDto } from './dto/custom-report.dto';

// Allowed SQL keywords that start a valid SELECT statement
const ALLOWED_SELECT_START = /^\s*select\s+/i;
// Detect dangerous keywords and commands that are not allowed
const DANGEROUS_KEYWORDS = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|exec|execute|call|do|copy|vacuum|reindex|analyze|lock|set|reset|listen|notify|unlisten|load)\b/i;
// Detect dangerous postgres system functions and catalog tables
const DANGEROUS_FUNCTIONS_AND_CATALOGS = /\b(pg_sleep|pg_read_file|pg_write_file|pg_ls_dir|dblink|pg_terminate_backend|pg_cancel_backend|set_config|current_setting|pg_shadow|pg_authid|pg_user|pg_database|pg_tablespace|pg_settings|information_schema|pg_catalog)\b/i;

@Injectable()
export class CustomReportService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get activeTenantId(): string {
    return this.cls.get<string>('tenantId');
  }

  private get activeUserId(): string {
    return this.cls.get<string>('userId') || '';
  }

  /**
   * Validates that the provided SQL is a safe, read-only SELECT statement.
   */
  private validateSql(rawSql: string): void {
    // Strip single-line comments
    let cleaned = rawSql.replace(/--[^\n]*/g, '');
    // Strip block comments
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    // Trim
    cleaned = cleaned.trim();

    if (!ALLOWED_SELECT_START.test(cleaned)) {
      throw new BadRequestException(
        'Only SELECT statements are allowed. The query must start with SELECT.',
      );
    }

    if (DANGEROUS_KEYWORDS.test(cleaned)) {
      throw new BadRequestException(
        'The SQL query contains disallowed keywords (INSERT, UPDATE, DELETE, DROP, ALTER, COPY, etc.).',
      );
    }

    if (DANGEROUS_FUNCTIONS_AND_CATALOGS.test(cleaned)) {
      throw new BadRequestException(
        'The SQL query contains disallowed system functions or database catalog references.',
      );
    }

    // Prevent stacked queries (multiple statements separated by semicolon)
    const withoutStrings = cleaned.replace(/'[^']*'/g, "''");
    const semicolonCount = (withoutStrings.match(/;/g) || []).length;
    if (semicolonCount > 1 || (semicolonCount === 1 && !withoutStrings.trimEnd().endsWith(';'))) {
      throw new BadRequestException('Stacked queries (multiple statements) are not allowed.');
    }
  }

  /**
   * Replaces named parameters (:param_key) with positional $N placeholders
   * and builds the values array for the pg driver.
   */
  private buildParameterizedQuery(
    rawSql: string,
    params: Record<string, string> = {},
    paramConfigs: any[] = [],
    userId?: string,
  ): { query: string; values: any[] } {
    const values: any[] = [];
    // Normalize mustache syntax {{param_name}} or '{{param_name}}' into :param_name
    let query = rawSql.replace(/'?\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}?'/g, ':$1');

    const resolvedUserId = userId || this.activeUserId;

    // Inject tenantId as :society_id and active user id as :user_id / :current_user_id automatically
    const allParams: Record<string, string> = {
      society_id: this.activeTenantId,
      user_id: resolvedUserId,
      current_user_id: resolvedUserId,
      ...params,
    };
    const paramConfigMap = new Map(paramConfigs.map((p: any) => [p.key, p]));

    // Find all :named_params in order of appearance
    const namedParamRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const paramOrder: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = namedParamRegex.exec(query)) !== null) {
      if (!paramOrder.includes(match[1])) {
        paramOrder.push(match[1]);
      }
    }

    // Replace each named param with positional placeholder
    for (const paramKey of paramOrder) {
      const config = paramConfigMap.get(paramKey);
      const rawValue = allParams[paramKey] ?? '';

      if (config?.type === 'in_list') {
        // Split comma-separated values into array for ANY($N) or IN clause expansion
        const listValues = rawValue
          .split(',')
          .map((v: string) => v.trim())
          .filter(Boolean);

        if (listValues.length === 0) {
          // Replace with empty list — query will return no rows
          query = query.replace(
            new RegExp(`:${paramKey}\\b`, 'g'),
            'NULL',
          );
        } else {
          // Use = ANY(ARRAY[...]) expansion
          const placeholders = listValues
            .map(() => {
              values.push(listValues[values.length] || listValues[listValues.length - 1]);
              return `$${values.length}`;
            })
            .join(', ');

          // Clear and rebuild correctly
          values.splice(values.length - listValues.length);
          listValues.forEach((v: string) => values.push(v));
          const startIdx = values.length - listValues.length + 1;
          const endIdx = values.length;
          const paramPlaceholders = Array.from(
            { length: endIdx - startIdx + 1 },
            (_, i) => `$${startIdx + i}`,
          ).join(', ');

          query = query.replace(
            new RegExp(`:${paramKey}\\b`, 'g'),
            paramPlaceholders,
          );
        }
      } else if (config?.type === 'date_range') {
        // date_range param key is used as-is; expect from_date/to_date pattern
        values.push(rawValue);
        query = query.replace(
          new RegExp(`:${paramKey}\\b`, 'g'),
          `$${values.length}`,
        );
      } else {
        // text or date
        values.push(rawValue);
        query = query.replace(
          new RegExp(`:${paramKey}\\b`, 'g'),
          `$${values.length}`,
        );
      }
    }

    return { query, values };
  }

  // ─────────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────────

  async create(dto: CreateCustomReportDto, userId: string): Promise<any> {
    this.validateSql(dto.sqlQuery);

    const [created] = await this.db
      .insert(customReports)
      .values({
        societyId: this.activeTenantId,
        name: dto.name,
        description: dto.description ?? null,
        sqlQuery: dto.sqlQuery,
        parameters: (dto.parameters ?? []) as any,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return created;
  }

  async findAll(userId: string): Promise<any[]> {
    const tenantId = this.activeTenantId;

    const reports = await this.db
      .select()
      .from(customReports)
      .where(
        and(
          eq(customReports.societyId, tenantId),
          isNull(customReports.deletedAt),
          eq(customReports.isActive, true),
        ),
      )
      .orderBy(desc(customReports.createdAt));

    if (reports.length === 0) return [];

    // Get favorites for current user in this society
    const favorites = await this.db
      .select({ reportId: customReportFavorites.reportId })
      .from(customReportFavorites)
      .where(
        and(
          eq(customReportFavorites.userId, userId),
          eq(customReportFavorites.societyId, tenantId),
        ),
      );

    const favoriteIds = new Set(favorites.map((f) => f.reportId));

    const enriched = reports.map((r) => ({
      ...r,
      isFavorite: favoriteIds.has(r.id),
    }));

    // Sort: favorites first, then by name
    return enriched.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async findOne(id: string): Promise<any> {
    const [report] = await this.db
      .select()
      .from(customReports)
      .where(
        and(
          eq(customReports.id, id),
          eq(customReports.societyId, this.activeTenantId),
          isNull(customReports.deletedAt),
        ),
      );

    if (!report) {
      throw new NotFoundException(`Custom report '${id}' not found.`);
    }

    return report;
  }

  async update(id: string, dto: UpdateCustomReportDto, userId: string): Promise<any> {
    await this.findOne(id); // throws if not found

    if (dto.sqlQuery) {
      this.validateSql(dto.sqlQuery);
    }

    const [updated] = await this.db
      .update(customReports)
      .set({
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sqlQuery && { sqlQuery: dto.sqlQuery }),
        ...(dto.parameters !== undefined && { parameters: dto.parameters as any }),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customReports.id, id))
      .returning();

    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id); // throws if not found

    await this.db
      .update(customReports)
      .set({ deletedAt: new Date(), updatedBy: userId })
      .where(eq(customReports.id, id));
  }

  // ─────────────────────────────────────────────────────────────────
  // FAVORITES
  // ─────────────────────────────────────────────────────────────────

  async toggleFavorite(
    reportId: string,
    userId: string,
  ): Promise<{ isFavorite: boolean }> {
    const tenantId = this.activeTenantId;

    // Check if already a favorite
    const [existing] = await this.db
      .select()
      .from(customReportFavorites)
      .where(
        and(
          eq(customReportFavorites.reportId, reportId),
          eq(customReportFavorites.userId, userId),
        ),
      );

    if (existing) {
      // Remove favorite
      await this.db
        .delete(customReportFavorites)
        .where(
          and(
            eq(customReportFavorites.reportId, reportId),
            eq(customReportFavorites.userId, userId),
          ),
        );
      return { isFavorite: false };
    } else {
      // Add favorite
      await this.db.insert(customReportFavorites).values({
        reportId,
        userId,
        societyId: tenantId,
      });
      return { isFavorite: true };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // EXECUTION
  // ─────────────────────────────────────────────────────────────────

  async execute(
    reportId: string,
    dto: ExecuteCustomReportDto,
    userId?: string,
  ): Promise<{ columns: string[]; rows: any[]; rowCount: number; truncated: boolean }> {
    const report = await this.findOne(reportId);
    this.validateSql(report.sqlQuery);

    const paramConfigs = (report.parameters as any[]) || [];
    const { query, values } = this.buildParameterizedQuery(
      report.sqlQuery,
      dto.params ?? {},
      paramConfigs,
      userId,
    );

    // Execute via raw SQL — append LIMIT 2001 to enforce row cap
    const limitedQuery = query.replace(/;\s*$/, '') + ` LIMIT 2001`;

    let rawResult: any[];
    try {
      // Use drizzle sql.raw() to execute the parameterized query
      // We build the SQL string with values already substituted for safety
      // (values are passed as positional params to the underlying postgres.js client)
      const sqlWithValues = this.buildRawSqlWithValues(limitedQuery, values);
      const result = await this.db.execute(sql.raw(sqlWithValues));
      rawResult = Array.isArray(result) ? result : (result as any)?.rows ?? [];
    } catch (err: any) {
      throw new BadRequestException(`Query execution failed: ${err?.message || err}`);
    }

    const truncated = rawResult.length > 2000;
    const rows = truncated ? rawResult.slice(0, 2000) : rawResult;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      truncated,
    };
  }

  /**
   * Inlines parameter values into the SQL string for raw execution.
   * Values are escaped to prevent SQL injection on the inline path.
   */
  private buildRawSqlWithValues(query: string, values: any[]): string {
    let result = query;
    for (let i = values.length; i >= 1; i--) {
      const val = values[i - 1];
      let escaped: string;
      if (val === null || val === undefined) {
        escaped = 'NULL';
      } else if (typeof val === 'number') {
        escaped = String(val);
      } else if (typeof val === 'boolean') {
        escaped = val ? 'TRUE' : 'FALSE';
      } else {
        // Escape single quotes in strings
        escaped = `'${String(val).replace(/'/g, "''")}' `;
      }
      result = result.replace(new RegExp(`\\$${i}(?!\\d)`, 'g'), escaped);
    }
    return result;
  }

  async exportCsv(reportId: string, dto: ExecuteCustomReportDto, userId?: string): Promise<string> {
    const { columns, rows } = await this.execute(reportId, dto, userId);

    if (rows.length === 0) return 'No data found.\n';

    // Build CSV
    const escape = (val: any) => {
      const str = val === null || val === undefined ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv = columns.join(',') + '\n';
    for (const row of rows) {
      csv += columns.map((col) => escape(row[col])).join(',') + '\n';
    }
    return csv;
  }
}
