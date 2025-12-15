import type { Operator, SqlResult, CompilerContext } from '../types';

/**
 * Handle array operators: in, not_in, contains, contained_by, overlaps
 */
export function handleArray(
  operator: Operator,
  column: string,
  values: unknown[],
  context: CompilerContext,
): SqlResult {
  switch (operator) {
    case 'in':
    case 'not_in':
      return handleIn(operator, column, values, context);

    case 'contains':
      return handleArrayContains(column, values, context);

    case 'contained_by':
      return handleContainedBy(column, values, context);

    case 'overlaps':
      return handleOverlaps(column, values, context);

    default:
      throw new Error(`Unknown array operator: ${operator}`);
  }
}

/**
 * Handle IN and NOT IN operators
 */
function handleIn(
  operator: Operator,
  column: string,
  values: unknown[],
  context: CompilerContext,
): SqlResult {
  if (values.length === 0) {
    // IN empty array = always false, NOT IN empty = always true
    return {
      sql: operator === 'in' ? '1=0' : '1=1',
      params: {},
    };
  }

  const params: Record<string, unknown> = {};
  const placeholders: string[] = [];

  for (const value of values) {
    const paramName = context.paramIndex.toString();
    context.paramIndex++;
    placeholders.push(`$${paramName}`);
    params[`$${paramName}`] = value;
  }

  const sqlOperator = operator === 'in' ? 'IN' : 'NOT IN';
  
  return {
    sql: `${column} ${sqlOperator} (${placeholders.join(', ')})`,
    params,
  };
}

/**
 * Handle PostgreSQL array contains (@>)
 * Column array contains all values
 */
function handleArrayContains(
  column: string,
  values: unknown[],
  context: CompilerContext,
): SqlResult {
  const paramName = context.paramIndex.toString();
  context.paramIndex++;

  return {
    sql: `${column} @> $${paramName}`,
    params: { [`$${paramName}`]: values },
  };
}

/**
 * Handle PostgreSQL contained by (<@)
 * Column array is contained by values
 */
function handleContainedBy(
  column: string,
  values: unknown[],
  context: CompilerContext,
): SqlResult {
  const paramName = context.paramIndex.toString();
  context.paramIndex++;

  return {
    sql: `${column} <@ $${paramName}`,
    params: { [`$${paramName}`]: values },
  };
}

/**
 * Handle PostgreSQL overlaps (&&)
 * Column array has any common element with values
 */
function handleOverlaps(
  column: string,
  values: unknown[],
  context: CompilerContext,
): SqlResult {
  const paramName = context.paramIndex.toString();
  context.paramIndex++;

  return {
    sql: `${column} && $${paramName}`,
    params: { [`$${paramName}`]: values },
  };
}
