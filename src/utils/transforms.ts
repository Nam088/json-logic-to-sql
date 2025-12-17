import type { TransformFn, CustomTransform } from '../types';

/**
 * Apply built-in SQL transforms to a column expression
 * @param column - Column expression to transform
 * @param fn - Transform function name
 * @param dialect - Database dialect name (optional, for dialect-specific transforms)
 */
export function applyBuiltinTransform(column: string, fn: string, dialect?: string): string {
  switch (fn) {
    // Universal transforms (supported by all major databases)
    case 'lower':
      return `LOWER(${column})`;
    case 'upper':
      return `UPPER(${column})`;
    case 'trim':
      return `TRIM(${column})`;
    case 'ltrim':
      return `LTRIM(${column})`;
    case 'rtrim':
      return `RTRIM(${column})`;
    
    // Dialect-specific transforms
    case 'unaccent':
      // Only PostgreSQL supports unaccent (requires extension)
      if (dialect === 'postgresql') {
        return `unaccent(${column})`;
      }
      throw new Error(`Transform 'unaccent' is only supported in PostgreSQL`);
    
    case 'date':
      // Most databases support DATE(), but syntax may vary
      return `DATE(${column})`;
    
    case 'year':
      // MySQL uses YEAR() instead of EXTRACT(YEAR FROM ...)
      if (dialect === 'mysql') {
        return `YEAR(${column})`;
      }
      // PostgreSQL, SQLite, MSSQL use EXTRACT
      return `EXTRACT(YEAR FROM ${column})`;
    
    case 'month':
      // MySQL uses MONTH() instead of EXTRACT(MONTH FROM ...)
      if (dialect === 'mysql') {
        return `MONTH(${column})`;
      }
      // PostgreSQL, SQLite, MSSQL use EXTRACT
      return `EXTRACT(MONTH FROM ${column})`;
    
    case 'day':
      // MySQL uses DAY() instead of EXTRACT(DAY FROM ...)
      if (dialect === 'mysql') {
        return `DAY(${column})`;
      }
      // PostgreSQL, SQLite, MSSQL use EXTRACT
      return `EXTRACT(DAY FROM ${column})`;
    
    default:
      return column;
  }
}

/**
 * Apply built-in JavaScript transforms to a parameter value
 */
export function applyValueTransform(value: unknown, fn: string): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  switch (fn) {
    case 'lower':
      return value.toLowerCase();
    case 'upper':
      return value.toUpperCase();
    case 'trim':
      return value.trim();
    case 'ltrim':
      return value.trimStart();
    case 'rtrim':
      return value.trimEnd();
    default:
      return value;
  }
}

/**
 * Apply multiple value transforms in sequence
 */
export function applyValueTransforms(
  value: unknown,
  transforms: TransformFn | TransformFn[],
): unknown {
  const fns = Array.isArray(transforms) ? transforms : [transforms];
  let result = value;

  for (const fn of fns) {
    if (typeof fn === 'string') {
      result = applyValueTransform(result, fn);
    }
    // Custom transforms are not supported for values (only for SQL columns)
  }

  return result;
}

/**
 * Apply a single transform function to a column
 * @param column - Column expression to transform
 * @param fn - Transform function
 * @param dialect - Database dialect name (optional, for dialect-specific transforms)
 */
export function applyTransform(column: string, fn: TransformFn, dialect?: string): string {
  if (typeof fn === 'string') {
    return applyBuiltinTransform(column, fn, dialect);
  }
  // Custom transform with SQL template
  return (fn as CustomTransform).sql.replace('{column}', column);
}

/**
 * Apply multiple transforms in sequence
 * @param column - Column expression to transform
 * @param transforms - Transform function(s) to apply
 * @param dialect - Database dialect name (optional, for dialect-specific transforms)
 */
export function applyTransforms(
  column: string,
  transforms: TransformFn | TransformFn[],
  dialect?: string,
): string {
  const fns = Array.isArray(transforms) ? transforms : [transforms];
  let result = column;

  for (const fn of fns) {
    result = applyTransform(result, fn, dialect);
  }

  return result;
}
