import type { TransformFn, CustomTransform } from '../types';

/**
 * Apply built-in SQL transforms to a column expression
 */
export function applyBuiltinTransform(column: string, fn: string): string {
  switch (fn) {
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
    case 'unaccent':
      return `unaccent(${column})`;
    case 'date':
      return `DATE(${column})`;
    case 'year':
      return `EXTRACT(YEAR FROM ${column})`;
    case 'month':
      return `EXTRACT(MONTH FROM ${column})`;
    case 'day':
      return `EXTRACT(DAY FROM ${column})`;
    default:
      return column;
  }
}

/**
 * Apply a single transform function to a column
 */
export function applyTransform(column: string, fn: TransformFn): string {
  if (typeof fn === 'string') {
    return applyBuiltinTransform(column, fn);
  }
  // Custom transform with SQL template
  return (fn as CustomTransform).sql.replace('{column}', column);
}

/**
 * Apply multiple transforms in sequence
 */
export function applyTransforms(
  column: string,
  transforms: TransformFn | TransformFn[],
): string {
  const fns = Array.isArray(transforms) ? transforms : [transforms];
  let result = column;

  for (const fn of fns) {
    result = applyTransform(result, fn);
  }

  return result;
}
