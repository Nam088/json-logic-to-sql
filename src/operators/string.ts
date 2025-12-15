import type { Operator, SqlResult, CompilerContext } from '../types';

/**
 * Handle string operators: like, ilike, starts_with, ends_with, contains, regex
 */
export function handleString(
  operator: Operator,
  column: string,
  value: string,
  context: CompilerContext,
  caseSensitive: boolean = false,
): SqlResult {
  const paramName = context.paramIndex.toString();
  context.paramIndex++;

  let sqlOperator: string;
  let paramValue: string;

  switch (operator) {
    case 'starts_with':
      sqlOperator = caseSensitive ? 'LIKE' : 'ILIKE';
      paramValue = `${escapeLike(value)}%`;
      break;

    case 'ends_with':
      sqlOperator = caseSensitive ? 'LIKE' : 'ILIKE';
      paramValue = `%${escapeLike(value)}`;
      break;

    case 'contains':
      sqlOperator = caseSensitive ? 'LIKE' : 'ILIKE';
      paramValue = `%${escapeLike(value)}%`;
      break;

    case 'like':
      sqlOperator = 'LIKE';
      paramValue = value; // User provides pattern with % and _
      break;

    case 'ilike':
      sqlOperator = 'ILIKE';
      paramValue = value; // User provides pattern with % and _
      break;

    case 'regex':
      sqlOperator = caseSensitive ? '~' : '~*';
      paramValue = value;
      break;

    default:
      throw new Error(`Unknown string operator: ${operator}`);
  }

  return {
    sql: `${column} ${sqlOperator} $${paramName}`,
    params: { [`$${paramName}`]: paramValue },
  };
}

/**
 * Escape special LIKE characters
 */
function escapeLike(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
