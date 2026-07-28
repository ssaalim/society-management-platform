import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Reusable base entity columns for all business tables in Drizzle.
 * Usage:
 * export const users = pgTable('users', {
 *   ...baseEntityColumns(),
 *   name: text('name'),
 * });
 */
export function baseEntityColumns() {
  return {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'),
  };
}
