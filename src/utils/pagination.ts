import type { FieldSchema, FilterSchema } from '../types';
import type { PlaceholderStyle } from '../dialects/type';
import { escapeIdentifier } from '../security/sanitizer';

/**
 * Convert params object to ordered array based on param keys
 * Supports keys like: $1, $2, p1, p2, @p1, @p2
 */
export function paramsToArray(params: Record<string, unknown>): unknown[] {
  const getParamIndex = (key: string): number => {
    // Match patterns: $1, $2, p1, p2, @p1, @p2
    const match = key.match(/[@$]?p?(\d+)/);
    return match?.[1] ? parseInt(match[1], 10) : 0;
  };

  return Object.keys(params)
    .sort((a, b) => getParamIndex(a) - getParamIndex(b))
    .map((k) => params[k]);
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
  /** Placeholder style for SQL parameters (default: 'dollar') */
  placeholderStyle?: PlaceholderStyle;
}

export interface PaginationResult {
  sql: string;
  params: Record<string, unknown>;
  /** Params as ordered array for Knex/MySQL style queries */
  paramsArray: unknown[];
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
 * Get placeholder string based on style
 */
function getPlaceholder(style: PlaceholderStyle, index: number): string {
  switch (style) {
    case 'question':
      return '?';
    case 'at':
      return `@p${index}`;
    case 'dollar':
    default:
      return `$${index}`;
  }
}

/**
 * Get a unique key for storing params in the params object.
 * Always uses unique keys (p1, p2, etc.) regardless of placeholder style.
 */
function getParamKey(index: number): string {
  return `p${index}`;
}

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

  const placeholderStyle = options.placeholderStyle ?? 'dollar';

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

  const limitParamIndex = startIndex;
  const offsetParamIndex = startIndex + 1;

  const limitPlaceholder = getPlaceholder(placeholderStyle, limitParamIndex);
  const offsetPlaceholder = getPlaceholder(placeholderStyle, offsetParamIndex);
  const limitKey = getParamKey(limitParamIndex);
  const offsetKey = getParamKey(offsetParamIndex);

  const params = { [limitKey]: limit, [offsetKey]: offset };

  return {
    sql: `LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    params,
    paramsArray: [limit, offset],
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
