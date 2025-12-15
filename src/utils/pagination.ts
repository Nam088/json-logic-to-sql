import type { FieldSchema, FilterSchema } from '../types';
import { escapeIdentifier } from '../security/sanitizer';

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
}

export interface PaginationResult {
  sql: string;
  params: Record<string, unknown>;
  meta: {
    page: number;
    pageSize: number;
    offset: number;
  };
  /** Next param index to use (for chaining with other SQL builders) */
  nextParamIndex: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Build pagination SQL clause (LIMIT/OFFSET)
 * @param options - Pagination options (page/pageSize or offset/limit)
 * @param maxPageSize - Maximum allowed page size (default: 100)
 * @param startIndex - Starting parameter index for $N placeholders (default: 1)
 */
export function buildPagination(
  options: PaginationOptions,
  maxPageSize: number = MAX_PAGE_SIZE,
  startIndex: number = 1,
): PaginationResult {
  let offset: number;
  let limit: number;
  let page: number;

  if (options.offset !== undefined && options.limit !== undefined) {
    // Use raw offset/limit
    offset = Math.max(0, options.offset);
    limit = Math.min(Math.max(1, options.limit), maxPageSize);
    page = Math.floor(offset / limit) + 1;
  } else {
    // Use page/pageSize
    page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(
      Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE),
      maxPageSize,
    );
    limit = pageSize;
    offset = (page - 1) * pageSize;
  }

  const limitParam = startIndex;
  const offsetParam = startIndex + 1;

  return {
    sql: `LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params: { [`$${limitParam}`]: limit, [`$${offsetParam}`]: offset },
    meta: {
      page,
      pageSize: limit,
      offset,
    },
    nextParamIndex: startIndex + 2,
  };
}

export interface SortOptions {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface SortResult {
  sql: string;
}

/**
 * Build ORDER BY clause from sort options
 */
export function buildSort(
  sorts: SortOptions[],
  schema: FilterSchema,
): SortResult {
  if (sorts.length === 0) {
    return { sql: '' };
  }

  const parts: string[] = [];

  for (const sort of sorts) {
    const field = schema.fields[sort.field];
    
    if (!field) {
      throw new Error(`Unknown sort field: ${sort.field}`);
    }

    if (field.sortable === false) {
      throw new Error(`Field not sortable: ${sort.field}`);
    }

    // Get column name
    let column: string;
    if ('computed' in field && field.computed) {
      column = `(${field.expression})`;
    } else {
      const colName = (field as FieldSchema).column ?? sort.field;
      column = escapeIdentifier(colName);
    }

    const direction = (sort.direction ?? 'asc').toUpperCase();
    parts.push(`${column} ${direction}`);
  }

  return {
    sql: `ORDER BY ${parts.join(', ')}`,
  };
}
